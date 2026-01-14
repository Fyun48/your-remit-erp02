import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const leaveTypeRouter = router({
  // 取得可用假別列表（含集團共用 + 公司自訂）
  list: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveType.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId: null },        // 集團共用
            { companyId: input.companyId }, // 公司自訂
          ],
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
    }),

  // 取得單一假別
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveType.findUnique({
        where: { id: input.id },
      })
    }),

  // 建立假別（公司自訂）
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      code: z.string().min(1),
      name: z.string().min(1),
      category: z.enum(['STATUTORY', 'COMPANY']).default('COMPANY'),
      requiresReason: z.boolean().default(true),
      requiresAttachment: z.boolean().default(false),
      attachmentAfterDays: z.number().default(0),
      minUnit: z.enum(['HOUR', 'HALF_DAY', 'DAY']).default('HOUR'),
      quotaType: z.enum(['FIXED', 'SENIORITY', 'UNLIMITED']).default('FIXED'),
      annualQuotaDays: z.number().default(0),
      canCarryOver: z.boolean().default(false),
      carryOverLimitDays: z.number().default(0),
      advanceDaysRequired: z.number().default(0),
      maxConsecutiveDays: z.number().default(0),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.leaveType.create({ data: input })
    }),

  // 更新假別
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      requiresReason: z.boolean().optional(),
      requiresAttachment: z.boolean().optional(),
      annualQuotaDays: z.number().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.leaveType.update({ where: { id }, data })
    }),
})
