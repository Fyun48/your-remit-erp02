import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { PrismaClient } from '@prisma/client'

// 檢查是否為 SUPER_ADMIN（同時檢查 GroupPermission 和 Role）
async function checkSuperAdmin(prisma: PrismaClient, userId: string): Promise<boolean> {
  const [superAdminPermission, superAdminRole] = await Promise.all([
    prisma.groupPermission.findFirst({
      where: { employeeId: userId, permission: 'SUPER_ADMIN' },
    }),
    prisma.employeeAssignment.findFirst({
      where: {
        employeeId: userId,
        status: 'ACTIVE',
        role: { name: 'SUPER_ADMIN' },
      },
    }),
  ])
  return !!(superAdminPermission || superAdminRole)
}

// 預設的實體類型和操作
const defaultSettings = [
  { entityType: 'Employee', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'Department', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'Position', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'Company', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'Group', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'GroupPermission', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'Customer', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'Vendor', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'Voucher', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'AccountChart', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'AccountingPeriod', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'LeaveRequest', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'ExpenseRequest', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'AttendanceRecord', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'ApprovalFlow', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'SealRequest', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'BusinessCardRequest', actions: ['CREATE', 'UPDATE', 'DELETE'] },
  { entityType: 'StationeryRequest', actions: ['CREATE', 'UPDATE', 'DELETE'] },
]

// 實體類型標籤
const entityTypeLabels: Record<string, string> = {
  Employee: '員工',
  Department: '部門',
  Position: '職位',
  Company: '公司',
  Group: '集團',
  GroupPermission: '集團權限',
  Customer: '客戶',
  Vendor: '供應商',
  Voucher: '傳票',
  AccountChart: '會計科目',
  AccountingPeriod: '會計期間',
  LeaveRequest: '請假申請',
  ExpenseRequest: '費用報銷',
  AttendanceRecord: '出勤紀錄',
  ApprovalFlow: '審批流程',
  SealRequest: '用印申請',
  BusinessCardRequest: '名片申請',
  StationeryRequest: '文具申請',
}

const actionLabels: Record<string, string> = {
  CREATE: '新增',
  UPDATE: '修改',
  DELETE: '刪除',
}

export const auditSettingRouter = router({
  // 取得所有設定
  list: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 檢查是否為 SUPER_ADMIN（同時檢查 GroupPermission 和 Role）
      const isSuperAdmin = await checkSuperAdmin(ctx.prisma, input.userId)

      if (!isSuperAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只有超級管理員可以管理 Audit 設定' })
      }

      // 取得現有設定
      const existingSettings = await ctx.prisma.auditSetting.findMany()
      const settingsMap = new Map(
        existingSettings.map((s) => [`${s.entityType}:${s.action}`, s])
      )

      // 建立完整設定列表（包含預設值）
      const settings = []
      for (const entity of defaultSettings) {
        for (const action of entity.actions) {
          const key = `${entity.entityType}:${action}`
          const existing = settingsMap.get(key)
          settings.push({
            entityType: entity.entityType,
            entityTypeLabel: entityTypeLabels[entity.entityType] || entity.entityType,
            action,
            actionLabel: actionLabels[action] || action,
            isEnabled: existing ? existing.isEnabled : true, // 預設啟用
            id: existing?.id,
          })
        }
      }

      // 按實體類型分組
      const grouped: Record<string, typeof settings> = {}
      for (const setting of settings) {
        if (!grouped[setting.entityType]) {
          grouped[setting.entityType] = []
        }
        grouped[setting.entityType].push(setting)
      }

      return {
        settings,
        grouped,
        entityTypes: defaultSettings.map((e) => ({
          value: e.entityType,
          label: entityTypeLabels[e.entityType] || e.entityType,
        })),
      }
    }),

  // 更新設定
  update: publicProcedure
    .input(z.object({
      userId: z.string(),
      entityType: z.string(),
      action: z.string(),
      isEnabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否為 SUPER_ADMIN（同時檢查 GroupPermission 和 Role）
      const isSuperAdmin = await checkSuperAdmin(ctx.prisma, input.userId)

      if (!isSuperAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只有超級管理員可以管理 Audit 設定' })
      }

      // 使用 upsert 建立或更新設定
      return ctx.prisma.auditSetting.upsert({
        where: {
          entityType_action: {
            entityType: input.entityType,
            action: input.action,
          },
        },
        update: {
          isEnabled: input.isEnabled,
          updatedById: input.userId,
        },
        create: {
          entityType: input.entityType,
          action: input.action,
          isEnabled: input.isEnabled,
          updatedById: input.userId,
        },
      })
    }),

  // 批量更新（啟用/停用某個實體類型的所有操作）
  updateByEntityType: publicProcedure
    .input(z.object({
      userId: z.string(),
      entityType: z.string(),
      isEnabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否為 SUPER_ADMIN（同時檢查 GroupPermission 和 Role）
      const isSuperAdmin = await checkSuperAdmin(ctx.prisma, input.userId)

      if (!isSuperAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只有超級管理員可以管理 Audit 設定' })
      }

      const actions = ['CREATE', 'UPDATE', 'DELETE']
      const results = []

      for (const action of actions) {
        const result = await ctx.prisma.auditSetting.upsert({
          where: {
            entityType_action: {
              entityType: input.entityType,
              action,
            },
          },
          update: {
            isEnabled: input.isEnabled,
            updatedById: input.userId,
          },
          create: {
            entityType: input.entityType,
            action,
            isEnabled: input.isEnabled,
            updatedById: input.userId,
          },
        })
        results.push(result)
      }

      return results
    }),

  // 檢查某個操作是否需要記錄 Audit
  shouldAudit: publicProcedure
    .input(z.object({
      entityType: z.string(),
      action: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.prisma.auditSetting.findUnique({
        where: {
          entityType_action: {
            entityType: input.entityType,
            action: input.action,
          },
        },
      })

      // 如果沒有設定，預設啟用
      return setting ? setting.isEnabled : true
    }),
})
