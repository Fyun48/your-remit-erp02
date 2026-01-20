import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { DelegationStatus, DelegationPermissionType } from '@prisma/client'

const MIN_CANCEL_REASON_LENGTH = 10

export const delegationRouter = router({
  // 取得公司的所有代理設定
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      status: z.nativeEnum(DelegationStatus).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.delegation.findMany({
        where: {
          companyId: input.companyId,
          ...(input.status && { status: input.status }),
        },
        include: {
          delegator: { select: { id: true, name: true, employeeNo: true } },
          delegate: { select: { id: true, name: true, employeeNo: true } },
          permissions: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得員工的代理關係（作為委託人或代理人）
  getMyDelegations: publicProcedure
    .input(z.object({
      employeeId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const [asDelegator, asDelegate] = await Promise.all([
        // 我委託給別人的
        ctx.prisma.delegation.findMany({
          where: {
            delegatorId: input.employeeId,
            status: { in: ['PENDING', 'ACCEPTED'] },
          },
          include: {
            delegate: { select: { id: true, name: true, employeeNo: true } },
            permissions: true,
            company: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        // 別人委託給我的
        ctx.prisma.delegation.findMany({
          where: {
            delegateId: input.employeeId,
            status: { in: ['PENDING', 'ACCEPTED'] },
          },
          include: {
            delegator: { select: { id: true, name: true, employeeNo: true } },
            permissions: true,
            company: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ])

      return { asDelegator, asDelegate }
    }),

  // 取得員工目前生效中的代理（用於 Header Banner）
  getActiveDelegations: publicProcedure
    .input(z.object({
      employeeId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      return ctx.prisma.delegation.findMany({
        where: {
          delegateId: input.employeeId,
          status: 'ACCEPTED',
          startDate: { lte: now },
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
        include: {
          delegator: { select: { id: true, name: true, employeeNo: true } },
          permissions: true,
          company: { select: { id: true, name: true } },
        },
      })
    }),

  // 建立代理邀請
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      delegatorId: z.string(),
      delegateId: z.string(),
      permissions: z.array(z.nativeEnum(DelegationPermissionType)).min(1),
      startDate: z.date(),
      endDate: z.date().optional().nullable(),
      createdById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { companyId, delegatorId, delegateId, permissions, startDate, endDate, createdById } = input

      // 不能指定自己為代理
      if (delegatorId === delegateId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '不能指定自己為代理人',
        })
      }

      // 檢查代理人是否有效（至少有一間公司在職）
      const delegateActiveAssignments = await ctx.prisma.employeeAssignment.count({
        where: {
          employeeId: delegateId,
          status: 'ACTIVE',
        },
      })

      if (delegateActiveAssignments === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '該員工已離職，無法擔任代理人',
        })
      }

      // 檢查是否已有進行中的代理
      const existingDelegation = await ctx.prisma.delegation.findFirst({
        where: {
          delegatorId,
          delegateId,
          companyId,
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      })

      if (existingDelegation) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '已有進行中的代理設定',
        })
      }

      // 建立代理
      const delegation = await ctx.prisma.delegation.create({
        data: {
          companyId,
          delegatorId,
          delegateId,
          startDate,
          endDate,
          createdById,
          permissions: {
            create: permissions.map((p) => ({ permissionType: p })),
          },
        },
        include: {
          delegator: { select: { id: true, name: true } },
          delegate: { select: { id: true, name: true } },
          permissions: true,
        },
      })

      // 建立通知給代理人
      await ctx.prisma.notification.create({
        data: {
          userId: delegateId,
          type: 'DELEGATION_REQUEST',
          title: '職務代理邀請',
          message: `${delegation.delegator.name} 邀請您擔任職務代理人`,
          refType: 'Delegation',
          refId: delegation.id,
          link: `/dashboard/hr/delegation/${delegation.id}`,
        },
      })

      return delegation
    }),

  // 接受代理
  accept: publicProcedure
    .input(z.object({
      id: z.string(),
      employeeId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const delegation = await ctx.prisma.delegation.findUnique({
        where: { id: input.id },
        include: {
          delegator: { select: { id: true, name: true } },
          delegate: { select: { id: true, name: true } },
        },
      })

      if (!delegation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '找不到代理設定',
        })
      }

      if (delegation.delegateId !== input.employeeId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您不是此代理的指定人',
        })
      }

      if (delegation.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '此代理邀請已處理',
        })
      }

      const updated = await ctx.prisma.delegation.update({
        where: { id: input.id },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      })

      // 通知委託人
      await ctx.prisma.notification.create({
        data: {
          userId: delegation.delegatorId,
          type: 'DELEGATION_ACCEPTED',
          title: '代理邀請已接受',
          message: `${delegation.delegate.name} 已接受您的代理邀請`,
          refType: 'Delegation',
          refId: delegation.id,
          link: `/dashboard/hr/delegation`,
        },
      })

      return updated
    }),

  // 拒絕代理
  reject: publicProcedure
    .input(z.object({
      id: z.string(),
      employeeId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const delegation = await ctx.prisma.delegation.findUnique({
        where: { id: input.id },
        include: {
          delegator: { select: { id: true, name: true } },
          delegate: { select: { id: true, name: true } },
        },
      })

      if (!delegation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '找不到代理設定',
        })
      }

      if (delegation.delegateId !== input.employeeId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您不是此代理的指定人',
        })
      }

      if (delegation.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '此代理邀請已處理',
        })
      }

      const updated = await ctx.prisma.delegation.update({
        where: { id: input.id },
        data: {
          status: 'REJECTED',
          respondedAt: new Date(),
          rejectReason: input.reason,
        },
      })

      // 通知委託人
      await ctx.prisma.notification.create({
        data: {
          userId: delegation.delegatorId,
          type: 'DELEGATION_REJECTED',
          title: '代理邀請被拒絕',
          message: `${delegation.delegate.name} 已拒絕您的代理邀請${input.reason ? `，原因：${input.reason}` : ''}`,
          refType: 'Delegation',
          refId: delegation.id,
          link: `/dashboard/hr/delegation`,
        },
      })

      return updated
    }),

  // 取消代理
  cancel: publicProcedure
    .input(z.object({
      id: z.string(),
      cancelledById: z.string(),
      reason: z.string().min(MIN_CANCEL_REASON_LENGTH, `取消原因至少 ${MIN_CANCEL_REASON_LENGTH} 個字`),
    }))
    .mutation(async ({ ctx, input }) => {
      const delegation = await ctx.prisma.delegation.findUnique({
        where: { id: input.id },
        include: {
          delegator: { select: { id: true, name: true } },
          delegate: { select: { id: true, name: true } },
        },
      })

      if (!delegation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '找不到代理設定',
        })
      }

      if (delegation.status !== 'ACCEPTED' && delegation.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '此代理已無法取消',
        })
      }

      const updated = await ctx.prisma.delegation.update({
        where: { id: input.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: input.cancelledById,
          cancelReason: input.reason,
        },
      })

      // 通知被影響的人（委託人或代理人）
      const notifyUserId = input.cancelledById === delegation.delegatorId
        ? delegation.delegateId
        : delegation.delegatorId

      const cancellerName = input.cancelledById === delegation.delegatorId
        ? delegation.delegator.name
        : delegation.delegate.name

      await ctx.prisma.notification.create({
        data: {
          userId: notifyUserId,
          type: 'DELEGATION_CANCELLED',
          title: '代理已取消',
          message: `${cancellerName} 已取消代理關係，原因：${input.reason}`,
          refType: 'Delegation',
          refId: delegation.id,
          link: `/dashboard/hr/delegation`,
        },
      })

      return updated
    }),

  // 取得權限類型列表
  getPermissionTypes: publicProcedure
    .query(() => {
      return [
        { value: 'APPROVE_LEAVE', label: '代理審核請假', category: 'approve' },
        { value: 'APPROVE_EXPENSE', label: '代理審核費用核銷', category: 'approve' },
        { value: 'APPROVE_SEAL', label: '代理審核用印', category: 'approve' },
        { value: 'APPROVE_CARD', label: '代理審核名片', category: 'approve' },
        { value: 'APPROVE_STATIONERY', label: '代理審核文具', category: 'approve' },
        { value: 'APPLY_LEAVE', label: '代理申請請假', category: 'apply' },
        { value: 'APPLY_EXPENSE', label: '代理申請費用核銷', category: 'apply' },
        { value: 'VIEW_REPORTS', label: '代理查看報表', category: 'view' },
      ]
    }),

  // 檢查員工是否可被指定為代理人
  checkCanBeDelegate: publicProcedure
    .input(z.object({
      employeeId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const activeAssignments = await ctx.prisma.employeeAssignment.count({
        where: {
          employeeId: input.employeeId,
          status: 'ACTIVE',
        },
      })

      return {
        canBeDelegate: activeAssignments > 0,
        reason: activeAssignments === 0 ? '該員工已離職，無法擔任代理人' : null,
      }
    }),
})
