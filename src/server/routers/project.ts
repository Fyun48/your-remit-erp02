import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { createNotification, createNotifications } from '@/lib/notification-service'

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

      // 記錄稽核紀錄
      await ctx.prisma.projectAuditLog.create({
        data: {
          projectId: project.id,
          actorId: input.managerId,
          action: 'CREATE',
          targetType: 'PROJECT',
          targetId: project.id,
          afterData: {
            name: project.name,
            type: input.type,
            visibility: input.visibility,
            companyId: input.companyId,
            departmentId: input.departmentId,
            managerId: input.managerId,
          },
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

      // 記錄稽核紀錄（包含變更前後資料）
      const changedFields: Record<string, unknown> = {}
      const beforeFields: Record<string, unknown> = {}

      if (data.name !== undefined && data.name !== existing.name) {
        beforeFields.name = existing.name
        changedFields.name = data.name
      }
      if (data.status !== undefined && data.status !== existing.status) {
        beforeFields.status = existing.status
        changedFields.status = data.status
      }
      if (data.visibility !== undefined && data.visibility !== existing.visibility) {
        beforeFields.visibility = existing.visibility
        changedFields.visibility = data.visibility
      }
      if (data.qualityScore !== undefined && data.qualityScore !== existing.qualityScore) {
        beforeFields.qualityScore = existing.qualityScore
        changedFields.qualityScore = data.qualityScore
      }

      if (Object.keys(changedFields).length > 0) {
        await ctx.prisma.projectAuditLog.create({
          data: {
            projectId: id,
            actorId: updatedById,
            action: data.status !== existing.status ? 'STATUS_CHANGE' : 'UPDATE',
            targetType: 'PROJECT',
            targetId: id,
            beforeData: beforeFields as object,
            afterData: changedFields as object,
          },
        })
      }

      return project
    }),

  // 刪除專案
  delete: publicProcedure
    .input(z.object({
      id: z.string(),
      deletedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 取得專案資料作為稽核紀錄
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        select: {
          name: true,
          type: true,
          status: true,
          companyId: true,
          departmentId: true,
          managerId: true,
        },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
      }

      // 記錄稽核紀錄（刪除前）
      await ctx.prisma.projectAuditLog.create({
        data: {
          projectId: input.id,
          actorId: input.deletedById,
          action: 'DELETE',
          targetType: 'PROJECT',
          targetId: input.id,
          beforeData: project,
        },
      })

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

      // Send notification if task is assigned
      if (input.assigneeId && input.assigneeId !== actorId) {
        const actor = await ctx.prisma.employee.findUnique({
          where: { id: actorId },
          select: { name: true },
        })
        const project = await ctx.prisma.project.findUnique({
          where: { id: phase.projectId },
          select: { name: true },
        })

        try {
          await createNotification({
            userId: input.assigneeId,
            type: 'TASK_ASSIGNED',
            title: '您有新的任務指派',
            message: `${actor?.name || '某人'} 在專案「${project?.name}」中指派任務「${task.name}」給您`,
            link: `/dashboard/projects/${phase.projectId}`,
            refType: 'ProjectTask',
            refId: task.id,
          })
        } catch (err) {
          console.error('Failed to create task assignment notification:', err)
        }
      }

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

      // Send notification if assignee changed
      if (data.assigneeId && data.assigneeId !== existing.assigneeId && data.assigneeId !== actorId) {
        const actor = await ctx.prisma.employee.findUnique({
          where: { id: actorId },
          select: { name: true },
        })
        const project = await ctx.prisma.project.findUnique({
          where: { id: existing.phase.projectId },
          select: { name: true },
        })

        try {
          await createNotification({
            userId: data.assigneeId,
            type: 'TASK_ASSIGNED',
            title: '您有新的任務指派',
            message: `${actor?.name || '某人'} 在專案「${project?.name}」中指派任務「${task.name}」給您`,
            link: `/dashboard/projects/${existing.phase.projectId}`,
            refType: 'ProjectTask',
            refId: task.id,
          })
        } catch (err) {
          console.error('Failed to create task assignment notification:', err)
        }
      }

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

      // Send notification to the new member
      if (input.employeeId !== actorId) {
        const actor = await ctx.prisma.employee.findUnique({
          where: { id: actorId },
          select: { name: true },
        })
        const project = await ctx.prisma.project.findUnique({
          where: { id: input.projectId },
          select: { name: true },
        })
        const roleLabels = { MANAGER: '經理', MEMBER: '成員', OBSERVER: '觀察者' }

        try {
          await createNotification({
            userId: input.employeeId,
            type: 'PROJECT_MEMBER_ADDED',
            title: '您已被加入專案',
            message: `${actor?.name || '某人'} 將您加入專案「${project?.name}」，角色為${roleLabels[input.role]}`,
            link: `/dashboard/projects/${input.projectId}`,
            refType: 'Project',
            refId: input.projectId,
          })
        } catch (err) {
          console.error('Failed to create member added notification:', err)
        }
      }

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

  // ==================== 活動與整合 ====================

  // 取得專案活動記錄
  getActivities: publicProcedure
    .input(z.object({
      projectId: z.string(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.projectActivity.findMany({
        where: { projectId: input.projectId },
        include: {
          actor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      })
    }),

  // 取得專案成員的請假資訊
  getMemberLeaves: publicProcedure
    .input(z.object({
      projectId: z.string(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Get project members
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          members: {
            where: { leftAt: null },
            select: { employeeId: true },
          },
        },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
      }

      const memberIds = project.members.map(m => m.employeeId)
      if (memberIds.length === 0) return []

      // Default to next 30 days if no date range specified
      const now = new Date()
      const start = input.startDate || now
      const end = input.endDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      // Get approved leaves for project members in date range
      const leaves = await ctx.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: memberIds },
          status: { in: ['APPROVED', 'PENDING'] },
          OR: [
            { startDate: { lte: end }, endDate: { gte: start } },
          ],
        },
        include: {
          employee: { select: { id: true, name: true } },
          leaveType: { select: { id: true, name: true } },
        },
        orderBy: { startDate: 'asc' },
      })

      return leaves
    }),

  // 取得專案待辦事項摘要 (dashboard integration)
  getTaskSummary: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Get projects where user is a member
      const memberships = await ctx.prisma.projectMember.findMany({
        where: {
          employeeId: input.employeeId,
          leftAt: null,
          project: { companyId: input.companyId },
        },
        select: { projectId: true },
      })

      const projectIds = memberships.map(m => m.projectId)
      if (projectIds.length === 0) return { tasks: [], totalCount: 0 }

      // Get tasks assigned to user or unassigned in their projects
      const tasks = await ctx.prisma.projectTask.findMany({
        where: {
          assigneeId: input.employeeId,
          status: { not: 'COMPLETED' },
          phase: { projectId: { in: projectIds } },
        },
        include: {
          phase: {
            include: {
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
        ],
        take: 10,
      })

      const totalCount = await ctx.prisma.projectTask.count({
        where: {
          assigneeId: input.employeeId,
          status: { not: 'COMPLETED' },
          phase: { projectId: { in: projectIds } },
        },
      })

      return { tasks, totalCount }
    }),

  // ==================== 評論管理 ====================

  // 取得評論列表
  getComments: publicProcedure
    .input(z.object({
      projectId: z.string().optional(),
      phaseId: z.string().optional(),
      taskId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {}
      if (input.projectId) where.projectId = input.projectId
      if (input.phaseId) where.phaseId = input.phaseId
      if (input.taskId) where.taskId = input.taskId

      // If only projectId is provided, get all comments for the project (including phase/task comments)
      if (input.projectId && !input.phaseId && !input.taskId) {
        const project = await ctx.prisma.project.findUnique({
          where: { id: input.projectId },
          include: {
            phases: { select: { id: true } },
          },
        })

        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
        }

        const phaseIds = project.phases.map(p => p.id)

        // Get all tasks in these phases
        const tasks = await ctx.prisma.projectTask.findMany({
          where: { phaseId: { in: phaseIds } },
          select: { id: true },
        })
        const taskIds = tasks.map(t => t.id)

        return ctx.prisma.projectComment.findMany({
          where: {
            OR: [
              { projectId: input.projectId },
              { phaseId: { in: phaseIds } },
              { taskId: { in: taskIds } },
            ],
          },
          include: {
            author: { select: { id: true, name: true } },
            mentions: {
              include: {
                employee: { select: { id: true, name: true } },
              },
            },
            phase: { select: { id: true, name: true } },
            task: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      }

      return ctx.prisma.projectComment.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
          mentions: {
            include: {
              employee: { select: { id: true, name: true } },
            },
          },
          phase: { select: { id: true, name: true } },
          task: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 新增評論
  createComment: publicProcedure
    .input(z.object({
      projectId: z.string().optional(),
      phaseId: z.string().optional(),
      taskId: z.string().optional(),
      content: z.string().min(1, '請輸入評論內容'),
      authorId: z.string(),
      mentionIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { mentionIds, ...data } = input

      // Determine projectId for activity logging
      let activityProjectId = input.projectId

      if (!activityProjectId && input.phaseId) {
        const phase = await ctx.prisma.projectPhase.findUnique({
          where: { id: input.phaseId },
          select: { projectId: true },
        })
        activityProjectId = phase?.projectId
      }

      if (!activityProjectId && input.taskId) {
        const task = await ctx.prisma.projectTask.findUnique({
          where: { id: input.taskId },
          include: { phase: { select: { projectId: true } } },
        })
        activityProjectId = task?.phase.projectId
      }

      const comment = await ctx.prisma.projectComment.create({
        data: {
          ...data,
          mentions: mentionIds && mentionIds.length > 0
            ? { create: mentionIds.map(employeeId => ({ employeeId })) }
            : undefined,
        },
        include: {
          author: { select: { id: true, name: true } },
          mentions: {
            include: {
              employee: { select: { id: true, name: true } },
            },
          },
        },
      })

      // Create activity
      if (activityProjectId) {
        let targetType = 'PROJECT'
        let targetId = input.projectId || ''
        let summary = '在專案上發表了評論'

        if (input.taskId) {
          const task = await ctx.prisma.projectTask.findUnique({
            where: { id: input.taskId },
            select: { name: true },
          })
          targetType = 'TASK'
          targetId = input.taskId
          summary = `在任務「${task?.name}」上發表了評論`
        } else if (input.phaseId) {
          const phase = await ctx.prisma.projectPhase.findUnique({
            where: { id: input.phaseId },
            select: { name: true },
          })
          targetType = 'PHASE'
          targetId = input.phaseId
          summary = `在階段「${phase?.name}」上發表了評論`
        }

        await ctx.prisma.projectActivity.create({
          data: {
            projectId: activityProjectId,
            actorId: input.authorId,
            action: 'COMMENTED',
            targetType,
            targetId,
            summary,
          },
        })

        // Send notifications to mentioned users
        if (mentionIds && mentionIds.length > 0) {
          const project = await ctx.prisma.project.findUnique({
            where: { id: activityProjectId },
            select: { name: true },
          })

          const notifications = mentionIds
            .filter(userId => userId !== input.authorId)
            .map(userId => ({
              userId,
              type: 'COMMENT_MENTIONED' as const,
              title: '您在專案評論中被提及',
              message: `${comment.author.name} 在專案「${project?.name}」的評論中提及了您`,
              link: `/dashboard/projects/${activityProjectId}`,
              refType: 'ProjectComment',
              refId: comment.id,
            }))

          if (notifications.length > 0) {
            try {
              await createNotifications(notifications)
            } catch (err) {
              console.error('Failed to create mention notifications:', err)
            }
          }
        }
      }

      return comment
    }),

  // 更新評論
  updateComment: publicProcedure
    .input(z.object({
      id: z.string(),
      content: z.string().min(1, '請輸入評論內容'),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, content, actorId } = input

      const existing = await ctx.prisma.projectComment.findUnique({
        where: { id },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '評論不存在' })
      }

      if (existing.authorId !== actorId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只能編輯自己的評論' })
      }

      return ctx.prisma.projectComment.update({
        where: { id },
        data: { content },
        include: {
          author: { select: { id: true, name: true } },
          mentions: {
            include: {
              employee: { select: { id: true, name: true } },
            },
          },
        },
      })
    }),

  // 刪除評論
  deleteComment: publicProcedure
    .input(z.object({
      id: z.string(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.projectComment.findUnique({
        where: { id: input.id },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '評論不存在' })
      }

      if (existing.authorId !== input.actorId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只能刪除自己的評論' })
      }

      await ctx.prisma.projectComment.delete({ where: { id: input.id } })

      return { success: true }
    }),

  // ==================== 附件管理 ====================

  // 取得附件列表
  getAttachments: publicProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          phases: { select: { id: true } },
        },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
      }

      const phaseIds = project.phases.map(p => p.id)

      // Get all tasks in these phases
      const tasks = await ctx.prisma.projectTask.findMany({
        where: { phaseId: { in: phaseIds } },
        select: { id: true },
      })
      const taskIds = tasks.map(t => t.id)

      return ctx.prisma.projectAttachment.findMany({
        where: {
          OR: [
            { projectId: input.projectId },
            { phaseId: { in: phaseIds } },
            { taskId: { in: taskIds } },
          ],
        },
        include: {
          uploader: { select: { id: true, name: true } },
          phase: { select: { id: true, name: true } },
          task: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 刪除附件
  deleteAttachment: publicProcedure
    .input(z.object({
      id: z.string(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.prisma.projectAttachment.findUnique({
        where: { id: input.id },
        include: {
          task: { include: { phase: { select: { projectId: true } } } },
          phase: { select: { projectId: true } },
        },
      })

      if (!attachment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '附件不存在' })
      }

      // Only allow uploader to delete
      if (attachment.uploaderId !== input.actorId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只能刪除自己上傳的附件' })
      }

      const projectId = attachment.projectId ||
        attachment.phase?.projectId ||
        attachment.task?.phase.projectId

      await ctx.prisma.projectAttachment.delete({ where: { id: input.id } })

      // Log activity
      if (projectId) {
        await ctx.prisma.projectActivity.create({
          data: {
            projectId,
            actorId: input.actorId,
            action: 'DELETED',
            targetType: 'ATTACHMENT',
            targetId: input.id,
            summary: `刪除了附件「${attachment.fileName}」`,
          },
        })
      }

      return { success: true }
    }),

  // ==================== 通知提醒 ====================

  // 取得即將到期的任務
  getUpcomingDeadlines: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      daysAhead: z.number().default(7),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const futureDate = new Date(now.getTime() + input.daysAhead * 24 * 60 * 60 * 1000)

      // Get projects where user is a member
      const memberships = await ctx.prisma.projectMember.findMany({
        where: {
          employeeId: input.employeeId,
          leftAt: null,
          project: { companyId: input.companyId },
        },
        select: { projectId: true },
      })

      const projectIds = memberships.map(m => m.projectId)
      if (projectIds.length === 0) return []

      // Get tasks assigned to user with upcoming due dates
      return ctx.prisma.projectTask.findMany({
        where: {
          assigneeId: input.employeeId,
          status: { not: 'COMPLETED' },
          dueDate: { lte: futureDate },
          phase: { projectId: { in: projectIds } },
        },
        include: {
          phase: {
            include: {
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      })
    }),

  // 取得逾期任務
  getOverdueTasks: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()

      // Get projects where user is a member
      const memberships = await ctx.prisma.projectMember.findMany({
        where: {
          employeeId: input.employeeId,
          leftAt: null,
          project: { companyId: input.companyId },
        },
        select: { projectId: true },
      })

      const projectIds = memberships.map(m => m.projectId)
      if (projectIds.length === 0) return []

      // Get overdue tasks assigned to user
      return ctx.prisma.projectTask.findMany({
        where: {
          assigneeId: input.employeeId,
          status: { not: 'COMPLETED' },
          dueDate: { lt: now },
          phase: { projectId: { in: projectIds } },
        },
        include: {
          phase: {
            include: {
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      })
    }),

  // 發送截止日期提醒 (可由排程呼叫)
  sendDeadlineReminders: publicProcedure
    .input(z.object({
      companyId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0))
      const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999))

      // Find tasks due tomorrow that haven't been reminded yet
      const tasksDueTomorrow = await ctx.prisma.projectTask.findMany({
        where: {
          status: { not: 'COMPLETED' },
          dueDate: {
            gte: startOfTomorrow,
            lte: endOfTomorrow,
          },
          assigneeId: { not: null },
          phase: {
            project: { companyId: input.companyId },
          },
        },
        include: {
          assignee: { select: { id: true, name: true } },
          phase: {
            include: {
              project: { select: { id: true, name: true } },
            },
          },
        },
      })

      // Find overdue tasks
      const overdueTasks = await ctx.prisma.projectTask.findMany({
        where: {
          status: { not: 'COMPLETED' },
          dueDate: { lt: now },
          assigneeId: { not: null },
          phase: {
            project: { companyId: input.companyId },
          },
        },
        include: {
          assignee: { select: { id: true, name: true } },
          phase: {
            include: {
              project: { select: { id: true, name: true } },
            },
          },
        },
      })

      const notifications: {
        userId: string
        type: 'TASK_DUE_SOON' | 'TASK_OVERDUE'
        title: string
        message: string
        link: string
        refType: string
        refId: string
      }[] = []

      // Due tomorrow notifications
      for (const task of tasksDueTomorrow) {
        if (task.assigneeId) {
          notifications.push({
            userId: task.assigneeId,
            type: 'TASK_DUE_SOON',
            title: '任務即將到期',
            message: `任務「${task.name}」（專案：${task.phase.project.name}）將於明天到期`,
            link: `/dashboard/projects/${task.phase.projectId}`,
            refType: 'ProjectTask',
            refId: task.id,
          })
        }
      }

      // Overdue notifications
      for (const task of overdueTasks) {
        if (task.assigneeId) {
          notifications.push({
            userId: task.assigneeId,
            type: 'TASK_OVERDUE',
            title: '任務已逾期',
            message: `任務「${task.name}」（專案：${task.phase.project.name}）已逾期`,
            link: `/dashboard/projects/${task.phase.projectId}`,
            refType: 'ProjectTask',
            refId: task.id,
          })
        }
      }

      if (notifications.length > 0) {
        try {
          await createNotifications(notifications)
        } catch (err) {
          console.error('Failed to create deadline notifications:', err)
        }
      }

      return {
        dueTomorrow: tasksDueTomorrow.length,
        overdue: overdueTasks.length,
        notificationsSent: notifications.length,
      }
    }),

  // ==================== 專案範本 ====================

  // 取得範本列表
  listTemplates: publicProcedure
    .input(z.object({
      companyId: z.string(),
      category: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
        status: 'ACTIVE',
      }

      if (input.category) where.category = input.category
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ]
      }

      return ctx.prisma.projectTemplate.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          tags: { select: { name: true } },
          _count: { select: { phases: true } },
        },
        orderBy: { updatedAt: 'desc' },
      })
    }),

  // 取得單一範本詳情
  getTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.prisma.projectTemplate.findUnique({
        where: { id: input.id },
        include: {
          createdBy: { select: { id: true, name: true } },
          tags: { select: { id: true, name: true } },
          phases: {
            orderBy: { sortOrder: 'asc' },
            include: {
              tasks: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  children: { orderBy: { sortOrder: 'asc' } },
                },
                where: { parentId: null },
              },
            },
          },
        },
      })

      if (!template) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '範本不存在' })
      }

      return template
    }),

  // 建立範本
  createTemplate: publicProcedure
    .input(z.object({
      name: z.string().min(1, '請輸入範本名稱'),
      description: z.string().optional(),
      category: z.string().optional(),
      type: z.enum(['INTERNAL', 'CLIENT']).default('INTERNAL'),
      companyId: z.string(),
      createdById: z.string(),
      tags: z.array(z.string()).optional(),
      phases: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        sortOrder: z.number(),
        durationDays: z.number().optional(),
        tasks: z.array(z.object({
          name: z.string(),
          description: z.string().optional(),
          priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
          estimatedHours: z.number().optional(),
          durationDays: z.number().optional(),
          sortOrder: z.number().default(0),
        })).optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { tags, phases, ...templateData } = input

      const template = await ctx.prisma.projectTemplate.create({
        data: {
          ...templateData,
          tags: tags && tags.length > 0
            ? { create: tags.map(name => ({ name })) }
            : undefined,
          phases: phases && phases.length > 0
            ? {
                create: phases.map(phase => ({
                  name: phase.name,
                  description: phase.description,
                  sortOrder: phase.sortOrder,
                  durationDays: phase.durationDays,
                  tasks: phase.tasks && phase.tasks.length > 0
                    ? {
                        create: phase.tasks.map(task => ({
                          name: task.name,
                          description: task.description,
                          priority: task.priority,
                          estimatedHours: task.estimatedHours,
                          durationDays: task.durationDays,
                          sortOrder: task.sortOrder,
                        })),
                      }
                    : undefined,
                })),
              }
            : undefined,
        },
        include: {
          phases: { include: { tasks: true } },
          tags: true,
        },
      })

      return template
    }),

  // 從現有專案建立範本
  createTemplateFromProject: publicProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1, '請輸入範本名稱'),
      description: z.string().optional(),
      category: z.string().optional(),
      createdById: z.string(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          phases: {
            orderBy: { sortOrder: 'asc' },
            include: {
              tasks: {
                orderBy: { createdAt: 'asc' },
                where: { parentId: null },
                include: { children: true },
              },
            },
          },
        },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
      }

      const template = await ctx.prisma.projectTemplate.create({
        data: {
          name: input.name,
          description: input.description || project.description,
          category: input.category,
          type: project.type,
          companyId: project.companyId,
          createdById: input.createdById,
          tags: input.tags && input.tags.length > 0
            ? { create: input.tags.map(name => ({ name })) }
            : undefined,
          phases: {
            create: project.phases.map((phase, phaseIndex) => ({
              name: phase.name,
              description: phase.description,
              sortOrder: phaseIndex + 1,
              tasks: {
                create: phase.tasks.map((task, taskIndex) => ({
                  name: task.name,
                  description: task.description,
                  priority: task.priority,
                  estimatedHours: task.estimatedHours,
                  sortOrder: taskIndex + 1,
                })),
              },
            })),
          },
        },
        include: {
          phases: { include: { tasks: true } },
          tags: true,
        },
      })

      return template
    }),

  // 從範本建立專案
  createProjectFromTemplate: publicProcedure
    .input(z.object({
      templateId: z.string(),
      name: z.string().min(1, '請輸入專案名稱'),
      description: z.string().optional(),
      plannedStartDate: z.date().optional(),
      plannedEndDate: z.date().optional(),
      companyId: z.string(),
      departmentId: z.string(),
      managerId: z.string(),
      customerId: z.string().optional(),
      memberIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.prisma.projectTemplate.findUnique({
        where: { id: input.templateId },
        include: {
          phases: {
            orderBy: { sortOrder: 'asc' },
            include: {
              tasks: {
                orderBy: { sortOrder: 'asc' },
                where: { parentId: null },
              },
            },
          },
        },
      })

      if (!template) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '範本不存在' })
      }

      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          description: input.description,
          plannedStartDate: input.plannedStartDate,
          plannedEndDate: input.plannedEndDate,
          companyId: input.companyId,
          departmentId: input.departmentId,
          managerId: input.managerId,
          customerId: input.customerId,
          type: template.type,
          members: {
            create: [
              { employeeId: input.managerId, role: 'MANAGER' },
              ...(input.memberIds || [])
                .filter(id => id !== input.managerId)
                .map(employeeId => ({ employeeId, role: 'MEMBER' as const })),
            ],
          },
          phases: {
            create: template.phases.map((phase) => ({
              name: phase.name,
              description: phase.description,
              sortOrder: phase.sortOrder,
              tasks: {
                create: phase.tasks.map((task) => ({
                  name: task.name,
                  description: task.description,
                  priority: task.priority,
                  estimatedHours: task.estimatedHours,
                })),
              },
            })),
          },
        },
        include: {
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
          phases: { include: { tasks: true } },
        },
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: project.id,
          actorId: input.managerId,
          action: 'CREATED',
          targetType: 'PROJECT',
          targetId: project.id,
          summary: `使用範本「${template.name}」建立了專案「${project.name}」`,
        },
      })

      return project
    }),

  // 更新範本
  updateTemplate: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      type: z.enum(['INTERNAL', 'CLIENT']).optional(),
      isActive: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, tags, ...data } = input

      // If tags are provided, update them
      if (tags !== undefined) {
        // Delete existing tags
        await ctx.prisma.projectTemplateTag.deleteMany({
          where: { templateId: id },
        })
        // Create new tags
        if (tags.length > 0) {
          await ctx.prisma.projectTemplateTag.createMany({
            data: tags.map(name => ({ templateId: id, name })),
          })
        }
      }

      return ctx.prisma.projectTemplate.update({
        where: { id },
        data,
        include: {
          tags: true,
          phases: { include: { tasks: true } },
        },
      })
    }),

  // 刪除範本
  deleteTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.projectTemplate.delete({ where: { id: input.id } })
      return { success: true }
    }),

  // 取得範本分類列表
  getTemplateCategories: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const templates = await ctx.prisma.projectTemplate.findMany({
        where: {
          companyId: input.companyId,
          isActive: true,
          category: { not: null },
        },
        select: { category: true },
        distinct: ['category'],
      })

      return templates.map(t => t.category).filter(Boolean) as string[]
    }),

  // ==================== 稽核紀錄 ====================

  // 取得專案稽核紀錄
  getAuditLogs: publicProcedure
    .input(z.object({
      projectId: z.string(),
      action: z.string().optional(),
      targetType: z.string().optional(),
      actorId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        projectId: input.projectId,
      }

      if (input.action) where.action = input.action
      if (input.targetType) where.targetType = input.targetType
      if (input.actorId) where.actorId = input.actorId

      if (input.startDate || input.endDate) {
        where.createdAt = {}
        if (input.startDate) (where.createdAt as Record<string, unknown>).gte = input.startDate
        if (input.endDate) (where.createdAt as Record<string, unknown>).lte = input.endDate
      }

      const [logs, total] = await Promise.all([
        ctx.prisma.projectAuditLog.findMany({
          where,
          include: {
            actor: { select: { id: true, name: true, employeeNo: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.projectAuditLog.count({ where }),
      ])

      return { logs, total }
    }),

  // 建立稽核紀錄 (內部使用)
  createAuditLog: publicProcedure
    .input(z.object({
      projectId: z.string(),
      actorId: z.string(),
      action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'MEMBER_ADD', 'MEMBER_REMOVE', 'PHASE_CREATE', 'PHASE_UPDATE', 'TASK_CREATE', 'TASK_UPDATE', 'TASK_STATUS_CHANGE']),
      targetType: z.enum(['PROJECT', 'PHASE', 'TASK', 'MEMBER', 'COMMENT', 'ATTACHMENT']),
      targetId: z.string(),
      beforeData: z.record(z.string(), z.unknown()).nullable().optional(),
      afterData: z.record(z.string(), z.unknown()).nullable().optional(),
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.projectAuditLog.create({
        data: {
          projectId: input.projectId,
          actorId: input.actorId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          beforeData: input.beforeData as object | undefined,
          afterData: input.afterData as object | undefined,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      })
    }),

  // 取得稽核紀錄統計
  getAuditStats: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const stats = await ctx.prisma.projectAuditLog.groupBy({
        by: ['action'],
        where: { projectId: input.projectId },
        _count: { action: true },
      })

      const actorStats = await ctx.prisma.projectAuditLog.groupBy({
        by: ['actorId'],
        where: { projectId: input.projectId },
        _count: { actorId: true },
        orderBy: { _count: { actorId: 'desc' } },
        take: 10,
      })

      const actorIds = actorStats.map(s => s.actorId)
      const actors = await ctx.prisma.employee.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      })

      const actorMap = new Map(actors.map(a => [a.id, a.name]))

      return {
        byAction: stats.map(s => ({ action: s.action, count: s._count.action })),
        byActor: actorStats.map(s => ({
          actorId: s.actorId,
          actorName: actorMap.get(s.actorId) || '未知',
          count: s._count.actorId,
        })),
        totalLogs: stats.reduce((sum, s) => sum + s._count.action, 0),
      }
    }),

  // ==================== 彈性權限設定 ====================

  // 取得專案可見成員列表
  getVisibleMembers: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.projectVisibleMember.findMany({
        where: { projectId: input.projectId },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              assignments: {
                where: { status: 'ACTIVE' },
                include: {
                  department: { select: { id: true, name: true } },
                  position: { select: { id: true, name: true } },
                },
                take: 1,
              },
            },
          },
        },
      })
    }),

  // 新增可見成員
  addVisibleMember: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeId: z.string(),
      addedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否已存在
      const existing = await ctx.prisma.projectVisibleMember.findUnique({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
      })

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '此成員已在可見清單中' })
      }

      const member = await ctx.prisma.projectVisibleMember.create({
        data: {
          projectId: input.projectId,
          employeeId: input.employeeId,
        },
        include: {
          employee: { select: { id: true, name: true } },
        },
      })

      // 記錄稽核紀錄
      await ctx.prisma.projectAuditLog.create({
        data: {
          projectId: input.projectId,
          actorId: input.addedById,
          action: 'MEMBER_ADD',
          targetType: 'MEMBER',
          targetId: member.id,
          afterData: { employeeId: input.employeeId, type: 'VISIBLE_MEMBER' },
        },
      })

      // 記錄活動
      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId: input.addedById,
          action: 'VISIBLE_MEMBER_ADDED',
          targetType: 'VISIBLE_MEMBER',
          targetId: member.id,
          summary: `新增了「${member.employee.name}」為可見成員`,
        },
      })

      return member
    }),

  // 移除可見成員
  removeVisibleMember: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeId: z.string(),
      removedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.projectVisibleMember.findUnique({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
        include: {
          employee: { select: { id: true, name: true } },
        },
      })

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '可見成員不存在' })
      }

      await ctx.prisma.projectVisibleMember.delete({
        where: { id: member.id },
      })

      // 記錄稽核紀錄
      await ctx.prisma.projectAuditLog.create({
        data: {
          projectId: input.projectId,
          actorId: input.removedById,
          action: 'MEMBER_REMOVE',
          targetType: 'MEMBER',
          targetId: member.id,
          beforeData: { employeeId: input.employeeId, type: 'VISIBLE_MEMBER' },
        },
      })

      // 記錄活動
      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId: input.removedById,
          action: 'VISIBLE_MEMBER_REMOVED',
          targetType: 'VISIBLE_MEMBER',
          targetId: member.id,
          summary: `移除了「${member.employee.name}」的可見權限`,
        },
      })

      return { success: true }
    }),

  // 批次更新可見成員
  updateVisibleMembers: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeIds: z.array(z.string()),
      updatedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 取得現有成員
      const existing = await ctx.prisma.projectVisibleMember.findMany({
        where: { projectId: input.projectId },
        select: { employeeId: true },
      })

      const existingIds = new Set(existing.map(m => m.employeeId))
      const newIds = new Set(input.employeeIds)

      // 計算新增和移除
      const toAdd = input.employeeIds.filter(id => !existingIds.has(id))
      const toRemove = existing.filter(m => !newIds.has(m.employeeId)).map(m => m.employeeId)

      // 執行更新
      await ctx.prisma.$transaction([
        // 刪除移除的
        ctx.prisma.projectVisibleMember.deleteMany({
          where: {
            projectId: input.projectId,
            employeeId: { in: toRemove },
          },
        }),
        // 新增的
        ctx.prisma.projectVisibleMember.createMany({
          data: toAdd.map(employeeId => ({
            projectId: input.projectId,
            employeeId,
          })),
        }),
      ])

      // 記錄稽核紀錄
      if (toAdd.length > 0 || toRemove.length > 0) {
        await ctx.prisma.projectAuditLog.create({
          data: {
            projectId: input.projectId,
            actorId: input.updatedById,
            action: 'UPDATE',
            targetType: 'PROJECT',
            targetId: input.projectId,
            beforeData: { visibleMembers: Array.from(existingIds) },
            afterData: { visibleMembers: input.employeeIds },
          },
        })

        await ctx.prisma.projectActivity.create({
          data: {
            projectId: input.projectId,
            actorId: input.updatedById,
            action: 'VISIBLE_MEMBERS_UPDATED',
            targetType: 'PROJECT',
            targetId: input.projectId,
            summary: `更新了專案可見成員（新增 ${toAdd.length} 人，移除 ${toRemove.length} 人）`,
          },
        })
      }

      return { added: toAdd.length, removed: toRemove.length }
    }),

  // 檢查使用者是否有專案存取權限
  checkAccess: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: {
          visibility: true,
          companyId: true,
          departmentId: true,
          members: {
            where: { employeeId: input.employeeId, leftAt: null },
            select: { role: true },
          },
          visibleMembers: {
            where: { employeeId: input.employeeId },
            select: { id: true },
          },
        },
      })

      if (!project) {
        return { hasAccess: false, role: null, reason: 'PROJECT_NOT_FOUND' }
      }

      // 檢查是否為專案成員
      if (project.members.length > 0) {
        return { hasAccess: true, role: project.members[0].role, reason: 'MEMBER' }
      }

      // 根據可見性檢查
      switch (project.visibility) {
        case 'PRIVATE':
          return { hasAccess: false, role: null, reason: 'PRIVATE_PROJECT' }

        case 'DEPARTMENT': {
          // 檢查是否同部門
          const assignment = await ctx.prisma.employeeAssignment.findFirst({
            where: {
              employeeId: input.employeeId,
              companyId: project.companyId,
              departmentId: project.departmentId,
              status: 'ACTIVE',
            },
          })
          if (assignment) {
            return { hasAccess: true, role: 'OBSERVER', reason: 'SAME_DEPARTMENT' }
          }
          return { hasAccess: false, role: null, reason: 'DIFFERENT_DEPARTMENT' }
        }

        case 'COMPANY': {
          // 檢查是否同公司
          const assignment = await ctx.prisma.employeeAssignment.findFirst({
            where: {
              employeeId: input.employeeId,
              companyId: project.companyId,
              status: 'ACTIVE',
            },
          })
          if (assignment) {
            return { hasAccess: true, role: 'OBSERVER', reason: 'SAME_COMPANY' }
          }
          return { hasAccess: false, role: null, reason: 'DIFFERENT_COMPANY' }
        }

        case 'CUSTOM':
          // 檢查是否在可見清單中
          if (project.visibleMembers.length > 0) {
            return { hasAccess: true, role: 'OBSERVER', reason: 'VISIBLE_MEMBER' }
          }
          return { hasAccess: false, role: null, reason: 'NOT_IN_VISIBLE_LIST' }

        default:
          return { hasAccess: false, role: null, reason: 'UNKNOWN_VISIBILITY' }
      }
    }),
})
