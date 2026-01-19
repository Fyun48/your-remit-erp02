import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const projectRouter = router({
  // 取得專案列表
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      type: z.enum(['INTERNAL', 'CLIENT']).optional(),
      departmentId: z.string().optional(),
      managerId: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
      }

      if (input.status) where.status = input.status
      if (input.type) where.type = input.type
      if (input.departmentId) where.departmentId = input.departmentId
      if (input.managerId) where.managerId = input.managerId

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ]
      }

      return ctx.prisma.project.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true, employeeNo: true } },
          customer: { select: { id: true, name: true } },
          _count: {
            select: {
              phases: true,
              members: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })
    }),

  // 取得單一專案詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          company: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true, employeeNo: true } },
          customer: { select: { id: true, name: true } },
          phases: {
            orderBy: { sortOrder: 'asc' },
            include: {
              tasks: {
                orderBy: { createdAt: 'asc' },
                include: {
                  assignee: { select: { id: true, name: true } },
                  children: {
                    include: {
                      assignee: { select: { id: true, name: true } },
                    },
                  },
                },
                where: { parentId: null },
              },
            },
          },
          members: {
            include: {
              employee: { select: { id: true, name: true, employeeNo: true } },
            },
          },
        },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
      }

      return project
    }),

  // 建立專案
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1, '請輸入專案名稱'),
      description: z.string().optional(),
      type: z.enum(['INTERNAL', 'CLIENT']),
      visibility: z.enum(['PRIVATE', 'DEPARTMENT', 'COMPANY', 'CUSTOM']).default('DEPARTMENT'),
      plannedStartDate: z.date().optional(),
      plannedEndDate: z.date().optional(),
      companyId: z.string(),
      departmentId: z.string(),
      managerId: z.string(),
      customerId: z.string().optional(),
      memberIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { memberIds, ...projectData } = input

      const project = await ctx.prisma.project.create({
        data: {
          ...projectData,
          members: {
            create: [
              { employeeId: input.managerId, role: 'MANAGER' },
              ...(memberIds || [])
                .filter(id => id !== input.managerId)
                .map(employeeId => ({ employeeId, role: 'MEMBER' as const })),
            ],
          },
        },
        include: {
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
        },
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: project.id,
          actorId: input.managerId,
          action: 'CREATED',
          targetType: 'PROJECT',
          targetId: project.id,
          summary: `建立了專案「${project.name}」`,
        },
      })

      return project
    }),

  // 更新專案
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      visibility: z.enum(['PRIVATE', 'DEPARTMENT', 'COMPANY', 'CUSTOM']).optional(),
      plannedStartDate: z.date().nullable().optional(),
      plannedEndDate: z.date().nullable().optional(),
      actualStartDate: z.date().nullable().optional(),
      actualEndDate: z.date().nullable().optional(),
      qualityScore: z.number().min(1).max(5).optional(),
      updatedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, updatedById, ...data } = input

      const existing = await ctx.prisma.project.findUnique({ where: { id } })
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
      }

      const project = await ctx.prisma.project.update({
        where: { id },
        data,
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: id,
          actorId: updatedById,
          action: 'UPDATED',
          targetType: 'PROJECT',
          targetId: id,
          summary: `更新了專案資訊`,
        },
      })

      return project
    }),

  // 刪除專案
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.project.delete({ where: { id: input.id } })
      return { success: true }
    }),

  // ==================== 階段管理 ====================

  createPhase: publicProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1, '請輸入階段名稱'),
      description: z.string().optional(),
      plannedEndDate: z.date().optional(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { actorId, ...data } = input
      const maxOrder = await ctx.prisma.projectPhase.aggregate({
        where: { projectId: input.projectId },
        _max: { sortOrder: true },
      })

      const phase = await ctx.prisma.projectPhase.create({
        data: {
          ...data,
          sortOrder: (maxOrder._max.sortOrder || 0) + 1,
        },
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId,
          action: 'CREATED',
          targetType: 'PHASE',
          targetId: phase.id,
          summary: `新增了階段「${phase.name}」`,
        },
      })

      return phase
    }),

  updatePhase: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
      plannedEndDate: z.date().nullable().optional(),
      actualEndDate: z.date().nullable().optional(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, actorId, ...data } = input
      const phase = await ctx.prisma.projectPhase.update({
        where: { id },
        data,
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: phase.projectId,
          actorId,
          action: 'UPDATED',
          targetType: 'PHASE',
          targetId: phase.id,
          summary: `更新了階段「${phase.name}」`,
        },
      })

      return phase
    }),

  deletePhase: publicProcedure
    .input(z.object({
      id: z.string(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const phase = await ctx.prisma.projectPhase.findUnique({
        where: { id: input.id },
      })

      if (!phase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '階段不存在' })
      }

      await ctx.prisma.projectPhase.delete({ where: { id: input.id } })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: phase.projectId,
          actorId: input.actorId,
          action: 'DELETED',
          targetType: 'PHASE',
          targetId: input.id,
          summary: `刪除了階段「${phase.name}」`,
        },
      })

      return { success: true }
    }),

  reorderPhases: publicProcedure
    .input(z.object({
      projectId: z.string(),
      phaseIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = input.phaseIds.map((id, index) =>
        ctx.prisma.projectPhase.update({
          where: { id },
          data: { sortOrder: index + 1 },
        })
      )
      await ctx.prisma.$transaction(updates)
      return { success: true }
    }),
})
