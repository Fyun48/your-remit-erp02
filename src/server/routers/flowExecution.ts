import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { FlowModuleType, FlowApprovalDecision } from '@prisma/client'
import {
  startFlow,
  processDecision,
  cancelFlow,
  getPendingApprovals,
  getProxyPendingApprovals,
} from '@/lib/flow-engine'

export const flowExecutionRouter = router({
  // 啟動審核流程
  start: publicProcedure
    .input(z.object({
      companyId: z.string(),
      moduleType: z.nativeEnum(FlowModuleType),
      referenceId: z.string(),
      applicantId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await startFlow(input)

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || '啟動審核流程失敗',
        })
      }

      return { executionId: result.executionId }
    }),

  // 處理審核決策
  decide: publicProcedure
    .input(z.object({
      executionId: z.string(),
      approverId: z.string(),
      decision: z.nativeEnum(FlowApprovalDecision),
      comment: z.string().optional(),
      proxyDelegationId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await processDecision(input)

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || '處理審核決策失敗',
        })
      }

      return { newStatus: result.newStatus }
    }),

  // 取消審核流程
  cancel: publicProcedure
    .input(z.object({
      executionId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await cancelFlow(input.executionId, input.reason)

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || '取消審核流程失敗',
        })
      }

      return { success: true }
    }),

  // 取得待我審核的項目
  getPending: publicProcedure
    .input(z.object({
      employeeId: z.string(),
    }))
    .query(async ({ input }) => {
      return getPendingApprovals(input.employeeId)
    }),

  // 取得可代理審核的項目
  getProxyPending: publicProcedure
    .input(z.object({
      employeeId: z.string(),
    }))
    .query(async ({ input }) => {
      return getProxyPendingApprovals(input.employeeId)
    }),

  // 取得流程執行詳情
  getById: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const execution = await ctx.prisma.flowExecution.findUnique({
        where: { id: input.id },
        include: {
          template: {
            select: { id: true, name: true, moduleType: true },
          },
          applicant: {
            select: { id: true, name: true, employeeNo: true },
          },
          approvals: {
            orderBy: { stepOrder: 'asc' },
            include: {
              assignee: {
                select: { id: true, name: true, employeeNo: true },
              },
              actualApprover: {
                select: { id: true, name: true, employeeNo: true },
              },
            },
          },
        },
      })

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '找不到審核流程',
        })
      }

      return execution
    }),

  // 取得申請的審核流程（用於顯示審核進度）
  getByReference: publicProcedure
    .input(z.object({
      moduleType: z.nativeEnum(FlowModuleType),
      referenceId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const execution = await ctx.prisma.flowExecution.findFirst({
        where: {
          moduleType: input.moduleType,
          referenceId: input.referenceId,
        },
        include: {
          template: {
            select: { id: true, name: true },
          },
          approvals: {
            orderBy: { stepOrder: 'asc' },
            include: {
              assignee: {
                select: { id: true, name: true },
              },
              actualApprover: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return execution
    }),

  // 取得員工的審核歷史
  getHistory: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.prisma.flowApprovalRecord.findMany({
        where: {
          OR: [
            { assigneeId: input.employeeId },
            { actualApproverId: input.employeeId },
          ],
          decision: { not: null },
        },
        include: {
          execution: {
            include: {
              applicant: {
                select: { id: true, name: true, employeeNo: true },
              },
              template: {
                select: { name: true, moduleType: true },
              },
            },
          },
        },
        orderBy: { decidedAt: 'desc' },
        take: input.limit,
        skip: input.offset,
      })

      return records
    }),
})
