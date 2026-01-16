import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import { isGroupAdmin } from '@/lib/group-permission'
import { TRPCError } from '@trpc/server'

export const groupRouter = router({
  // 取得所有集團
  list: publicProcedure.query(async () => {
    return prisma.group.findMany({
      include: {
        _count: {
          select: { companies: true },
        },
      },
      orderBy: { code: 'asc' },
    })
  }),

  // 取得單一集團
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return prisma.group.findUnique({
        where: { id: input.id },
        include: {
          companies: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
      })
    }),

  // 建立集團
  create: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(1, '名稱為必填'),
        code: z.string().min(1, '代碼為必填'),
      })
    )
    .mutation(async ({ input }) => {
      // 檢查權限
      const hasPermission = await isGroupAdmin(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您沒有權限建立集團' })
      }

      // 檢查代碼是否重複
      const existing = await prisma.group.findUnique({
        where: { code: input.code },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '集團代碼已存在' })
      }

      const group = await prisma.group.create({
        data: {
          name: input.name,
          code: input.code,
        },
      })

      // 記錄稽核日誌
      await prisma.auditLog.create({
        data: {
          operatorId: input.userId,
          action: 'CREATE',
          entityType: 'Group',
          entityId: group.id,
          newValue: { name: input.name, code: input.code },
        },
      })

      return group
    }),

  // 更新集團
  update: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        id: z.string(),
        name: z.string().min(1, '名稱為必填'),
      })
    )
    .mutation(async ({ input }) => {
      // 檢查權限
      const hasPermission = await isGroupAdmin(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您沒有權限更新集團' })
      }

      const oldGroup = await prisma.group.findUnique({
        where: { id: input.id },
      })
      if (!oldGroup) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '找不到集團' })
      }

      const group = await prisma.group.update({
        where: { id: input.id },
        data: { name: input.name },
      })

      // 記錄稽核日誌
      await prisma.auditLog.create({
        data: {
          operatorId: input.userId,
          action: 'UPDATE',
          entityType: 'Group',
          entityId: group.id,
          oldValue: { name: oldGroup.name },
          newValue: { name: input.name },
        },
      })

      return group
    }),

  // 停用/啟用集團
  toggleActive: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // 檢查權限
      const hasPermission = await isGroupAdmin(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您沒有權限停用集團' })
      }

      const group = await prisma.group.findUnique({
        where: { id: input.id },
        include: {
          companies: {
            where: { isActive: true },
          },
        },
      })

      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '找不到集團' })
      }

      // 如果要停用且有啟用中的公司，則不允許
      if (group.isActive && group.companies.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `此集團下有 ${group.companies.length} 家啟用中的公司，無法停用`,
        })
      }

      const updated = await prisma.group.update({
        where: { id: input.id },
        data: { isActive: !group.isActive },
      })

      // 記錄稽核日誌
      await prisma.auditLog.create({
        data: {
          operatorId: input.userId,
          action: 'UPDATE',
          entityType: 'Group',
          entityId: group.id,
          oldValue: { isActive: group.isActive },
          newValue: { isActive: updated.isActive },
        },
      })

      return updated
    }),
})
