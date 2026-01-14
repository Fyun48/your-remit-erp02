import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const approvalFlowRouter = router({
  // 取得模組可用的審核流程
  listByModule: publicProcedure
    .input(z.object({
      companyId: z.string(),
      module: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalFlow.findMany({
        where: {
          module: input.module,
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      })
    }),

  // 取得單一流程詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalFlow.findUnique({
        where: { id: input.id },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
    }),

  // 建立審核流程
  create: publicProcedure
    .input(z.object({
      companyId: z.string().optional(),
      code: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      module: z.string(),
      conditions: z.string().optional(),
      isDefault: z.boolean().default(false),
      steps: z.array(z.object({
        stepOrder: z.number(),
        name: z.string(),
        approverType: z.enum([
          'SUPERVISOR', 'DEPARTMENT_HEAD', 'POSITION_LEVEL',
          'SPECIFIC_POSITION', 'SPECIFIC_EMPLOYEE', 'ROLE'
        ]),
        approverValue: z.string().optional(),
        approvalMode: z.enum(['ANY', 'ALL', 'MAJORITY']).default('ANY'),
        canSkip: z.boolean().default(false),
        skipCondition: z.string().optional(),
        ccType: z.enum([
          'SUPERVISOR', 'DEPARTMENT_HEAD', 'POSITION_LEVEL',
          'SPECIFIC_POSITION', 'SPECIFIC_EMPLOYEE', 'ROLE'
        ]).optional(),
        ccValue: z.string().optional(),
        timeoutHours: z.number().default(0),
        timeoutAction: z.enum(['NONE', 'REMIND', 'ESCALATE', 'AUTO_APPROVE', 'AUTO_REJECT']).default('NONE'),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { steps, ...flowData } = input

      // 如果設為預設，先取消其他預設
      if (flowData.isDefault) {
        await ctx.prisma.approvalFlow.updateMany({
          where: {
            module: flowData.module,
            companyId: flowData.companyId || null,
            isDefault: true,
          },
          data: { isDefault: false },
        })
      }

      return ctx.prisma.approvalFlow.create({
        data: {
          ...flowData,
          steps: {
            create: steps,
          },
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
    }),

  // 更新審核流程
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      conditions: z.string().optional(),
      isActive: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      if (data.isDefault) {
        const flow = await ctx.prisma.approvalFlow.findUnique({ where: { id } })
        if (flow) {
          await ctx.prisma.approvalFlow.updateMany({
            where: {
              module: flow.module,
              companyId: flow.companyId,
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          })
        }
      }

      return ctx.prisma.approvalFlow.update({
        where: { id },
        data,
      })
    }),

  // 刪除審核流程
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const activeInstances = await ctx.prisma.approvalInstance.count({
        where: {
          flowId: input.id,
          status: 'IN_PROGRESS',
        },
      })

      if (activeInstances > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `此流程有 ${activeInstances} 筆審核中的申請，無法刪除`,
        })
      }

      return ctx.prisma.approvalFlow.delete({
        where: { id: input.id },
      })
    }),

  // 根據條件匹配流程
  matchFlow: publicProcedure
    .input(z.object({
      companyId: z.string(),
      module: z.string(),
      context: z.record(z.string(), z.unknown()),
    }))
    .query(async ({ ctx, input }) => {
      const flows = await ctx.prisma.approvalFlow.findMany({
        where: {
          module: input.module,
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
        orderBy: [{ companyId: 'desc' }, { sortOrder: 'asc' }],
      })

      const context = input.context as Record<string, unknown>

      for (const flow of flows) {
        if (!flow.conditions) {
          if (flow.isDefault) return flow
          continue
        }

        try {
          const conditions = JSON.parse(flow.conditions) as Record<string, unknown>
          let match = true

          const totalDays = context.totalDays as number | undefined
          const amount = context.amount as number | undefined
          const leaveType = context.leaveType as string | undefined

          if (conditions.minDays && totalDays !== undefined && totalDays < (conditions.minDays as number)) {
            match = false
          }
          if (conditions.maxDays && totalDays !== undefined && totalDays > (conditions.maxDays as number)) {
            match = false
          }
          if (conditions.leaveTypes && leaveType !== undefined && !(conditions.leaveTypes as string[]).includes(leaveType)) {
            match = false
          }
          if (conditions.minAmount && amount !== undefined && amount < (conditions.minAmount as number)) {
            match = false
          }

          if (match) return flow
        } catch {
          continue
        }
      }

      return flows.find(f => f.isDefault) || flows[0] || null
    }),
})
