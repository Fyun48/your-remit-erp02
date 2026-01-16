import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { Decimal } from '@prisma/client/runtime/library'

// 申請明細項目 schema
const requestItemSchema = z.object({
  itemId: z.string(),
  itemCode: z.string(),
  itemName: z.string(),
  quantity: z.number().min(1),
  unitPrice: z.number(),
  subtotal: z.number(),
})

export const stationeryRouter = router({
  // ==================== 品項管理 ====================

  // 品項列表
  itemList: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        includeInactive: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
      }

      if (!input.includeInactive) {
        where.isActive = true
      }

      return ctx.prisma.stationeryItem.findMany({
        where,
        orderBy: { code: 'asc' },
      })
    }),

  // 單一品項查詢
  itemGetById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.stationeryItem.findUnique({
        where: { id: input.id },
      })
    }),

  // 低庫存品項
  itemLowStock: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.$queryRaw`
        SELECT * FROM stationery_items
        WHERE company_id = ${input.companyId}
          AND is_active = true
          AND stock <= alert_level
        ORDER BY stock ASC
      `
    }),

  // 新增品項
  itemCreate: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        code: z.string(),
        name: z.string(),
        unit: z.string(),
        unitPrice: z.number().min(0),
        stock: z.number().min(0).default(0),
        alertLevel: z.number().min(0).default(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 檢查代碼是否已存在
      const existing = await ctx.prisma.stationeryItem.findUnique({
        where: {
          companyId_code: {
            companyId: input.companyId,
            code: input.code,
          },
        },
      })

      if (existing) {
        throw new Error('品項代碼已存在')
      }

      return ctx.prisma.stationeryItem.create({
        data: {
          companyId: input.companyId,
          code: input.code,
          name: input.name,
          unit: input.unit,
          unitPrice: new Decimal(input.unitPrice),
          stock: input.stock,
          alertLevel: input.alertLevel,
        },
      })
    }),

  // 更新品項
  itemUpdate: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        unit: z.string().optional(),
        unitPrice: z.number().min(0).optional(),
        alertLevel: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, unitPrice, ...rest } = input

      const data: Record<string, unknown> = { ...rest }
      if (unitPrice !== undefined) {
        data.unitPrice = new Decimal(unitPrice)
      }

      return ctx.prisma.stationeryItem.update({
        where: { id },
        data,
      })
    }),

  // 調整庫存（進貨補充）
  itemAdjustStock: publicProcedure
    .input(
      z.object({
        id: z.string(),
        adjustment: z.number(), // 正數為補充，負數為扣除
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.stationeryItem.findUnique({
        where: { id: input.id },
      })

      if (!item) {
        throw new Error('品項不存在')
      }

      const newStock = item.stock + input.adjustment
      if (newStock < 0) {
        throw new Error('庫存不能為負數')
      }

      return ctx.prisma.stationeryItem.update({
        where: { id: input.id },
        data: { stock: newStock },
      })
    }),

  // 啟用/停用品項
  itemToggleActive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.stationeryItem.findUnique({
        where: { id: input.id },
      })

      if (!item) {
        throw new Error('品項不存在')
      }

      return ctx.prisma.stationeryItem.update({
        where: { id: input.id },
        data: { isActive: !item.isActive },
      })
    }),

  // ==================== 申請管理 ====================

  // 申請列表
  requestList: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        status: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
      }

      if (input.status) {
        where.status = input.status
      }

      if (input.search) {
        where.OR = [
          { requestNo: { contains: input.search, mode: 'insensitive' } },
          { applicant: { name: { contains: input.search, mode: 'insensitive' } } },
        ]
      }

      return ctx.prisma.stationeryRequest.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          applicant: { select: { id: true, name: true, employeeNo: true } },
          approvedBy: { select: { id: true, name: true } },
          issuedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 單筆查詢
  requestGetById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.stationeryRequest.findUnique({
        where: { id: input.id },
        include: {
          company: { select: { id: true, name: true } },
          applicant: { select: { id: true, name: true, employeeNo: true, email: true } },
          approvedBy: { select: { id: true, name: true } },
          issuedBy: { select: { id: true, name: true } },
        },
      })
    }),

  // 我的申請
  requestGetMy: publicProcedure
    .input(z.object({ applicantId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.stationeryRequest.findMany({
        where: { applicantId: input.applicantId },
        include: {
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 建立申請
  requestCreate: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        applicantId: z.string(),
        items: z.array(requestItemSchema).min(1),
        purpose: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 計算總金額
      const totalAmount = input.items.reduce((sum, item) => sum + item.subtotal, 0)

      // 產生申請單號 ST202601-0001
      const now = new Date()
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      const prefix = `ST${yearMonth}-`

      const lastRequest = await ctx.prisma.stationeryRequest.findFirst({
        where: { requestNo: { startsWith: prefix } },
        orderBy: { requestNo: 'desc' },
      })

      let seq = 1
      if (lastRequest) {
        const lastSeq = parseInt(lastRequest.requestNo.split('-')[1])
        seq = lastSeq + 1
      }

      const requestNo = `${prefix}${String(seq).padStart(4, '0')}`

      return ctx.prisma.stationeryRequest.create({
        data: {
          requestNo,
          companyId: input.companyId,
          applicantId: input.applicantId,
          items: input.items,
          totalAmount: new Decimal(totalAmount),
          purpose: input.purpose,
          status: 'DRAFT',
        },
      })
    }),

  // 更新申請
  requestUpdate: publicProcedure
    .input(
      z.object({
        id: z.string(),
        items: z.array(requestItemSchema).min(1).optional(),
        purpose: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.stationeryRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'DRAFT') {
        throw new Error('只有草稿狀態可以修改')
      }

      const data: Record<string, unknown> = {}

      if (input.items) {
        data.items = input.items
        data.totalAmount = new Decimal(
          input.items.reduce((sum, item) => sum + item.subtotal, 0)
        )
      }

      if (input.purpose !== undefined) {
        data.purpose = input.purpose
      }

      return ctx.prisma.stationeryRequest.update({
        where: { id: input.id },
        data,
      })
    }),

  // 提交審批
  requestSubmit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.stationeryRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'DRAFT') {
        throw new Error('只有草稿狀態可以提交')
      }

      return ctx.prisma.stationeryRequest.update({
        where: { id: input.id },
        data: { status: 'PENDING' },
      })
    }),

  // 取消申請
  requestCancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.stationeryRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (!['DRAFT', 'PENDING'].includes(request.status)) {
        throw new Error('此狀態無法取消')
      }

      return ctx.prisma.stationeryRequest.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      })
    }),

  // 核准
  requestApprove: publicProcedure
    .input(z.object({ id: z.string(), approverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.stationeryRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'PENDING') {
        throw new Error('只有待審核狀態可以核准')
      }

      return ctx.prisma.stationeryRequest.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          approvedById: input.approverId,
          approvedAt: new Date(),
        },
      })
    }),

  // 駁回
  requestReject: publicProcedure
    .input(z.object({ id: z.string(), approverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.stationeryRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'PENDING') {
        throw new Error('只有待審核狀態可以駁回')
      }

      return ctx.prisma.stationeryRequest.update({
        where: { id: input.id },
        data: {
          status: 'REJECTED',
          approvedById: input.approverId,
          approvedAt: new Date(),
        },
      })
    }),

  // 發放（扣除庫存）
  requestIssue: publicProcedure
    .input(z.object({ id: z.string(), issuerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.stationeryRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new Error('申請單不存在')
      }

      if (request.status !== 'APPROVED') {
        throw new Error('只有已核准狀態可以發放')
      }

      // 解析申請明細
      const items = request.items as Array<{
        itemId: string
        itemName: string
        quantity: number
      }>

      // 檢查庫存是否足夠
      for (const item of items) {
        const stockItem = await ctx.prisma.stationeryItem.findUnique({
          where: { id: item.itemId },
        })

        if (!stockItem) {
          throw new Error(`品項 ${item.itemName} 不存在`)
        }

        if (stockItem.stock < item.quantity) {
          throw new Error(`${item.itemName} 庫存不足（現有 ${stockItem.stock}，需要 ${item.quantity}）`)
        }
      }

      // 扣除庫存
      for (const item of items) {
        await ctx.prisma.stationeryItem.update({
          where: { id: item.itemId },
          data: { stock: { decrement: item.quantity } },
        })
      }

      // 更新申請狀態
      return ctx.prisma.stationeryRequest.update({
        where: { id: input.id },
        data: {
          status: 'ISSUED',
          issuedAt: new Date(),
          issuedById: input.issuerId,
        },
      })
    }),

  // ==================== 統計報表 ====================

  // 總覽統計
  statisticsOverview: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      const [
        totalThisMonth,
        totalThisYear,
        pendingCount,
        approvedCount,
        lowStockCount,
        monthlyAmount,
      ] = await Promise.all([
        // 本月申請數
        ctx.prisma.stationeryRequest.count({
          where: {
            companyId: input.companyId,
            createdAt: { gte: startOfMonth },
          },
        }),
        // 本年申請數
        ctx.prisma.stationeryRequest.count({
          where: {
            companyId: input.companyId,
            createdAt: { gte: startOfYear },
          },
        }),
        // 待審批數
        ctx.prisma.stationeryRequest.count({
          where: {
            companyId: input.companyId,
            status: 'PENDING',
          },
        }),
        // 待發放數
        ctx.prisma.stationeryRequest.count({
          where: {
            companyId: input.companyId,
            status: 'APPROVED',
          },
        }),
        // 低庫存品項數
        ctx.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM stationery_items
          WHERE company_id = ${input.companyId}
            AND is_active = true
            AND stock <= alert_level
        `.then((result) => Number(result[0]?.count || 0)),
        // 本月發放金額
        ctx.prisma.stationeryRequest.aggregate({
          where: {
            companyId: input.companyId,
            status: 'ISSUED',
            issuedAt: { gte: startOfMonth },
          },
          _sum: { totalAmount: true },
        }),
      ])

      return {
        totalThisMonth,
        totalThisYear,
        pendingCount,
        approvedCount,
        lowStockCount,
        monthlyAmount: monthlyAmount._sum.totalAmount?.toNumber() || 0,
      }
    }),

  // 熱門品項排行
  statisticsTopItems: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        limit: z.number().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // 取得已發放的申請單
      const requests = await ctx.prisma.stationeryRequest.findMany({
        where: {
          companyId: input.companyId,
          status: 'ISSUED',
        },
        select: { items: true },
      })

      // 統計各品項使用量
      const itemStats: Record<string, { name: string; totalQuantity: number }> = {}

      for (const request of requests) {
        const items = request.items as Array<{
          itemId: string
          itemName: string
          quantity: number
        }>

        for (const item of items) {
          if (!itemStats[item.itemId]) {
            itemStats[item.itemId] = { name: item.itemName, totalQuantity: 0 }
          }
          itemStats[item.itemId].totalQuantity += item.quantity
        }
      }

      // 轉換為陣列並排序
      const sorted = Object.entries(itemStats)
        .map(([itemId, data]) => ({
          itemId,
          name: data.name,
          totalQuantity: data.totalQuantity,
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, input.limit)

      return sorted
    }),
})
