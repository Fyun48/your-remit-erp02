import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const businessCardRouter = router({
  // 列表查詢
  list: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        status: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
      }

      if (input.status) {
        where.status = input.status
      }

      if (input.search) {
        where.OR = [
          { requestNo: { contains: input.search, mode: 'insensitive' } },
          { name: { contains: input.search, mode: 'insensitive' } },
          { applicant: { name: { contains: input.search, mode: 'insensitive' } } },
        ]
      }

      return ctx.prisma.businessCardRequest.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          applicant: { select: { id: true, name: true, employeeNo: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 單筆查詢
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.businessCardRequest.findUnique({
        where: { id: input.id },
        include: {
          company: { select: { id: true, name: true, phone: true, address: true } },
          applicant: { select: { id: true, name: true, employeeNo: true, email: true, phone: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      })
    }),

  // 我的申請
  getMyRequests: publicProcedure
    .input(z.object({ applicantId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.businessCardRequest.findMany({
        where: { applicantId: input.applicantId },
        include: {
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得員工在指定公司的任職資訊（用於自動帶入名片資料）
  getAssignmentInfo: publicProcedure
    .input(z.object({ employeeId: z.string(), companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.employeeAssignment.findUnique({
        where: {
          employeeId_companyId: {
            employeeId: input.employeeId,
            companyId: input.companyId,
          },
        },
        include: {
          employee: { select: { name: true, email: true, phone: true } },
          company: { select: { name: true, phone: true, address: true } },
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      })

      if (!assignment) return null

      return {
        name: assignment.employee.name,
        email: assignment.employee.email,
        mobile: assignment.employee.phone,
        title: assignment.position.name,
        department: assignment.department.name,
        phone: assignment.company.phone,
        address: assignment.company.address,
      }
    }),

  // 建立申請
  create: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        applicantId: z.string(),
        name: z.string(),
        nameEn: z.string().optional(),
        title: z.string(),
        titleEn: z.string().optional(),
        department: z.string().optional(),
        phone: z.string().optional(),
        mobile: z.string().optional(),
        fax: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        quantity: z.number().min(1).default(100),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 產生申請單號 BC202601-0001
      const now = new Date()
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      const prefix = `BC${yearMonth}-`

      const lastRequest = await ctx.prisma.businessCardRequest.findFirst({
        where: { requestNo: { startsWith: prefix } },
        orderBy: { requestNo: 'desc' },
      })

      let seq = 1
      if (lastRequest) {
        const lastSeq = parseInt(lastRequest.requestNo.split('-')[1])
        seq = lastSeq + 1
      }

      const requestNo = `${prefix}${String(seq).padStart(4, '0')}`

      return ctx.prisma.businessCardRequest.create({
        data: {
          requestNo,
          companyId: input.companyId,
          applicantId: input.applicantId,
          name: input.name,
          nameEn: input.nameEn,
          title: input.title,
          titleEn: input.titleEn,
          department: input.department,
          phone: input.phone,
          mobile: input.mobile,
          fax: input.fax,
          email: input.email,
          address: input.address,
          quantity: input.quantity,
          note: input.note,
          status: 'DRAFT',
        },
      })
    }),

  // 更新申請
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        nameEn: z.string().optional(),
        title: z.string().optional(),
        titleEn: z.string().optional(),
        department: z.string().optional(),
        phone: z.string().optional(),
        mobile: z.string().optional(),
        fax: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        quantity: z.number().min(1).optional(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const request = await ctx.prisma.businessCardRequest.findUnique({
        where: { id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'DRAFT') {
        throw new Error('只有草稿狀態可以修改')
      }

      return ctx.prisma.businessCardRequest.update({
        where: { id },
        data,
      })
    }),

  // 提交審批
  submit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.businessCardRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'DRAFT') {
        throw new Error('只有草稿狀態可以提交')
      }

      return ctx.prisma.businessCardRequest.update({
        where: { id: input.id },
        data: { status: 'PENDING' },
      })
    }),

  // 取消申請
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.businessCardRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (!['DRAFT', 'PENDING'].includes(request.status)) {
        throw new Error('此狀態無法取消')
      }

      return ctx.prisma.businessCardRequest.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      })
    }),

  // 核准
  approve: publicProcedure
    .input(z.object({ id: z.string(), approverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.businessCardRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'PENDING') {
        throw new Error('只有待審核狀態可以核准')
      }

      return ctx.prisma.businessCardRequest.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          approvedById: input.approverId,
          approvedAt: new Date(),
        },
      })
    }),

  // 駁回
  reject: publicProcedure
    .input(z.object({ id: z.string(), approverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.businessCardRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'PENDING') {
        throw new Error('只有待審核狀態可以駁回')
      }

      return ctx.prisma.businessCardRequest.update({
        where: { id: input.id },
        data: {
          status: 'REJECTED',
          approvedById: input.approverId,
          approvedAt: new Date(),
        },
      })
    }),

  // 開始印刷
  startPrinting: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.businessCardRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'APPROVED') {
        throw new Error('只有已核准狀態可以開始印刷')
      }

      return ctx.prisma.businessCardRequest.update({
        where: { id: input.id },
        data: { status: 'PRINTING' },
      })
    }),

  // 完成印刷
  complete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.businessCardRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'PRINTING') {
        throw new Error('只有印刷中狀態可以完成')
      }

      return ctx.prisma.businessCardRequest.update({
        where: { id: input.id },
        data: {
          status: 'COMPLETED',
          printedAt: new Date(),
        },
      })
    }),

  // 統計
  statistics: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      const [totalThisMonth, totalThisYear, pendingCount, printingCount] =
        await Promise.all([
          ctx.prisma.businessCardRequest.count({
            where: {
              companyId: input.companyId,
              createdAt: { gte: startOfMonth },
            },
          }),
          ctx.prisma.businessCardRequest.count({
            where: {
              companyId: input.companyId,
              createdAt: { gte: startOfYear },
            },
          }),
          ctx.prisma.businessCardRequest.count({
            where: {
              companyId: input.companyId,
              status: 'PENDING',
            },
          }),
          ctx.prisma.businessCardRequest.count({
            where: {
              companyId: input.companyId,
              status: 'PRINTING',
            },
          }),
        ])

      return {
        totalThisMonth,
        totalThisYear,
        pendingCount,
        printingCount,
      }
    }),
})
