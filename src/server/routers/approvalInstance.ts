import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { PrismaClient } from '@prisma/client'

// 根據 approverType 解析實際審核者
async function resolveApprovers(
  prisma: PrismaClient,
  approverType: string,
  approverValue: string | null,
  applicantId: string,
  companyId: string
): Promise<string[]> {
  const assignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId: applicantId, companyId, status: 'ACTIVE' },
    include: { department: true, position: true },
  })

  if (!assignment) return []

  switch (approverType) {
    case 'SUPERVISOR':
      return assignment.supervisorId ? [assignment.supervisorId] : []

    case 'DEPARTMENT_HEAD':
      const deptHead = await prisma.employeeAssignment.findFirst({
        where: {
          companyId,
          departmentId: assignment.departmentId,
          status: 'ACTIVE',
          position: { level: { gte: 3 } },
        },
        orderBy: { position: { level: 'desc' } },
      })
      return deptHead ? [deptHead.id] : []

    case 'POSITION_LEVEL':
      const level = parseInt(approverValue || '0')
      const levelApprovers = await prisma.employeeAssignment.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          position: { level: { gte: level } },
        },
        select: { id: true },
      })
      return levelApprovers.map((a) => a.id)

    case 'SPECIFIC_POSITION':
      const positionApprovers = await prisma.employeeAssignment.findMany({
        where: {
          companyId,
          positionId: approverValue || undefined,
          status: 'ACTIVE',
        },
        select: { id: true },
      })
      return positionApprovers.map((a) => a.id)

    case 'SPECIFIC_EMPLOYEE':
      return approverValue ? [approverValue] : []

    case 'ROLE':
      const roleApprovers = await prisma.employeeAssignment.findMany({
        where: {
          companyId,
          roleId: approverValue || undefined,
          status: 'ACTIVE',
        },
        select: { id: true },
      })
      return roleApprovers.map((a) => a.id)

    default:
      return []
  }
}

export const approvalInstanceRouter = router({
  // 建立審核實例（啟動審核流程）
  create: publicProcedure
    .input(z.object({
      flowId: z.string(),
      module: z.string(),
      referenceId: z.string(),
      applicantId: z.string(),
      companyId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const flow = await ctx.prisma.approvalFlow.findUnique({
        where: { id: input.flowId },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
        },
      })

      if (!flow || flow.steps.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '審核流程不存在或無關卡' })
      }

      const instance = await ctx.prisma.approvalInstance.create({
        data: {
          flowId: input.flowId,
          module: input.module,
          referenceId: input.referenceId,
          applicantId: input.applicantId,
          companyId: input.companyId,
          status: 'IN_PROGRESS',
          currentStep: 1,
        },
      })

      const firstStep = flow.steps[0]
      const approvers = await resolveApprovers(
        ctx.prisma,
        firstStep.approverType,
        firstStep.approverValue,
        input.applicantId,
        input.companyId
      )

      await ctx.prisma.approvalStepInstance.create({
        data: {
          instanceId: instance.id,
          stepId: firstStep.id,
          stepOrder: 1,
          assignedTo: JSON.stringify(approvers),
          status: 'PENDING',
          dueAt: firstStep.timeoutHours > 0
            ? new Date(Date.now() + firstStep.timeoutHours * 60 * 60 * 1000)
            : null,
        },
      })

      return instance
    }),

  // 執行審核動作
  act: publicProcedure
    .input(z.object({
      instanceId: z.string(),
      actorId: z.string(),
      action: z.enum(['APPROVE', 'REJECT', 'RETURN', 'DELEGATE']),
      comment: z.string().optional(),
      delegateTo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.approvalInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          flow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          stepInstances: {
            where: { status: 'PENDING' },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })

      if (!instance) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '審核實例不存在' })
      }

      if (instance.status !== 'IN_PROGRESS') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此審核已結束' })
      }

      const currentStepInstance = instance.stepInstances[0]
      if (!currentStepInstance) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '無待審核關卡' })
      }

      const assignedApprovers: string[] = JSON.parse(currentStepInstance.assignedTo || '[]')
      if (!assignedApprovers.includes(input.actorId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您無權審核此申請' })
      }

      await ctx.prisma.approvalAction.create({
        data: {
          stepInstanceId: currentStepInstance.id,
          actorId: input.actorId,
          action: input.action,
          comment: input.comment,
        },
      })

      if (input.action === 'REJECT' || input.action === 'RETURN') {
        await ctx.prisma.approvalStepInstance.update({
          where: { id: currentStepInstance.id },
          data: { status: 'REJECTED', completedAt: new Date() },
        })

        return ctx.prisma.approvalInstance.update({
          where: { id: input.instanceId },
          data: { status: 'REJECTED', completedAt: new Date() },
        })
      }

      if (input.action === 'DELEGATE') {
        if (!input.delegateTo) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '需指定委託對象' })
        }

        return ctx.prisma.approvalStepInstance.update({
          where: { id: currentStepInstance.id },
          data: {
            assignedTo: JSON.stringify([input.delegateTo]),
          },
        })
      }

      // APPROVE
      const currentStep = instance.flow.steps.find(s => s.stepOrder === instance.currentStep)

      if (currentStep?.approvalMode === 'ALL') {
        const actions = await ctx.prisma.approvalAction.findMany({
          where: {
            stepInstanceId: currentStepInstance.id,
            action: 'APPROVE',
          },
        })
        const approvedBy = new Set(actions.map(a => a.actorId))
        approvedBy.add(input.actorId)

        if (approvedBy.size < assignedApprovers.length) {
          return instance
        }
      }

      await ctx.prisma.approvalStepInstance.update({
        where: { id: currentStepInstance.id },
        data: { status: 'APPROVED', completedAt: new Date() },
      })

      const nextStep = instance.flow.steps.find(s => s.stepOrder === instance.currentStep + 1)

      if (!nextStep) {
        return ctx.prisma.approvalInstance.update({
          where: { id: input.instanceId },
          data: {
            status: 'APPROVED',
            completedAt: new Date(),
          },
        })
      }

      const nextApprovers = await resolveApprovers(
        ctx.prisma,
        nextStep.approverType,
        nextStep.approverValue,
        instance.applicantId,
        instance.companyId
      )

      await ctx.prisma.approvalStepInstance.create({
        data: {
          instanceId: instance.id,
          stepId: nextStep.id,
          stepOrder: nextStep.stepOrder,
          assignedTo: JSON.stringify(nextApprovers),
          status: 'PENDING',
          dueAt: nextStep.timeoutHours > 0
            ? new Date(Date.now() + nextStep.timeoutHours * 60 * 60 * 1000)
            : null,
        },
      })

      return ctx.prisma.approvalInstance.update({
        where: { id: input.instanceId },
        data: { currentStep: nextStep.stepOrder },
      })
    }),

  // 取得審核實例詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalInstance.findUnique({
        where: { id: input.id },
        include: {
          flow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          stepInstances: {
            include: {
              step: true,
              actions: {
                orderBy: { actedAt: 'desc' },
              },
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
    }),

  // 取得待我審核的列表
  listPendingForMe: publicProcedure
    .input(z.object({ approverId: z.string() }))
    .query(async ({ ctx, input }) => {
      const pendingSteps = await ctx.prisma.approvalStepInstance.findMany({
        where: {
          status: 'PENDING',
          assignedTo: { contains: input.approverId },
        },
        include: {
          instance: {
            include: {
              flow: true,
            },
          },
          step: true,
        },
        orderBy: { assignedAt: 'asc' },
      })

      return pendingSteps
    }),

  // 取得申請的審核狀態
  getByReference: publicProcedure
    .input(z.object({
      module: z.string(),
      referenceId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalInstance.findUnique({
        where: {
          module_referenceId: {
            module: input.module,
            referenceId: input.referenceId,
          },
        },
        include: {
          flow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          stepInstances: {
            include: {
              step: true,
              actions: {
                orderBy: { actedAt: 'desc' },
              },
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
    }),
})
