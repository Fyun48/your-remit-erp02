import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { isGroupAdmin, getGroupPermissions } from '@/lib/group-permission'
import { auditCreate, auditDelete } from '@/lib/audit'
import type { GroupPermissionType } from '@prisma/client'

const groupPermissionTypeSchema = z.enum([
  'GROUP_ADMIN',
  'CROSS_COMPANY_VIEW',
  'CROSS_COMPANY_EDIT',
  'AUDIT_LOG_VIEW',
  'COMPANY_MANAGEMENT',
])

export const groupPermissionRouter = router({
  // 檢查目前使用者的權限
  myPermissions: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return getGroupPermissions(input.userId)
    }),

  // 檢查使用者是否為集團管理員
  isGroupAdmin: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return isGroupAdmin(input.userId)
    }),

  // 列出所有集團權限 (僅集團管理員)
  listAll: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await isGroupAdmin(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '僅集團管理員可檢視所有權限' })
      }

      return ctx.prisma.groupPermission.findMany({
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              email: true,
              assignments: {
                where: { isPrimary: true, status: 'ACTIVE' },
                include: {
                  company: { select: { name: true } },
                  position: { select: { name: true } },
                },
                take: 1,
              },
            },
          },
          grantedBy: {
            select: { id: true, name: true, employeeNo: true },
          },
        },
        orderBy: [{ permission: 'asc' }, { grantedAt: 'desc' }],
      })
    }),

  // 依員工取得權限
  getByEmployee: publicProcedure
    .input(z.object({
      userId: z.string(),
      employeeId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      // 只能查自己的，或是集團管理員可查所有人
      if (input.userId !== input.employeeId) {
        const hasPermission = await isGroupAdmin(input.userId)
        if (!hasPermission) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '無權限檢視他人的集團權限' })
        }
      }

      return ctx.prisma.groupPermission.findMany({
        where: { employeeId: input.employeeId },
        include: {
          grantedBy: {
            select: { id: true, name: true, employeeNo: true },
          },
        },
        orderBy: { permission: 'asc' },
      })
    }),

  // 授予權限 (僅集團管理員)
  grant: publicProcedure
    .input(z.object({
      userId: z.string(),
      employeeId: z.string(),
      permission: groupPermissionTypeSchema,
      expiresAt: z.date().optional(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await isGroupAdmin(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '僅集團管理員可授予權限' })
      }

      // 不能給自己授予 GROUP_ADMIN
      if (input.permission === 'GROUP_ADMIN' && input.employeeId === input.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不能給自己授予集團管理員權限' })
      }

      // 檢查員工是否存在
      const employee = await ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
      })
      if (!employee) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '員工不存在' })
      }

      // 使用 upsert 處理重複授權的情況
      const result = await ctx.prisma.groupPermission.upsert({
        where: {
          employeeId_permission: {
            employeeId: input.employeeId,
            permission: input.permission as GroupPermissionType,
          },
        },
        update: {
          isActive: true,
          grantedById: input.userId,
          grantedAt: new Date(),
          expiresAt: input.expiresAt,
          note: input.note,
        },
        create: {
          employeeId: input.employeeId,
          permission: input.permission as GroupPermissionType,
          grantedById: input.userId,
          expiresAt: input.expiresAt,
          note: input.note,
        },
      })

      await auditCreate('GroupPermission', result.id, result, input.userId)

      return result
    }),

  // 更新權限備註 (僅集團管理員)
  update: publicProcedure
    .input(z.object({
      userId: z.string(),
      employeeId: z.string(),
      permission: groupPermissionTypeSchema,
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await isGroupAdmin(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '僅集團管理員可編輯權限' })
      }

      const existing = await ctx.prisma.groupPermission.findUnique({
        where: {
          employeeId_permission: {
            employeeId: input.employeeId,
            permission: input.permission as GroupPermissionType,
          },
        },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '權限不存在' })
      }

      return ctx.prisma.groupPermission.update({
        where: {
          employeeId_permission: {
            employeeId: input.employeeId,
            permission: input.permission as GroupPermissionType,
          },
        },
        data: { note: input.note },
      })
    }),

  // 撤銷權限 (僅集團管理員)
  revoke: publicProcedure
    .input(z.object({
      userId: z.string(),
      employeeId: z.string(),
      permission: groupPermissionTypeSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await isGroupAdmin(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '僅集團管理員可撤銷權限' })
      }

      // 不能撤銷自己的 GROUP_ADMIN
      if (input.permission === 'GROUP_ADMIN' && input.employeeId === input.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不能撤銷自己的集團管理員權限' })
      }

      const existing = await ctx.prisma.groupPermission.findUnique({
        where: {
          employeeId_permission: {
            employeeId: input.employeeId,
            permission: input.permission as GroupPermissionType,
          },
        },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '權限不存在' })
      }

      // 軟刪除 - 設為 inactive
      const result = await ctx.prisma.groupPermission.update({
        where: {
          employeeId_permission: {
            employeeId: input.employeeId,
            permission: input.permission as GroupPermissionType,
          },
        },
        data: { isActive: false },
      })

      await auditDelete('GroupPermission', result.id, existing, input.userId)

      return result
    }),

  // 搜尋員工 (用於授權選擇)
  searchEmployees: publicProcedure
    .input(z.object({
      userId: z.string(),
      query: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await isGroupAdmin(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '僅集團管理員可搜尋員工' })
      }

      return ctx.prisma.employee.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: input.query } },
            { employeeNo: { contains: input.query } },
            { email: { contains: input.query } },
          ],
        },
        select: {
          id: true,
          name: true,
          employeeNo: true,
          email: true,
          assignments: {
            where: { isPrimary: true, status: 'ACTIVE' },
            include: {
              company: { select: { name: true } },
              position: { select: { name: true } },
            },
            take: 1,
          },
        },
        take: 10,
      })
    }),

  // 取得權限類型說明
  getPermissionTypes: publicProcedure
    .query(() => {
      return [
        {
          code: 'GROUP_ADMIN',
          name: '集團超級管理員',
          description: '擁有所有集團級權限，可管理所有分公司資料',
        },
        {
          code: 'CROSS_COMPANY_VIEW',
          name: '跨公司檢視',
          description: '可檢視所有分公司的資料',
        },
        {
          code: 'CROSS_COMPANY_EDIT',
          name: '跨公司編輯',
          description: '可編輯所有分公司的資料',
        },
        {
          code: 'AUDIT_LOG_VIEW',
          name: '稽核日誌檢視',
          description: '可檢視系統稽核日誌',
        },
        {
          code: 'COMPANY_MANAGEMENT',
          name: '公司管理',
          description: '可創建、編輯、停用公司',
        },
      ]
    }),
})
