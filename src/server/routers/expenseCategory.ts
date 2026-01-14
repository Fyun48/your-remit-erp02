import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const expenseCategoryRouter = router({
  // 取得所有費用類別
  list: publicProcedure
    .input(z.object({
      companyId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.expenseCategory.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
    }),

  // 取得單一費用類別
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.expenseCategory.findUnique({
        where: { id: input.id },
      })
    }),

  // 建立費用類別
  create: publicProcedure
    .input(z.object({
      companyId: z.string().optional(),
      code: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      requiresReceipt: z.boolean().default(true),
      maxAmountPerItem: z.number().optional(),
      maxAmountPerMonth: z.number().optional(),
      requiresPreApproval: z.boolean().default(false),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查代碼是否重複
      const existing = await ctx.prisma.expenseCategory.findFirst({
        where: {
          code: input.code,
          companyId: input.companyId || null,
        },
      })

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '費用類別代碼已存在',
        })
      }

      return ctx.prisma.expenseCategory.create({
        data: input,
      })
    }),

  // 更新費用類別
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      requiresReceipt: z.boolean().optional(),
      maxAmountPerItem: z.number().nullable().optional(),
      maxAmountPerMonth: z.number().nullable().optional(),
      requiresPreApproval: z.boolean().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.expenseCategory.findUnique({
        where: { id: input.id },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '費用類別不存在' })
      }

      const { id, ...data } = input
      return ctx.prisma.expenseCategory.update({
        where: { id },
        data,
      })
    }),

  // 刪除費用類別（軟刪除）
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.expenseCategory.findUnique({
        where: { id: input.id },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '費用類別不存在' })
      }

      return ctx.prisma.expenseCategory.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),
})
