import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// 產生申請單號
function generateRequestNo(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `LV${date}${random}`
}

// 計算請假時數
function calculateLeaveHours(
  startDate: Date,
  startPeriod: string,
  endDate: Date,
  endPeriod: string,
  workHoursPerDay: number = 8
): number {
  const start = new Date(startDate)
  const end = new Date(endDate)

  // 計算天數差
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  if (diffDays === 1) {
    // 同一天
    if (startPeriod === 'FULL_DAY') return workHoursPerDay
    return workHoursPerDay / 2 // AM 或 PM
  }

  // 多天
  let totalHours = (diffDays - 2) * workHoursPerDay // 中間天數

  // 第一天
  if (startPeriod === 'FULL_DAY') totalHours += workHoursPerDay
  else if (startPeriod === 'PM') totalHours += workHoursPerDay / 2
  else totalHours += workHoursPerDay // AM 開始算全天

  // 最後一天
  if (endPeriod === 'FULL_DAY') totalHours += workHoursPerDay
  else if (endPeriod === 'AM') totalHours += workHoursPerDay / 2
  else totalHours += workHoursPerDay // PM 結束算全天

  return totalHours
}

export const leaveRequestRouter = router({
  // 建立請假申請
  create: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      leaveTypeId: z.string(),
      startDate: z.date(),
      startPeriod: z.enum(['FULL_DAY', 'AM', 'PM']).default('FULL_DAY'),
      endDate: z.date(),
      endPeriod: z.enum(['FULL_DAY', 'AM', 'PM']).default('FULL_DAY'),
      reason: z.string().optional(),
      proxyEmployeeId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 驗證假別
      const leaveType = await ctx.prisma.leaveType.findUnique({
        where: { id: input.leaveTypeId },
      })

      if (!leaveType) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '假別不存在' })
      }

      // 檢查是否需要事由
      if (leaveType.requiresReason && !input.reason) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此假別需要填寫請假事由' })
      }

      // 計算請假時數
      const totalHours = calculateLeaveHours(
        input.startDate,
        input.startPeriod,
        input.endDate,
        input.endPeriod
      )

      // 取得直屬主管作為審核者
      const assignment = await ctx.prisma.employeeAssignment.findFirst({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'ACTIVE',
        },
      })

      return ctx.prisma.leaveRequest.create({
        data: {
          requestNo: generateRequestNo(),
          employeeId: input.employeeId,
          companyId: input.companyId,
          leaveTypeId: input.leaveTypeId,
          startDate: input.startDate,
          startPeriod: input.startPeriod,
          endDate: input.endDate,
          endPeriod: input.endPeriod,
          totalHours,
          reason: input.reason,
          proxyEmployeeId: input.proxyEmployeeId,
          status: 'DRAFT',
          currentApproverId: assignment?.supervisorId,
        },
      })
    }),

  // 送出申請
  submit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以送出' })
      }

      return ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: 'PENDING',
          submittedAt: new Date(),
        },
      })
    }),

  // 審核（核准/拒絕）
  approve: publicProcedure
    .input(z.object({
      id: z.string(),
      action: z.enum(['APPROVE', 'REJECT']),
      approverId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: { leaveType: true },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請單無法審核' })
      }

      const newStatus = input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'

      // 更新請假申請
      const updated = await ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: newStatus,
          processedAt: new Date(),
          approvedById: input.action === 'APPROVE' ? input.approverId : undefined,
          rejectedById: input.action === 'REJECT' ? input.approverId : undefined,
          approvalComment: input.comment,
        },
      })

      // 如果核准，更新假別餘額
      if (input.action === 'APPROVE') {
        const year = new Date().getFullYear()
        await ctx.prisma.leaveBalance.upsert({
          where: {
            employeeId_companyId_leaveTypeId_year: {
              employeeId: request.employeeId,
              companyId: request.companyId,
              leaveTypeId: request.leaveTypeId,
              year,
            },
          },
          update: {
            usedHours: { increment: request.totalHours },
          },
          create: {
            employeeId: request.employeeId,
            companyId: request.companyId,
            leaveTypeId: request.leaveTypeId,
            year,
            usedHours: request.totalHours,
          },
        })
      }

      return updated
    }),

  // 取消申請
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (!['DRAFT', 'PENDING'].includes(request.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請單無法取消' })
      }

      return ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      })
    }),

  // 取得我的請假列表
  listMine: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const year = input.year || new Date().getFullYear()
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year, 11, 31)

      return ctx.prisma.leaveRequest.findMany({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          startDate: { gte: startOfYear, lte: endOfYear },
        },
        include: { leaveType: true },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得待審核列表（主管用）
  listPending: publicProcedure
    .input(z.object({ approverId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 取得此主管的下屬
      const subordinates = await ctx.prisma.employeeAssignment.findMany({
        where: { supervisorId: input.approverId, status: 'ACTIVE' },
        select: { employeeId: true, companyId: true },
      })

      if (subordinates.length === 0) return []

      return ctx.prisma.leaveRequest.findMany({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({
            employeeId: s.employeeId,
            companyId: s.companyId,
          })),
        },
        include: { leaveType: true },
        orderBy: { submittedAt: 'asc' },
      })
    }),

  // 取得單一申請詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: { leaveType: true },
      })
    }),
})
