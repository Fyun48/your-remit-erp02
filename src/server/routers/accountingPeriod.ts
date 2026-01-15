import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const accountingPeriodRouter = router({
  // 取得公司所有會計期間
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { companyId: input.companyId }
      if (input.year) where.year = input.year

      return ctx.prisma.accountingPeriod.findMany({
        where,
        orderBy: [{ year: 'desc' }, { period: 'desc' }],
      })
    }),

  // 取得當前開放期間
  getCurrent: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.accountingPeriod.findFirst({
        where: {
          companyId: input.companyId,
          status: 'OPEN',
        },
        orderBy: [{ year: 'desc' }, { period: 'desc' }],
      })
    }),

  // 初始化年度會計期間
  initializeYear: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否已有該年度期間
      const existing = await ctx.prisma.accountingPeriod.findFirst({
        where: { companyId: input.companyId, year: input.year },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: `${input.year}年度會計期間已存在` })
      }

      // 建立 12 個月的期間
      const periods = []
      for (let month = 1; month <= 12; month++) {
        const startDate = new Date(input.year, month - 1, 1)
        const endDate = new Date(input.year, month, 0) // 該月最後一天
        endDate.setHours(23, 59, 59, 999)

        periods.push({
          companyId: input.companyId,
          year: input.year,
          period: month,
          startDate,
          endDate,
          status: 'OPEN' as const,
        })
      }

      await ctx.prisma.accountingPeriod.createMany({ data: periods })
      return { count: 12, year: input.year }
    }),

  // 關閉期間
  close: publicProcedure
    .input(z.object({
      id: z.string(),
      closedBy: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const period = await ctx.prisma.accountingPeriod.findUnique({
        where: { id: input.id },
      })
      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '會計期間不存在' })
      }
      if (period.status !== 'OPEN') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有開放狀態的期間可以關閉' })
      }

      // 檢查是否有未過帳傳票
      const draftCount = await ctx.prisma.voucher.count({
        where: {
          periodId: input.id,
          status: { in: ['DRAFT', 'PENDING'] },
        },
      })
      if (draftCount > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `還有 ${draftCount} 張傳票未過帳，無法關閉期間` })
      }

      return ctx.prisma.accountingPeriod.update({
        where: { id: input.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: input.closedBy,
        },
      })
    }),

  // 重新開放期間
  reopen: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const period = await ctx.prisma.accountingPeriod.findUnique({
        where: { id: input.id },
      })
      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '會計期間不存在' })
      }
      if (period.status === 'LOCKED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '已鎖定的期間無法重新開放' })
      }

      return ctx.prisma.accountingPeriod.update({
        where: { id: input.id },
        data: { status: 'OPEN', closedAt: null, closedBy: null },
      })
    }),
})
