import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// Zod schemas for complex inputs
const workflowNodeSchema = z.object({
  id: z.string().optional(), // 前端產生的暫時 ID
  nodeType: z.enum(['START', 'APPROVAL', 'CONDITION', 'PARALLEL_START', 'PARALLEL_JOIN', 'END']),
  name: z.string().optional(),
  approverType: z.enum(['SPECIFIC_EMPLOYEE', 'POSITION', 'ROLE', 'ORG_RELATION', 'DEPARTMENT_HEAD', 'CUSTOM_FIELD']).optional(),
  approverId: z.string().optional(),
  orgRelation: z.enum(['DIRECT_SUPERVISOR', 'DOTTED_SUPERVISOR', 'N_LEVEL_UP', 'DEPARTMENT_MANAGER', 'COMPANY_HEAD']).optional(),
  orgLevelUp: z.number().optional(),
  customFieldName: z.string().optional(),
  parallelMode: z.enum(['ALL', 'ANY', 'MAJORITY']).optional(),
  posX: z.number().default(0),
  posY: z.number().default(0),
})

const workflowEdgeSchema = z.object({
  id: z.string().optional(),
  fromNodeId: z.string(), // 對應 node 的 id
  toNodeId: z.string(),
  conditionField: z.string().optional(),
  conditionOperator: z.enum(['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL', 'CONTAINS', 'IN', 'NOT_IN']).optional(),
  conditionValue: z.string().optional(),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().default(0),
})

export const workflowRouter = router({
  // 取得流程定義列表
  list: publicProcedure
    .input(z.object({
      companyId: z.string().optional(),
      groupId: z.string().optional(),
      scopeType: z.enum(['EMPLOYEE', 'REQUEST_TYPE', 'DEFAULT']).optional(),
      requestType: z.string().optional(),
      employeeId: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {}
      if (input.companyId) where.companyId = input.companyId
      if (input.groupId) where.groupId = input.groupId
      if (input.scopeType) where.scopeType = input.scopeType
      if (input.requestType) where.requestType = input.requestType
      if (input.employeeId) where.employeeId = input.employeeId
      if (input.isActive !== undefined) where.isActive = input.isActive

      return ctx.prisma.workflowDefinition.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true, employeeNo: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { nodes: true, instances: true } },
        },
        orderBy: [{ scopeType: 'asc' }, { updatedAt: 'desc' }],
      })
    }),

  // 取得單一流程定義（含節點和連線）
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const definition = await ctx.prisma.workflowDefinition.findUnique({
        where: { id: input.id },
        include: {
          company: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true, employeeNo: true } },
          createdBy: { select: { id: true, name: true } },
          nodes: true,
          edges: true,
        },
      })

      if (!definition) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '找不到流程定義' })
      }

      return definition
    }),

  // 建立流程定義
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      scopeType: z.enum(['EMPLOYEE', 'REQUEST_TYPE', 'DEFAULT']),
      groupId: z.string().optional(),
      companyId: z.string().optional(),
      employeeId: z.string().optional(),
      requestType: z.string().optional(),
      effectiveFrom: z.date().optional(),
      effectiveTo: z.date().optional(),
      createdById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 驗證
      if (input.scopeType === 'EMPLOYEE' && !input.employeeId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '員工特殊路徑需要指定員工' })
      }
      if (input.scopeType === 'REQUEST_TYPE' && !input.requestType) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '申請類型流程需要指定申請類型' })
      }

      return ctx.prisma.workflowDefinition.create({
        data: input,
      })
    }),

  // 更新流程定義基本資料
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      effectiveFrom: z.date().optional(),
      effectiveTo: z.date().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.workflowDefinition.update({
        where: { id },
        data,
      })
    }),

  // 儲存流程設計（節點和連線）
  saveDesign: publicProcedure
    .input(z.object({
      definitionId: z.string(),
      nodes: z.array(workflowNodeSchema),
      edges: z.array(workflowEdgeSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const { definitionId, nodes, edges } = input

      // 使用 transaction
      await ctx.prisma.$transaction(async (tx) => {
        // 1. 刪除舊的節點和連線
        await tx.workflowEdge.deleteMany({ where: { definitionId } })
        await tx.workflowNode.deleteMany({ where: { definitionId } })

        // 2. 建立新節點，並建立 ID 對照表
        const nodeIdMap = new Map<string, string>()

        for (const node of nodes) {
          const created = await tx.workflowNode.create({
            data: {
              definitionId,
              nodeType: node.nodeType,
              name: node.name,
              approverType: node.approverType,
              approverId: node.approverId,
              orgRelation: node.orgRelation,
              orgLevelUp: node.orgLevelUp,
              customFieldName: node.customFieldName,
              parallelMode: node.parallelMode,
              posX: node.posX,
              posY: node.posY,
            },
          })
          if (node.id) {
            nodeIdMap.set(node.id, created.id)
          }
        }

        // 3. 建立連線（使用對照表轉換 ID）
        for (const edge of edges) {
          const fromNodeId = nodeIdMap.get(edge.fromNodeId) || edge.fromNodeId
          const toNodeId = nodeIdMap.get(edge.toNodeId) || edge.toNodeId

          await tx.workflowEdge.create({
            data: {
              definitionId,
              fromNodeId,
              toNodeId,
              conditionField: edge.conditionField,
              conditionOperator: edge.conditionOperator,
              conditionValue: edge.conditionValue,
              isDefault: edge.isDefault,
              sortOrder: edge.sortOrder,
            },
          })
        }

        // 4. 更新版本號
        await tx.workflowDefinition.update({
          where: { id: definitionId },
          data: { version: { increment: 1 } },
        })
      })

      return { success: true }
    }),

  // 刪除流程定義
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否有執行中的實例
      const runningCount = await ctx.prisma.workflowInstance.count({
        where: {
          definitionId: input.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      })

      if (runningCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `此流程有 ${runningCount} 個執行中的實例，無法刪除`,
        })
      }

      return ctx.prisma.workflowDefinition.delete({
        where: { id: input.id },
      })
    }),

  // 複製流程定義
  duplicate: publicProcedure
    .input(z.object({
      id: z.string(),
      newName: z.string(),
      createdById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.prisma.workflowDefinition.findUnique({
        where: { id: input.id },
        include: { nodes: true, edges: true },
      })

      if (!original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '找不到原始流程定義' })
      }

      // 建立副本
      const copy = await ctx.prisma.workflowDefinition.create({
        data: {
          name: input.newName,
          description: original.description,
          scopeType: original.scopeType,
          groupId: original.groupId,
          companyId: original.companyId,
          requestType: original.requestType,
          createdById: input.createdById,
          isActive: false, // 副本預設為停用
        },
      })

      // 複製節點
      const nodeIdMap = new Map<string, string>()
      for (const node of original.nodes) {
        const newNode = await ctx.prisma.workflowNode.create({
          data: {
            definitionId: copy.id,
            nodeType: node.nodeType,
            name: node.name,
            approverType: node.approverType,
            approverId: node.approverId,
            orgRelation: node.orgRelation,
            orgLevelUp: node.orgLevelUp,
            customFieldName: node.customFieldName,
            parallelMode: node.parallelMode,
            posX: node.posX,
            posY: node.posY,
          },
        })
        nodeIdMap.set(node.id, newNode.id)
      }

      // 複製連線
      for (const edge of original.edges) {
        await ctx.prisma.workflowEdge.create({
          data: {
            definitionId: copy.id,
            fromNodeId: nodeIdMap.get(edge.fromNodeId)!,
            toNodeId: nodeIdMap.get(edge.toNodeId)!,
            conditionField: edge.conditionField,
            conditionOperator: edge.conditionOperator,
            conditionValue: edge.conditionValue,
            isDefault: edge.isDefault,
            sortOrder: edge.sortOrder,
          },
        })
      }

      return copy
    }),

  // 取得適用的流程定義（依優先權）
  getApplicableWorkflow: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      requestType: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()

      // 優先權 1：員工特殊路徑
      const employeeWorkflow = await ctx.prisma.workflowDefinition.findFirst({
        where: {
          scopeType: 'EMPLOYEE',
          employeeId: input.employeeId,
          isActive: true,
          OR: [
            { effectiveFrom: null },
            { effectiveFrom: { lte: now } },
          ],
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
          ],
        },
        include: { nodes: true, edges: true },
      })

      if (employeeWorkflow) {
        return { workflow: employeeWorkflow, priority: 'EMPLOYEE' as const }
      }

      // 優先權 2：申請類型流程
      const typeWorkflow = await ctx.prisma.workflowDefinition.findFirst({
        where: {
          scopeType: 'REQUEST_TYPE',
          requestType: input.requestType,
          companyId: input.companyId,
          isActive: true,
          OR: [
            { effectiveFrom: null },
            { effectiveFrom: { lte: now } },
          ],
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
          ],
        },
        include: { nodes: true, edges: true },
      })

      if (typeWorkflow) {
        return { workflow: typeWorkflow, priority: 'REQUEST_TYPE' as const }
      }

      // 優先權 3：預設流程
      const defaultWorkflow = await ctx.prisma.workflowDefinition.findFirst({
        where: {
          scopeType: 'DEFAULT',
          companyId: input.companyId,
          isActive: true,
        },
        include: { nodes: true, edges: true },
      })

      if (defaultWorkflow) {
        return { workflow: defaultWorkflow, priority: 'DEFAULT' as const }
      }

      return null
    }),
})
