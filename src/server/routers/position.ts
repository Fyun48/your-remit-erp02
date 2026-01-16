import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const positionRouter = router({
  // 取得公司所有職位
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      includeInactive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.position.findMany({
        where: {
          companyId: input.companyId,
          ...(input.includeInactive ? {} : { isActive: true }),
        },
        include: {
          _count: { select: { employees: true } },
        },
        orderBy: [{ level: 'desc' }, { code: 'asc' }],
      })
    }),

  // 取得單一職位
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.position.findUnique({
        where: { id: input.id },
        include: {
          employees: {
            include: {
              employee: { select: { id: true, name: true, employeeNo: true } },
              department: { select: { id: true, name: true } },
            },
            where: { status: 'ACTIVE' },
          },
        },
      })
    }),

  // 取得下一個編號
  getNextCode: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const positions = await ctx.prisma.position.findMany({
        where: { companyId: input.companyId },
        select: { code: true },
      })

      let maxNum = 0
      for (const pos of positions) {
        const match = pos.code.match(/^P(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNum) maxNum = num
        }
      }
      return `P${String(maxNum + 1).padStart(3, '0')}`
    }),

  // 建立職位
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      code: z.string().optional(),
      name: z.string(),
      level: z.number().min(0).max(10).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      let code = input.code
      if (!code) {
        const positions = await ctx.prisma.position.findMany({
          where: { companyId: input.companyId },
          select: { code: true },
        })
        let maxNum = 0
        for (const pos of positions) {
          const match = pos.code.match(/^P(\d+)$/)
          if (match) {
            const num = parseInt(match[1], 10)
            if (num > maxNum) maxNum = num
          }
        }
        code = `P${String(maxNum + 1).padStart(3, '0')}`
      }

      const existing = await ctx.prisma.position.findFirst({
        where: { companyId: input.companyId, code },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '職位編號已存在' })
      }

      return ctx.prisma.position.create({
        data: {
          companyId: input.companyId,
          code,
          name: input.name,
          level: input.level,
        },
      })
    }),

  // 更新職位
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      level: z.number().min(0).max(10).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.position.update({
        where: { id },
        data,
      })
    }),

  // 刪除職位（軟刪除）
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否有員工使用此職位
      const employeeCount = await ctx.prisma.employeeAssignment.count({
        where: { positionId: input.id, status: 'ACTIVE' },
      })
      if (employeeCount > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `此職位有 ${employeeCount} 位在職員工，無法停用`,
        })
      }

      return ctx.prisma.position.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),
})
