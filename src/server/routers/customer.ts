import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// 解析編號並產生下一個編號
function generateNextCode(prefix: string, existingCodes: string[]): string {
  let maxNum = 0
  for (const code of existingCodes) {
    const match = code.match(new RegExp(`^${prefix}(\\d+)$`))
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`
}

export const customerRouter = router({
  list: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.customer.findMany({
        where: { companyId: input.companyId, isActive: true },
        orderBy: { code: 'asc' },
      })
    }),

  getNextCode: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const customers = await ctx.prisma.customer.findMany({
        where: { companyId: input.companyId },
        select: { code: true },
      })
      return generateNextCode('C', customers.map(c => c.code))
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.customer.findUnique({
        where: { id: input.id },
        include: { receivables: { take: 10, orderBy: { arDate: 'desc' } } },
      })
    }),

  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      code: z.string().optional(),
      name: z.string(),
      taxId: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.number().default(30),
      creditLimit: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let code = input.code
      if (!code) {
        // 自動產生編號
        const customers = await ctx.prisma.customer.findMany({
          where: { companyId: input.companyId },
          select: { code: true },
        })
        code = generateNextCode('C', customers.map(c => c.code))
      }
      const existing = await ctx.prisma.customer.findFirst({
        where: { companyId: input.companyId, code },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '客戶編號已存在' })
      }
      return ctx.prisma.customer.create({ data: { ...input, code } })
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      taxId: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.number().optional(),
      creditLimit: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.customer.update({ where: { id }, data })
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否有應收帳款關聯
      const hasReceivables = await ctx.prisma.accountReceivable.count({
        where: { customerId: input.id, status: { not: 'VOID' } },
      })
      if (hasReceivables > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '此客戶有未結清的應收帳款，無法刪除',
        })
      }
      // 軟刪除
      return ctx.prisma.customer.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),
})
