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

export const vendorRouter = router({
  list: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.vendor.findMany({
        where: { companyId: input.companyId, isActive: true },
        orderBy: { code: 'asc' },
      })
    }),

  getNextCode: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const vendors = await ctx.prisma.vendor.findMany({
        where: { companyId: input.companyId },
        select: { code: true },
      })
      return generateNextCode('V', vendors.map(v => v.code))
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.vendor.findUnique({
        where: { id: input.id },
        include: { payables: { take: 10, orderBy: { apDate: 'desc' } } },
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
      bankName: z.string().optional(),
      bankAccount: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let code = input.code
      if (!code) {
        // 自動產生編號
        const vendors = await ctx.prisma.vendor.findMany({
          where: { companyId: input.companyId },
          select: { code: true },
        })
        code = generateNextCode('V', vendors.map(v => v.code))
      }
      const existing = await ctx.prisma.vendor.findFirst({
        where: { companyId: input.companyId, code },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '供應商編號已存在' })
      }
      return ctx.prisma.vendor.create({ data: { ...input, code } })
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
      bankName: z.string().optional(),
      bankAccount: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.vendor.update({ where: { id }, data })
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否有應付帳款關聯
      const hasPayables = await ctx.prisma.accountPayable.count({
        where: { vendorId: input.id, status: { not: 'VOID' } },
      })
      if (hasPayables > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '此供應商有未結清的應付帳款，無法刪除',
        })
      }
      // 軟刪除
      return ctx.prisma.vendor.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),
})
