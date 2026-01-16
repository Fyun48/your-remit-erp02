import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const sealRequestRouter = router({
  // 取得用印申請列表
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
      sealType: z.enum(['COMPANY_SEAL', 'COMPANY_SMALL_SEAL', 'CONTRACT_SEAL', 'INVOICE_SEAL', 'BOARD_SEAL', 'BANK_SEAL']).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { companyId: input.companyId }
      if (input.status) where.status = input.status
      if (input.sealType) where.sealType = input.sealType
      if (input.startDate || input.endDate) {
        where.createdAt = {}
        if (input.startDate) (where.createdAt as Record<string, unknown>).gte = input.startDate
        if (input.endDate) (where.createdAt as Record<string, unknown>).lte = input.endDate
      }

      return ctx.prisma.sealRequest.findMany({
        where,
        include: {
          applicant: { select: { id: true, name: true, employeeNo: true } },
          processedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得單一申請
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.prisma.sealRequest.findUnique({
        where: { id: input.id },
        include: {
          company: { select: { id: true, name: true } },
          applicant: { select: { id: true, name: true, employeeNo: true, email: true } },
          processedBy: { select: { id: true, name: true } },
        },
      })
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }
      return request
    }),

  // 取得我的申請列表
  getMyRequests: publicProcedure
    .input(z.object({
      applicantId: z.string(),
      status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { applicantId: input.applicantId }
      if (input.status) where.status = input.status

      return ctx.prisma.sealRequest.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得待審批清單 (根據審批流程)
  getPendingApproval: publicProcedure
    .input(z.object({
      companyId: z.string(),
      approverId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // 找出待審批的申請 (狀態為 PENDING)
      return ctx.prisma.sealRequest.findMany({
        where: {
          companyId: input.companyId,
          status: 'PENDING',
        },
        include: {
          applicant: { select: { id: true, name: true, employeeNo: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
    }),

  // 取得逾期未歸還清單
  getOverdue: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      return ctx.prisma.sealRequest.findMany({
        where: {
          companyId: input.companyId,
          isCarryOut: true,
          status: { in: ['APPROVED', 'PROCESSING', 'COMPLETED'] },
          actualReturn: null,
          expectedReturn: { lt: now },
        },
        include: {
          applicant: { select: { id: true, name: true, employeeNo: true } },
        },
        orderBy: { expectedReturn: 'asc' },
      })
    }),

  // 建立申請
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      applicantId: z.string(),
      sealType: z.enum(['COMPANY_SEAL', 'COMPANY_SMALL_SEAL', 'CONTRACT_SEAL', 'INVOICE_SEAL', 'BOARD_SEAL', 'BANK_SEAL']),
      purpose: z.string().min(1, '請填寫用途說明'),
      documentName: z.string().optional(),
      documentCount: z.number().min(1).default(1),
      isCarryOut: z.boolean().default(false),
      expectedReturn: z.date().optional(),
      attachments: z.array(z.object({
        name: z.string(),
        url: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 產生申請單號 SR202601-0001
      const now = new Date()
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

      const lastRequest = await ctx.prisma.sealRequest.findFirst({
        where: {
          requestNo: { startsWith: `SR${yearMonth}` },
        },
        orderBy: { requestNo: 'desc' },
      })

      let sequence = 1
      if (lastRequest) {
        const lastSeq = parseInt(lastRequest.requestNo.slice(-4))
        sequence = lastSeq + 1
      }
      const requestNo = `SR${yearMonth}-${String(sequence).padStart(4, '0')}`

      // 如果攜出必須填寫預計歸還時間
      if (input.isCarryOut && !input.expectedReturn) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '攜出印章需填寫預計歸還時間' })
      }

      return ctx.prisma.sealRequest.create({
        data: {
          requestNo,
          companyId: input.companyId,
          applicantId: input.applicantId,
          sealType: input.sealType,
          purpose: input.purpose,
          documentName: input.documentName,
          documentCount: input.documentCount,
          isCarryOut: input.isCarryOut,
          expectedReturn: input.expectedReturn,
          attachments: input.attachments,
          status: 'DRAFT',
        },
      })
    }),

  // 更新草稿
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      sealType: z.enum(['COMPANY_SEAL', 'COMPANY_SMALL_SEAL', 'CONTRACT_SEAL', 'INVOICE_SEAL', 'BOARD_SEAL', 'BANK_SEAL']).optional(),
      purpose: z.string().optional(),
      documentName: z.string().optional(),
      documentCount: z.number().min(1).optional(),
      isCarryOut: z.boolean().optional(),
      expectedReturn: z.date().nullable().optional(),
      attachments: z.array(z.object({
        name: z.string(),
        url: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.sealRequest.findUnique({
        where: { id: input.id },
      })
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }
      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能編輯草稿狀態的申請' })
      }

      const { id, ...data } = input
      return ctx.prisma.sealRequest.update({
        where: { id },
        data,
      })
    }),

  // 提交審批
  submit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.sealRequest.findUnique({
        where: { id: input.id },
      })
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }
      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能提交草稿狀態的申請' })
      }

      // 查找適用的審批流程
      const approvalFlow = await ctx.prisma.approvalFlow.findFirst({
        where: {
          companyId: request.companyId,
          module: 'seal',
          isActive: true,
        },
      })

      // 如果有審批流程，建立審批實例
      let approvalInstanceId: string | null = null
      if (approvalFlow) {
        const instance = await ctx.prisma.approvalInstance.create({
          data: {
            flowId: approvalFlow.id,
            module: 'seal',
            referenceId: request.id,
            applicantId: request.applicantId,
            companyId: request.companyId,
            status: 'IN_PROGRESS',
          },
        })
        approvalInstanceId = instance.id
      }

      return ctx.prisma.sealRequest.update({
        where: { id: input.id },
        data: {
          status: 'PENDING',
          approvalInstanceId,
        },
      })
    }),

  // 取消申請
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.sealRequest.findUnique({
        where: { id: input.id },
      })
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }
      if (!['DRAFT', 'PENDING'].includes(request.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能取消草稿或待審核的申請' })
      }

      return ctx.prisma.sealRequest.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      })
    }),

  // 核准
  approve: publicProcedure
    .input(z.object({
      id: z.string(),
      approverId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.sealRequest.findUnique({
        where: { id: input.id },
      })
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }
      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能核准待審核的申請' })
      }

      // 更新審批實例狀態
      if (request.approvalInstanceId) {
        await ctx.prisma.approvalInstance.update({
          where: { id: request.approvalInstanceId },
          data: {
            status: 'APPROVED',
            completedAt: new Date(),
          },
        })
      }

      return ctx.prisma.sealRequest.update({
        where: { id: input.id },
        data: { status: 'APPROVED' },
      })
    }),

  // 駁回
  reject: publicProcedure
    .input(z.object({
      id: z.string(),
      approverId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.sealRequest.findUnique({
        where: { id: input.id },
      })
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }
      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能駁回待審核的申請' })
      }

      // 更新審批實例狀態
      if (request.approvalInstanceId) {
        await ctx.prisma.approvalInstance.update({
          where: { id: request.approvalInstanceId },
          data: {
            status: 'REJECTED',
            completedAt: new Date(),
          },
        })
      }

      return ctx.prisma.sealRequest.update({
        where: { id: input.id },
        data: { status: 'REJECTED' },
      })
    }),

  // 開始用印處理
  startProcessing: publicProcedure
    .input(z.object({
      id: z.string(),
      processedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.sealRequest.findUnique({
        where: { id: input.id },
      })
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }
      if (request.status !== 'APPROVED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能處理已核准的申請' })
      }

      return ctx.prisma.sealRequest.update({
        where: { id: input.id },
        data: {
          status: 'PROCESSING',
          processedById: input.processedById,
          processedAt: new Date(),
        },
      })
    }),

  // 完成用印
  complete: publicProcedure
    .input(z.object({
      id: z.string(),
      processedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.sealRequest.findUnique({
        where: { id: input.id },
      })
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }
      if (!['APPROVED', 'PROCESSING'].includes(request.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能完成已核准或處理中的申請' })
      }

      return ctx.prisma.sealRequest.update({
        where: { id: input.id },
        data: {
          status: 'COMPLETED',
          processedById: input.processedById,
          completedAt: new Date(),
        },
      })
    }),

  // 確認歸還
  confirmReturn: publicProcedure
    .input(z.object({
      id: z.string(),
      returnNote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.sealRequest.findUnique({
        where: { id: input.id },
      })
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }
      if (!request.isCarryOut) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請不需要歸還' })
      }
      if (request.actualReturn) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '已歸還' })
      }

      return ctx.prisma.sealRequest.update({
        where: { id: input.id },
        data: {
          actualReturn: new Date(),
          returnNote: input.returnNote,
        },
      })
    }),

  // 統計數據
  statistics: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      const [
        totalThisMonth,
        totalThisYear,
        pendingCount,
        processingCount,
        overdueCount,
        byType,
      ] = await Promise.all([
        // 本月申請數
        ctx.prisma.sealRequest.count({
          where: {
            companyId: input.companyId,
            createdAt: { gte: startOfMonth },
          },
        }),
        // 本年申請數
        ctx.prisma.sealRequest.count({
          where: {
            companyId: input.companyId,
            createdAt: { gte: startOfYear },
          },
        }),
        // 待審批數
        ctx.prisma.sealRequest.count({
          where: {
            companyId: input.companyId,
            status: 'PENDING',
          },
        }),
        // 處理中數量
        ctx.prisma.sealRequest.count({
          where: {
            companyId: input.companyId,
            status: 'PROCESSING',
          },
        }),
        // 逾期未歸還
        ctx.prisma.sealRequest.count({
          where: {
            companyId: input.companyId,
            isCarryOut: true,
            status: { in: ['APPROVED', 'PROCESSING', 'COMPLETED'] },
            actualReturn: null,
            expectedReturn: { lt: now },
          },
        }),
        // 按類型統計
        ctx.prisma.sealRequest.groupBy({
          by: ['sealType'],
          where: {
            companyId: input.companyId,
            createdAt: { gte: startOfYear },
          },
          _count: true,
        }),
      ])

      return {
        totalThisMonth,
        totalThisYear,
        pendingCount,
        processingCount,
        overdueCount,
        byType,
      }
    }),
})
