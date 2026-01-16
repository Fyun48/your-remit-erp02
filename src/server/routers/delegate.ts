import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const delegateRouter = router({
  // 取得我的代理設定
  getMyDelegates: publicProcedure
    .input(z.object({ principalId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workflowApprovalDelegate.findMany({
        where: { principalId: input.principalId },
        include: {
          delegate: { select: { id: true, name: true, employeeNo: true } },
        },
        orderBy: { startDate: 'desc' },
      })
    }),

  // 取得代理我的人
  getMyPrincipals: publicProcedure
    .input(z.object({ delegateId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workflowApprovalDelegate.findMany({
        where: { delegateId: input.delegateId, isActive: true },
        include: {
          principal: { select: { id: true, name: true, employeeNo: true } },
        },
        orderBy: { startDate: 'desc' },
      })
    }),

  // 建立職務代理
  create: publicProcedure
    .input(z.object({
      principalId: z.string(),
      delegateId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
      requestTypes: z.array(z.string()).default([]),
      companyIds: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      // 驗證：不能代理自己
      if (input.principalId === input.delegateId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不能指定自己為代理人' })
      }

      // 驗證：結束日期需大於開始日期
      if (input.endDate <= input.startDate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '結束日期需大於開始日期' })
      }

      return ctx.prisma.workflowApprovalDelegate.create({
        data: input,
        include: {
          delegate: { select: { id: true, name: true, employeeNo: true } },
        },
      })
    }),

  // 更新職務代理
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      requestTypes: z.array(z.string()).optional(),
      companyIds: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.workflowApprovalDelegate.update({
        where: { id },
        data,
        include: {
          delegate: { select: { id: true, name: true, employeeNo: true } },
        },
      })
    }),

  // 取消職務代理
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workflowApprovalDelegate.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),

  // 刪除職務代理
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workflowApprovalDelegate.delete({
        where: { id: input.id },
      })
    }),

  // 檢查是否有有效代理人
  getActiveDelegate: publicProcedure
    .input(z.object({
      principalId: z.string(),
      requestType: z.string().optional(),
      companyId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()

      const delegates = await ctx.prisma.workflowApprovalDelegate.findMany({
        where: {
          principalId: input.principalId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          delegate: { select: { id: true, name: true, employeeNo: true } },
        },
      })

      // 過濾符合條件的代理
      const validDelegates = delegates.filter((d) => {
        // 如果有指定申請類型，檢查是否在範圍內
        if (input.requestType && d.requestTypes.length > 0) {
          if (!d.requestTypes.includes(input.requestType)) return false
        }
        // 如果有指定公司，檢查是否在範圍內
        if (input.companyId && d.companyIds.length > 0) {
          if (!d.companyIds.includes(input.companyId)) return false
        }
        return true
      })

      return validDelegates.length > 0 ? validDelegates[0] : null
    }),
})
