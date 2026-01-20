import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { FlowModuleType, FlowAssigneeType } from '@prisma/client'

const MAX_APPROVAL_STEPS = 4

export const flowTemplateRouter = router({
  // 取得公司的所有流程範本
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.flowTemplate.findMany({
        where: { companyId: input.companyId },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: {
              position: { select: { id: true, name: true } },
              specificEmployee: { select: { id: true, name: true, employeeNo: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { moduleType: 'asc' },
      })
    }),

  // 取得單一流程範本
  getById: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.prisma.flowTemplate.findUnique({
        where: { id: input.id },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: {
              position: { select: { id: true, name: true } },
              specificEmployee: { select: { id: true, name: true, employeeNo: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
        },
      })

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '找不到流程範本',
        })
      }

      return template
    }),

  // 依公司+模組類型取得範本
  getByCompanyAndModule: publicProcedure
    .input(z.object({
      companyId: z.string(),
      moduleType: z.nativeEnum(FlowModuleType),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.flowTemplate.findUnique({
        where: {
          companyId_moduleType: {
            companyId: input.companyId,
            moduleType: input.moduleType,
          },
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: {
              position: { select: { id: true, name: true } },
              specificEmployee: { select: { id: true, name: true, employeeNo: true } },
            },
          },
        },
      })
    }),

  // 建立或更新流程範本
  upsert: publicProcedure
    .input(z.object({
      companyId: z.string(),
      moduleType: z.nativeEnum(FlowModuleType),
      name: z.string().min(1),
      description: z.string().optional(),
      createdById: z.string(),
      steps: z.array(z.object({
        stepOrder: z.number().min(1).max(MAX_APPROVAL_STEPS),
        name: z.string().min(1),
        assigneeType: z.nativeEnum(FlowAssigneeType),
        positionId: z.string().optional().nullable(),
        specificEmployeeId: z.string().optional().nullable(),
        isRequired: z.boolean().default(true),
      })).min(1).max(MAX_APPROVAL_STEPS),
    }))
    .mutation(async ({ ctx, input }) => {
      const { companyId, moduleType, name, description, createdById, steps } = input

      // 驗證步驟數量
      if (steps.length > MAX_APPROVAL_STEPS) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `審核層級最多 ${MAX_APPROVAL_STEPS} 層`,
        })
      }

      // 驗證每個步驟的審核人設定
      for (const step of steps) {
        if (step.assigneeType === 'POSITION' && !step.positionId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `步驟 ${step.stepOrder}「${step.name}」需要選擇職位`,
          })
        }
        if (step.assigneeType === 'SPECIFIC_PERSON' && !step.specificEmployeeId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `步驟 ${step.stepOrder}「${step.name}」需要選擇指定人員`,
          })
        }
      }

      // 查找是否已有該範本
      const existing = await ctx.prisma.flowTemplate.findUnique({
        where: {
          companyId_moduleType: { companyId, moduleType },
        },
      })

      if (existing) {
        // 更新現有範本
        return ctx.prisma.$transaction(async (tx) => {
          // 刪除舊步驟
          await tx.flowStep.deleteMany({
            where: { templateId: existing.id },
          })

          // 更新範本並建立新步驟
          return tx.flowTemplate.update({
            where: { id: existing.id },
            data: {
              name,
              description,
              version: { increment: 1 },
              steps: {
                create: steps.map((step) => ({
                  stepOrder: step.stepOrder,
                  name: step.name,
                  assigneeType: step.assigneeType,
                  positionId: step.assigneeType === 'POSITION' ? step.positionId : null,
                  specificEmployeeId: step.assigneeType === 'SPECIFIC_PERSON' ? step.specificEmployeeId : null,
                  isRequired: step.isRequired,
                })),
              },
            },
            include: {
              steps: {
                orderBy: { stepOrder: 'asc' },
              },
            },
          })
        })
      } else {
        // 建立新範本
        return ctx.prisma.flowTemplate.create({
          data: {
            companyId,
            moduleType,
            name,
            description,
            createdById,
            steps: {
              create: steps.map((step) => ({
                stepOrder: step.stepOrder,
                name: step.name,
                assigneeType: step.assigneeType,
                positionId: step.assigneeType === 'POSITION' ? step.positionId : null,
                specificEmployeeId: step.assigneeType === 'SPECIFIC_PERSON' ? step.specificEmployeeId : null,
                isRequired: step.isRequired,
              })),
            },
          },
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' },
            },
          },
        })
      }
    }),

  // 刪除流程範本
  delete: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否有進行中的流程
      const activeExecutions = await ctx.prisma.flowExecution.count({
        where: {
          templateId: input.id,
          status: 'PENDING',
        },
      })

      if (activeExecutions > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `有 ${activeExecutions} 個審核中的申請使用此流程，無法刪除`,
        })
      }

      return ctx.prisma.flowTemplate.delete({
        where: { id: input.id },
      })
    }),

  // 取得模組類型列表（用於下拉選單）
  getModuleTypes: publicProcedure
    .query(() => {
      return [
        { value: 'LEAVE', label: '請假申請' },
        { value: 'EXPENSE', label: '費用核銷' },
        { value: 'SEAL', label: '用印申請' },
        { value: 'CARD', label: '名片申請' },
        { value: 'STATIONERY', label: '文具申請' },
        { value: 'OVERTIME', label: '加班申請' },
        { value: 'BUSINESS_TRIP', label: '出差申請' },
      ]
    }),
})
