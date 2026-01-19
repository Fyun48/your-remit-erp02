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

  // ==================== 任務管理 ====================

  createTask: publicProcedure
    .input(z.object({
      phaseId: z.string(),
      parentId: z.string().optional(),
      name: z.string().min(1, '請輸入任務名稱'),
      description: z.string().optional(),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
      assigneeId: z.string().optional(),
      estimatedHours: z.number().optional(),
      startDate: z.date().optional(),
      dueDate: z.date().optional(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { actorId, ...data } = input

      const phase = await ctx.prisma.projectPhase.findUnique({
        where: { id: input.phaseId },
        select: { projectId: true },
      })

      if (!phase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '階段不存在' })
      }

      const task = await ctx.prisma.projectTask.create({
        data,
        include: {
          assignee: { select: { id: true, name: true } },
        },
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: phase.projectId,
          actorId,
          action: 'CREATED',
          targetType: 'TASK',
          targetId: task.id,
          summary: `新增了任務「${task.name}」`,
        },
      })

      return task
    }),

  updateTask: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
      assigneeId: z.string().nullable().optional(),
      estimatedHours: z.number().nullable().optional(),
      actualHours: z.number().nullable().optional(),
      startDate: z.date().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, actorId, ...data } = input

      const existing = await ctx.prisma.projectTask.findUnique({
        where: { id },
        include: { phase: { select: { projectId: true } } },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '任務不存在' })
      }

      const updateData: Record<string, unknown> = { ...data }
      if (data.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
        updateData.completedAt = new Date()
      } else if (data.status && data.status !== 'COMPLETED') {
        updateData.completedAt = null
      }

      const task = await ctx.prisma.projectTask.update({
        where: { id },
        data: updateData,
        include: {
          assignee: { select: { id: true, name: true } },
        },
      })

      let summary = `更新了任務「${task.name}」`
      if (data.status === 'COMPLETED') {
        summary = `完成了任務「${task.name}」`
      } else if (data.status === 'IN_PROGRESS' && existing.status === 'TODO') {
        summary = `開始執行任務「${task.name}」`
      }

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: existing.phase.projectId,
          actorId,
          action: data.status ? 'STATUS_CHANGED' : 'UPDATED',
          targetType: 'TASK',
          targetId: task.id,
          summary,
        },
      })

      return task
    }),

  deleteTask: publicProcedure
    .input(z.object({
      id: z.string(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.projectTask.findUnique({
        where: { id: input.id },
        include: { phase: { select: { projectId: true } } },
      })

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '任務不存在' })
      }

      await ctx.prisma.projectTask.delete({ where: { id: input.id } })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: task.phase.projectId,
          actorId: input.actorId,
          action: 'DELETED',
          targetType: 'TASK',
          targetId: input.id,
          summary: `刪除了任務「${task.name}」`,
        },
      })

      return { success: true }
    }),

  // ==================== 成員管理 ====================

  addMember: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeId: z.string(),
      role: z.enum(['MANAGER', 'MEMBER', 'OBSERVER']).default('MEMBER'),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { actorId, ...data } = input

      const existing = await ctx.prisma.projectMember.findUnique({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
      })

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '該員工已是專案成員' })
      }

      const member = await ctx.prisma.projectMember.create({
        data,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId,
          action: 'MEMBER_ADDED',
          targetType: 'MEMBER',
          targetId: member.id,
          summary: `將「${member.employee.name}」加入專案`,
        },
      })

      return member
    }),

  updateMemberRole: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeId: z.string(),
      role: z.enum(['MANAGER', 'MEMBER', 'OBSERVER']),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.projectMember.update({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
        data: { role: input.role },
        include: {
          employee: { select: { id: true, name: true } },
        },
      })

      const roleLabels = { MANAGER: '經理', MEMBER: '成員', OBSERVER: '觀察者' }

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId: input.actorId,
          action: 'MEMBER_ROLE_CHANGED',
          targetType: 'MEMBER',
          targetId: member.id,
          summary: `將「${member.employee.name}」的角色變更為${roleLabels[input.role]}`,
        },
      })

      return member
    }),

  removeMember: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeId: z.string(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.projectMember.findUnique({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
        include: {
          employee: { select: { name: true } },
        },
      })

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '成員不存在' })
      }

      await ctx.prisma.projectMember.update({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
        data: { leftAt: new Date() },
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId: input.actorId,
          action: 'MEMBER_REMOVED',
          targetType: 'MEMBER',
          targetId: member.id,
          summary: `將「${member.employee.name}」移出專案`,
        },
      })

      return { success: true }
    }),
})
