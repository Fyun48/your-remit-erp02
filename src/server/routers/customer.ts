import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const customerRouter = router({
  list: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.customer.findMany({
        where: { companyId: input.companyId, isActive: true },
        orderBy: { code: 'asc' },
      })
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
      code: z.string(),
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
      const existing = await ctx.prisma.customer.findFirst({
        where: { companyId: input.companyId, code: input.code },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '客戶編號已存在' })
      }
      return ctx.prisma.customer.create({ data: input })
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
})
