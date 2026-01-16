import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import {
  getAllModules,
  getAssignableModules,
  getModulesGrouped,
  getEmployeePermissions,
  grantPermission,
  revokePermission,
  hasPermission,
  isCompanyManager,
} from '@/lib/permission'
import { isGroupAdmin } from '@/lib/group-permission'

export const permissionRouter = router({
  // 取得所有功能模組
  listModules: publicProcedure.query(() => {
    return getAllModules()
  }),

  // 取得可分配的功能模組（非基本權限）
  listAssignableModules: publicProcedure.query(() => {
    return getAssignableModules()
  }),

  // 取得功能模組（依模組分組）
  listModulesGrouped: publicProcedure.query(() => {
    return getModulesGrouped()
  }),

  // 取得員工的所有權限
  getEmployeePermissions: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ input }) => {
      return getEmployeePermissions(input.employeeId, input.companyId)
    }),

  // 檢查當前用戶是否有權限管理權
  canManagePermissions: publicProcedure
    .input(z.object({
      userId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ input }) => {
      // 集團管理員可以管理所有公司權限
      const groupAdmin = await isGroupAdmin(input.userId)
      if (groupAdmin) return { canManage: true, reason: 'GROUP_ADMIN' }

      // 公司管理人員（管理部 + 副總經理以上）可以管理該公司權限
      const companyManager = await isCompanyManager(input.userId, input.companyId)
      if (companyManager) return { canManage: true, reason: 'COMPANY_MANAGER' }

      return { canManage: false, reason: 'NO_PERMISSION' }
    }),

  // 取得公司所有員工的權限列表
  listCompanyEmployeePermissions: publicProcedure
    .input(z.object({
      userId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // 檢查權限
      const groupAdmin = await isGroupAdmin(input.userId)
      const companyManager = await isCompanyManager(input.userId, input.companyId)

      if (!groupAdmin && !companyManager) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無權限管理' })
      }

      // 取得公司所有員工
      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: {
          companyId: input.companyId,
          status: 'ACTIVE',
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              name: true,
              email: true,
            },
          },
          department: {
            select: { name: true },
          },
          position: {
            select: { name: true, level: true },
          },
          role: {
            select: { name: true },
          },
        },
        orderBy: [
          { department: { code: 'asc' } },
          { position: { level: 'desc' } },
        ],
      })

      // 取得每位員工的權限
      const result = await Promise.all(
        assignments.map(async (a) => {
          const perms = await getEmployeePermissions(a.employeeId, input.companyId)
          return {
            employeeId: a.employee.id,
            employeeNo: a.employee.employeeNo,
            name: a.employee.name,
            email: a.employee.email,
            department: a.department.name,
            position: a.position.name,
            positionLevel: a.position.level,
            role: a.role?.name || null,
            isGroupAdmin: perms.isGroupAdmin,
            isCompanyManager: perms.isCompanyManager,
            permissions: perms.permissions,
          }
        })
      )

      return result
    }),

  // 授予員工特殊權限
  grant: publicProcedure
    .input(z.object({
      userId: z.string(), // 操作者
      employeeId: z.string(), // 目標員工
      companyId: z.string(),
      permissionCode: z.string(),
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      // 檢查操作者權限
      const canManage = await hasPermission(input.userId, input.companyId, 'system.permission')
      if (!canManage) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無權限管理權限' })
      }

      await grantPermission(
        input.employeeId,
        input.companyId,
        input.permissionCode,
        input.userId,
        input.expiresAt
      )

      return { success: true }
    }),

  // 移除員工特殊權限
  revoke: publicProcedure
    .input(z.object({
      userId: z.string(), // 操作者
      employeeId: z.string(), // 目標員工
      companyId: z.string(),
      permissionCode: z.string(),
    }))
    .mutation(async ({ input }) => {
      // 檢查操作者權限
      const canManage = await hasPermission(input.userId, input.companyId, 'system.permission')
      if (!canManage) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無權限管理權限' })
      }

      await revokePermission(input.employeeId, input.companyId, input.permissionCode)

      return { success: true }
    }),

  // 批次更新員工權限
  batchUpdate: publicProcedure
    .input(z.object({
      userId: z.string(),
      employeeId: z.string(),
      companyId: z.string(),
      permissions: z.array(z.string()), // 要授予的權限列表
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查操作者權限
      const canManage = await hasPermission(input.userId, input.companyId, 'system.permission')
      if (!canManage) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無權限管理權限' })
      }

      // 取得目標員工現有的特殊權限
      const currentPermissions = await ctx.prisma.employeePermission.findMany({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
        },
        include: {
          permission: true,
        },
      })

      const currentCodes = currentPermissions.map(p => p.permission.code)
      const targetCodes = input.permissions

      // 要新增的權限
      const toGrant = targetCodes.filter(code => !currentCodes.includes(code))

      // 要移除的權限
      const toRevoke = currentCodes.filter(code => !targetCodes.includes(code))

      // 執行新增
      for (const code of toGrant) {
        await grantPermission(input.employeeId, input.companyId, code, input.userId)
      }

      // 執行移除
      for (const code of toRevoke) {
        await revokePermission(input.employeeId, input.companyId, code)
      }

      return { success: true, granted: toGrant.length, revoked: toRevoke.length }
    }),
})
