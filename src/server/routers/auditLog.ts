import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { canViewAuditLog } from '@/lib/group-permission'

export const auditLogRouter = router({
  // 查詢稽核日誌 (需要權限)
  list: publicProcedure
    .input(z.object({
      userId: z.string(),
      // 篩選條件
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      action: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
      operatorId: z.string().optional(),
      companyId: z.string().optional(),
      // 日期範圍
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      // 分頁
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await canViewAuditLog(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無稽核日誌檢視權限' })
      }

      const where: Record<string, unknown> = {}

      if (input.entityType) where.entityType = input.entityType
      if (input.entityId) where.entityId = input.entityId
      if (input.action) where.action = input.action
      if (input.operatorId) where.operatorId = input.operatorId
      if (input.companyId) where.companyId = input.companyId

      if (input.startDate || input.endDate) {
        where.createdAt = {}
        if (input.startDate) (where.createdAt as Record<string, Date>).gte = input.startDate
        if (input.endDate) (where.createdAt as Record<string, Date>).lte = input.endDate
      }

      const [total, logs] = await Promise.all([
        ctx.prisma.auditLog.count({ where }),
        ctx.prisma.auditLog.findMany({
          where,
          include: {
            operator: {
              select: { id: true, name: true, employeeNo: true },
            },
            company: {
              select: { id: true, name: true, code: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
      ])

      return {
        logs,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      }
    }),

  // 取得單筆稽核日誌詳情
  getById: publicProcedure
    .input(z.object({
      userId: z.string(),
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await canViewAuditLog(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無稽核日誌檢視權限' })
      }

      return ctx.prisma.auditLog.findUnique({
        where: { id: input.id },
        include: {
          operator: {
            select: { id: true, name: true, employeeNo: true, email: true },
          },
          company: {
            select: { id: true, name: true, code: true },
          },
        },
      })
    }),

  // 取得實體的變更歷史
  getEntityHistory: publicProcedure
    .input(z.object({
      userId: z.string(),
      entityType: z.string(),
      entityId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await canViewAuditLog(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無稽核日誌檢視權限' })
      }

      return ctx.prisma.auditLog.findMany({
        where: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
        include: {
          operator: {
            select: { id: true, name: true, employeeNo: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得可用的實體類型
  getEntityTypes: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await canViewAuditLog(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無稽核日誌檢視權限' })
      }

      const types = await ctx.prisma.auditLog.groupBy({
        by: ['entityType'],
        _count: { entityType: true },
        orderBy: { entityType: 'asc' },
      })

      return types.map(t => ({
        type: t.entityType,
        count: t._count.entityType,
        label: getEntityTypeLabel(t.entityType),
      }))
    }),

  // 統計資料
  getStats: publicProcedure
    .input(z.object({
      userId: z.string(),
      days: z.number().default(7),
    }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await canViewAuditLog(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無稽核日誌檢視權限' })
      }

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - input.days)

      const [totalLogs, byAction, byEntityType, recentOperators] = await Promise.all([
        // 總筆數
        ctx.prisma.auditLog.count({
          where: { createdAt: { gte: startDate } },
        }),
        // 依操作類型統計
        ctx.prisma.auditLog.groupBy({
          by: ['action'],
          where: { createdAt: { gte: startDate } },
          _count: { action: true },
        }),
        // 依實體類型統計
        ctx.prisma.auditLog.groupBy({
          by: ['entityType'],
          where: { createdAt: { gte: startDate } },
          _count: { entityType: true },
          orderBy: { _count: { entityType: 'desc' } },
          take: 10,
        }),
        // 最活躍的操作者
        ctx.prisma.auditLog.groupBy({
          by: ['operatorId'],
          where: { createdAt: { gte: startDate } },
          _count: { operatorId: true },
          orderBy: { _count: { operatorId: 'desc' } },
          take: 5,
        }),
      ])

      // 取得操作者名稱
      const operatorIds = recentOperators.map(o => o.operatorId)
      const operators = await ctx.prisma.employee.findMany({
        where: { id: { in: operatorIds } },
        select: { id: true, name: true, employeeNo: true },
      })
      const operatorMap = new Map(operators.map(o => [o.id, o]))

      return {
        totalLogs,
        byAction: byAction.map(a => ({
          action: a.action,
          count: a._count.action,
          label: getActionLabel(a.action),
        })),
        byEntityType: byEntityType.map(e => ({
          entityType: e.entityType,
          count: e._count.entityType,
          label: getEntityTypeLabel(e.entityType),
        })),
        recentOperators: recentOperators.map(o => ({
          ...operatorMap.get(o.operatorId),
          count: o._count.operatorId,
        })),
      }
    }),
})

// 實體類型標籤
function getEntityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    Employee: '員工',
    Department: '部門',
    Position: '職位',
    Company: '公司',
    Group: '集團',
    GroupPermission: '集團權限',
    Customer: '客戶',
    Vendor: '供應商',
    Voucher: '傳票',
    VoucherLine: '傳票分錄',
    AccountChart: '會計科目',
    AccountingPeriod: '會計期間',
    LeaveRequest: '請假申請',
    ExpenseRequest: '費用報銷',
    AttendanceRecord: '出勤紀錄',
    ApprovalFlow: '審批流程',
    SealRequest: '用印申請',
    DocumentBorrow: '證件借用',
    BusinessCardRequest: '名片申請',
    StationeryRequest: '文具申請',
  }
  return labels[type] || type
}

// 操作類型標籤
function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE: '新增',
    UPDATE: '修改',
    DELETE: '刪除',
  }
  return labels[action] || action
}
