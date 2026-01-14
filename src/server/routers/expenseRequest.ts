import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// 產生申請單號
function generateRequestNo(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `EX${date}${random}`
}

// 費用明細項目輸入 schema
const expenseItemInputSchema = z.object({
  categoryId: z.string(),
  date: z.date(),
  description: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('TWD'),
  receiptNo: z.string().optional(),
  receiptDate: z.date().optional(),
  vendorName: z.string().optional(),
  taxId: z.string().optional(),
  attachments: z.string().optional(),
  notes: z.string().optional(),
})

export const expenseRequestRouter = router({
  // 建立費用報銷申請
  create: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      periodStart: z.date(),
      periodEnd: z.date(),
      items: z.array(expenseItemInputSchema).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // 驗證所有費用類別並檢查限制
      const categoryIds = Array.from(new Set(input.items.map(item => item.categoryId)))
      const categories = await ctx.prisma.expenseCategory.findMany({
        where: {
          id: { in: categoryIds },
          isActive: true,
        },
      })

      const categoryMap = new Map(categories.map(c => [c.id, c]))

      // 驗證每個 item 的類別
      for (const item of input.items) {
        const category = categoryMap.get(item.categoryId)
        if (!category) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `費用類別不存在: ${item.categoryId}`,
          })
        }

        // 檢查單項金額限制
        if (category.maxAmountPerItem && item.amount > category.maxAmountPerItem) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `類別「${category.name}」單項金額不可超過 ${category.maxAmountPerItem}`,
          })
        }

        // 檢查是否需要收據
        if (category.requiresReceipt && !item.receiptNo && !item.attachments) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `類別「${category.name}」需要提供發票或收據`,
          })
        }
      }

      // 計算總金額
      const totalAmount = input.items.reduce((sum, item) => sum + item.amount, 0)

      // 取得直屬主管作為審核者
      const assignment = await ctx.prisma.employeeAssignment.findFirst({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'ACTIVE',
        },
      })

      // 建立申請單及明細
      return ctx.prisma.expenseRequest.create({
        data: {
          requestNo: generateRequestNo(),
          employeeId: input.employeeId,
          companyId: input.companyId,
          title: input.title,
          description: input.description,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          totalAmount,
          status: 'DRAFT',
          paymentStatus: 'UNPAID',
          currentApproverId: assignment?.supervisorId,
          items: {
            create: input.items.map(item => ({
              categoryId: item.categoryId,
              date: item.date,
              description: item.description,
              amount: item.amount,
              currency: item.currency,
              receiptNo: item.receiptNo,
              receiptDate: item.receiptDate,
              vendorName: item.vendorName,
              taxId: item.taxId,
              attachments: item.attachments,
              notes: item.notes,
            })),
          },
        },
        include: { items: { include: { category: true } } },
      })
    }),

  // 更新草稿狀態的費用報銷申請
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿狀態的申請單可以修改' })
      }

      const { id, ...data } = input
      return ctx.prisma.expenseRequest.update({
        where: { id },
        data,
        include: { items: { include: { category: true } } },
      })
    }),

  // 新增費用明細項目
  addItem: publicProcedure
    .input(z.object({
      requestId: z.string(),
      item: expenseItemInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: input.requestId },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿狀態的申請單可以新增明細' })
      }

      // 驗證費用類別
      const category = await ctx.prisma.expenseCategory.findUnique({
        where: { id: input.item.categoryId },
      })

      if (!category || !category.isActive) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '費用類別不存在' })
      }

      // 檢查單項金額限制
      if (category.maxAmountPerItem && input.item.amount > category.maxAmountPerItem) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `類別「${category.name}」單項金額不可超過 ${category.maxAmountPerItem}`,
        })
      }

      // 檢查是否需要收據
      if (category.requiresReceipt && !input.item.receiptNo && !input.item.attachments) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `類別「${category.name}」需要提供發票或收據`,
        })
      }

      // 建立明細項目
      await ctx.prisma.expenseItem.create({
        data: {
          requestId: input.requestId,
          categoryId: input.item.categoryId,
          date: input.item.date,
          description: input.item.description,
          amount: input.item.amount,
          currency: input.item.currency,
          receiptNo: input.item.receiptNo,
          receiptDate: input.item.receiptDate,
          vendorName: input.item.vendorName,
          taxId: input.item.taxId,
          attachments: input.item.attachments,
          notes: input.item.notes,
        },
      })

      // 更新總金額（使用原子操作避免競態條件）
      return ctx.prisma.expenseRequest.update({
        where: { id: input.requestId },
        data: { totalAmount: { increment: input.item.amount } },
        include: { items: { include: { category: true } } },
      })
    }),

  // 移除費用明細項目
  removeItem: publicProcedure
    .input(z.object({
      requestId: z.string(),
      itemId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: input.requestId },
        include: { items: true },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿狀態的申請單可以刪除明細' })
      }

      const item = request.items.find(i => i.id === input.itemId)
      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '費用明細不存在' })
      }

      // 刪除明細項目
      await ctx.prisma.expenseItem.delete({
        where: { id: input.itemId },
      })

      // 更新總金額（使用原子操作避免競態條件）
      return ctx.prisma.expenseRequest.update({
        where: { id: input.requestId },
        data: { totalAmount: { decrement: item.amount } },
        include: { items: { include: { category: true } } },
      })
    }),

  // 送出申請
  submit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: input.id },
        include: { items: { include: { category: true } } },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以送出' })
      }

      if (request.items.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '請至少新增一筆費用明細' })
      }

      // 匹配適用的審核流程
      const flows = await ctx.prisma.approvalFlow.findMany({
        where: {
          module: 'expense',
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: request.companyId },
          ],
        },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
        },
        orderBy: [{ companyId: 'desc' }, { sortOrder: 'asc' }],
      })

      // 找到匹配的流程（基於金額條件）
      let matchedFlow = null
      for (const flow of flows) {
        if (!flow.conditions) {
          if (flow.isDefault) {
            matchedFlow = flow
            break
          }
          continue
        }

        try {
          const conditions = JSON.parse(flow.conditions)
          let match = true

          // 費用報銷以金額為條件
          if (conditions.minAmount && request.totalAmount < conditions.minAmount) match = false
          if (conditions.maxAmount && request.totalAmount > conditions.maxAmount) match = false

          if (match) {
            matchedFlow = flow
            break
          }
        } catch {
          continue
        }
      }

      if (!matchedFlow) {
        matchedFlow = flows.find(f => f.isDefault) || flows[0]
      }

      // 更新費用報銷申請狀態
      const updatedRequest = await ctx.prisma.expenseRequest.update({
        where: { id: input.id },
        data: {
          status: 'PENDING',
          submittedAt: new Date(),
        },
      })

      // 如果有審核流程，建立審核實例
      if (matchedFlow && matchedFlow.steps.length > 0) {
        const firstStep = matchedFlow.steps[0]

        // 解析第一關審核者
        const assignment = await ctx.prisma.employeeAssignment.findFirst({
          where: { employeeId: request.employeeId, companyId: request.companyId, status: 'ACTIVE' },
        })

        let approvers: string[] = []
        if (firstStep.approverType === 'SUPERVISOR' && assignment?.supervisorId) {
          approvers = [assignment.supervisorId]
        }

        // 建立審核實例
        const instance = await ctx.prisma.approvalInstance.create({
          data: {
            flowId: matchedFlow.id,
            module: 'expense',
            referenceId: request.id,
            applicantId: request.employeeId,
            companyId: request.companyId,
            status: 'IN_PROGRESS',
            currentStep: 1,
          },
        })

        // 建立第一個關卡實例
        await ctx.prisma.approvalStepInstance.create({
          data: {
            instanceId: instance.id,
            stepId: firstStep.id,
            stepOrder: 1,
            assignedTo: JSON.stringify(approvers),
            status: 'PENDING',
          },
        })

        // 更新費用報銷申請的當前審核者
        await ctx.prisma.expenseRequest.update({
          where: { id: input.id },
          data: { currentApproverId: approvers[0] || null },
        })
      }

      return updatedRequest
    }),

  // 審核（核准/拒絕）
  approve: publicProcedure
    .input(z.object({
      id: z.string(),
      action: z.enum(['APPROVE', 'REJECT']),
      approverId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: input.id },
        include: { items: { include: { category: true } } },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請單無法審核' })
      }

      // 查找審核實例
      const instance = await ctx.prisma.approvalInstance.findUnique({
        where: {
          module_referenceId: {
            module: 'expense',
            referenceId: input.id,
          },
        },
        include: {
          flow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          stepInstances: {
            where: { status: 'PENDING' },
            include: { step: true },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })

      if (instance && instance.stepInstances.length > 0) {
        const currentStepInstance = instance.stepInstances[0]

        // 記錄審核動作
        await ctx.prisma.approvalAction.create({
          data: {
            stepInstanceId: currentStepInstance.id,
            actorId: input.approverId,
            action: input.action,
            comment: input.comment,
          },
        })

        if (input.action === 'REJECT') {
          // 拒絕：結束審核流程
          await ctx.prisma.approvalStepInstance.update({
            where: { id: currentStepInstance.id },
            data: { status: 'REJECTED', completedAt: new Date() },
          })

          await ctx.prisma.approvalInstance.update({
            where: { id: instance.id },
            data: { status: 'REJECTED', completedAt: new Date() },
          })

          return ctx.prisma.expenseRequest.update({
            where: { id: input.id },
            data: {
              status: 'REJECTED',
              processedAt: new Date(),
              rejectedById: input.approverId,
              approvalComment: input.comment,
            },
          })
        }

        // 核准當前關卡
        await ctx.prisma.approvalStepInstance.update({
          where: { id: currentStepInstance.id },
          data: { status: 'APPROVED', completedAt: new Date() },
        })

        // 檢查是否有下一關
        const nextStep = instance.flow.steps.find(s => s.stepOrder === instance.currentStep + 1)

        if (nextStep) {
          // 有下一關，建立下一關卡實例
          const assignment = await ctx.prisma.employeeAssignment.findFirst({
            where: { employeeId: request.employeeId, companyId: request.companyId, status: 'ACTIVE' },
          })

          let nextApprovers: string[] = []
          if (nextStep.approverType === 'SUPERVISOR' && assignment?.supervisorId) {
            // 找上一層主管
            const supervisor = await ctx.prisma.employeeAssignment.findUnique({
              where: { id: assignment.supervisorId },
            })
            if (supervisor?.supervisorId) {
              nextApprovers = [supervisor.supervisorId]
            }
          }

          await ctx.prisma.approvalStepInstance.create({
            data: {
              instanceId: instance.id,
              stepId: nextStep.id,
              stepOrder: nextStep.stepOrder,
              assignedTo: JSON.stringify(nextApprovers),
              status: 'PENDING',
            },
          })

          await ctx.prisma.approvalInstance.update({
            where: { id: instance.id },
            data: { currentStep: nextStep.stepOrder },
          })

          // 更新費用報銷申請的當前審核者
          return ctx.prisma.expenseRequest.update({
            where: { id: input.id },
            data: { currentApproverId: nextApprovers[0] || null },
          })
        }

        // 無下一關，流程完成
        await ctx.prisma.approvalInstance.update({
          where: { id: instance.id },
          data: { status: 'APPROVED', completedAt: new Date() },
        })
      }

      // 更新費用報銷申請為已核准
      return ctx.prisma.expenseRequest.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
          approvedById: input.approverId,
          approvalComment: input.comment,
          // 付款狀態維持 UNPAID，等待後續付款流程處理
        },
      })
    }),

  // 取消申請
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (!['DRAFT', 'PENDING'].includes(request.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請單無法取消' })
      }

      // 如果有審核實例，也要取消
      await ctx.prisma.approvalInstance.updateMany({
        where: {
          module: 'expense',
          referenceId: input.id,
          status: 'IN_PROGRESS',
        },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      })

      return ctx.prisma.expenseRequest.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      })
    }),

  // 取得我的費用報銷列表
  listMine: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const year = input.year || new Date().getFullYear()
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year, 11, 31)

      return ctx.prisma.expenseRequest.findMany({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          periodStart: { gte: startOfYear, lte: endOfYear },
        },
        include: { items: { include: { category: true } } },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得待審核列表（主管用）
  listPending: publicProcedure
    .input(z.object({ approverId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 取得此主管的下屬
      const subordinates = await ctx.prisma.employeeAssignment.findMany({
        where: { supervisorId: input.approverId, status: 'ACTIVE' },
        select: { employeeId: true, companyId: true },
      })

      if (subordinates.length === 0) return []

      return ctx.prisma.expenseRequest.findMany({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({
            employeeId: s.employeeId,
            companyId: s.companyId,
          })),
        },
        include: { items: { include: { category: true } } },
        orderBy: { submittedAt: 'asc' },
      })
    }),

  // 取得單一申請詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.expenseRequest.findUnique({
        where: { id: input.id },
        include: { items: { include: { category: true } } },
      })
    }),
})
