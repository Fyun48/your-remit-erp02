import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const orgChartRouter = router({
  // 取得組織圖列表
  list: publicProcedure
    .input(z.object({
      type: z.enum(['GROUP', 'COMPANY']).optional(),
      groupId: z.string().optional(),
      companyId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isActive: true }
      if (input.type) where.type = input.type
      if (input.groupId) where.groupId = input.groupId
      if (input.companyId) where.companyId = input.companyId

      return ctx.prisma.orgChart.findMany({
        where,
        include: {
          group: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
          _count: { select: { nodes: true, relations: true } },
        },
        orderBy: { updatedAt: 'desc' },
      })
    }),

  // 取得單一組織圖（含節點和關係）
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const chart = await ctx.prisma.orgChart.findUnique({
        where: { id: input.id },
        include: {
          group: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
          nodes: true,
          relations: true,
        },
      })

      if (!chart) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '找不到組織圖' })
      }

      return chart
    }),

  // 建立組織圖
  create: publicProcedure
    .input(z.object({
      type: z.enum(['GROUP', 'COMPANY']),
      groupId: z.string().optional(),
      companyId: z.string().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 驗證：GROUP 類型需要 groupId，COMPANY 類型需要 companyId
      if (input.type === 'GROUP' && !input.groupId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '集團組織圖需要指定集團' })
      }
      if (input.type === 'COMPANY' && !input.companyId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '公司組織圖需要指定公司' })
      }

      return ctx.prisma.orgChart.create({
        data: {
          type: input.type,
          groupId: input.groupId,
          companyId: input.companyId,
          name: input.name,
          description: input.description,
        },
      })
    }),

  // 更新組織圖基本資料
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.orgChart.update({
        where: { id },
        data,
      })
    }),

  // 刪除組織圖
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.orgChart.delete({
        where: { id: input.id },
      })
    }),

  // ==================== 節點操作 ====================

  // 新增節點
  addNode: publicProcedure
    .input(z.object({
      chartId: z.string(),
      nodeType: z.enum(['DEPARTMENT', 'POSITION', 'EMPLOYEE', 'TEAM', 'DIVISION', 'COMMITTEE', 'COMPANY', 'EXTERNAL']),
      referenceId: z.string().optional(),
      label: z.string().optional(),
      posX: z.number().default(0),
      posY: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.orgNode.create({
        data: input,
      })
    }),

  // 更新節點
  updateNode: publicProcedure
    .input(z.object({
      id: z.string(),
      label: z.string().optional(),
      posX: z.number().optional(),
      posY: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.orgNode.update({
        where: { id },
        data,
      })
    }),

  // 批次更新節點位置
  updateNodePositions: publicProcedure
    .input(z.array(z.object({
      id: z.string(),
      posX: z.number(),
      posY: z.number(),
    })))
    .mutation(async ({ ctx, input }) => {
      const updates = input.map((node) =>
        ctx.prisma.orgNode.update({
          where: { id: node.id },
          data: { posX: node.posX, posY: node.posY },
        })
      )
      await ctx.prisma.$transaction(updates)
      return { success: true }
    }),

  // 刪除節點
  deleteNode: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.orgNode.delete({
        where: { id: input.id },
      })
    }),

  // ==================== 關係操作 ====================

  // 新增關係
  addRelation: publicProcedure
    .input(z.object({
      chartId: z.string(),
      fromNodeId: z.string(),
      toNodeId: z.string(),
      relationType: z.enum(['SOLID', 'DOTTED', 'MATRIX']).default('SOLID'),
      includeInApproval: z.boolean().default(true),
      approvalOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否已存在相同關係
      const existing = await ctx.prisma.orgRelation.findUnique({
        where: {
          chartId_fromNodeId_toNodeId: {
            chartId: input.chartId,
            fromNodeId: input.fromNodeId,
            toNodeId: input.toNodeId,
          },
        },
      })

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '此關係已存在' })
      }

      return ctx.prisma.orgRelation.create({
        data: input,
      })
    }),

  // 更新關係
  updateRelation: publicProcedure
    .input(z.object({
      id: z.string(),
      relationType: z.enum(['SOLID', 'DOTTED', 'MATRIX']).optional(),
      includeInApproval: z.boolean().optional(),
      approvalOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.orgRelation.update({
        where: { id },
        data,
      })
    }),

  // 刪除關係
  deleteRelation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.orgRelation.delete({
        where: { id: input.id },
      })
    }),

  // ==================== 查詢輔助 ====================

  // 取得可選的部門/職位/員工
  getAvailableEntities: publicProcedure
    .input(z.object({
      companyId: z.string(),
      nodeType: z.enum(['DEPARTMENT', 'POSITION', 'EMPLOYEE', 'TEAM', 'DIVISION', 'COMMITTEE', 'COMPANY', 'EXTERNAL']),
    }))
    .query(async ({ ctx, input }) => {
      if (input.nodeType === 'DEPARTMENT') {
        return ctx.prisma.department.findMany({
          where: { companyId: input.companyId, isActive: true },
          select: { id: true, name: true, code: true },
          orderBy: { code: 'asc' },
        })
      }

      if (input.nodeType === 'POSITION') {
        return ctx.prisma.position.findMany({
          where: { companyId: input.companyId, isActive: true },
          select: { id: true, name: true, code: true, level: true },
          orderBy: { level: 'desc' },
        })
      }

      if (input.nodeType === 'EMPLOYEE') {
        // EMPLOYEE
        const assignments = await ctx.prisma.employeeAssignment.findMany({
          where: { companyId: input.companyId, status: 'ACTIVE' },
          include: {
            employee: { select: { id: true, name: true, employeeNo: true } },
            position: { select: { name: true } },
            department: { select: { name: true } },
          },
          orderBy: { employee: { employeeNo: 'asc' } },
        })

        return assignments.map((a) => ({
          id: a.employee.id,
          name: a.employee.name,
          employeeNo: a.employee.employeeNo,
          position: a.position.name,
          department: a.department.name,
        }))
      }

      // 其他類型（TEAM, DIVISION, COMMITTEE, COMPANY, EXTERNAL）暫不支援自動帶入
      return []
    }),
})
