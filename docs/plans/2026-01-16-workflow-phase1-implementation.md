# Phase 1: 工作流程系統基礎架構 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立工作流程系統與組織圖的資料庫 Schema 和基礎 CRUD API

**Architecture:** 新增組織圖（OrgChart）和流程引擎（Workflow）相關的 Prisma Model，並建立對應的 tRPC router 提供基礎 CRUD 操作。

**Tech Stack:** Prisma ORM, tRPC, Zod validation, PostgreSQL

---

## Task 1: 新增組織圖相關 Enums

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增 Enums 到 schema.prisma**

在 `// ==================== 審核流程引擎 ====================` 區塊前面新增：

```prisma
// ==================== 組織圖 ====================

// 組織圖類型
enum OrgChartType {
  GROUP    // 集團組織圖
  COMPANY  // 公司組織圖
}

// 組織節點類型
enum OrgNodeType {
  DEPARTMENT  // 部門
  POSITION    // 職位
  EMPLOYEE    // 員工
}

// 組織關係類型
enum OrgRelationType {
  SOLID   // 實線（正式彙報）
  DOTTED  // 虛線（功能性彙報）
  MATRIX  // 矩陣（多重隸屬）
}
```

**Step 2: 執行 prisma format 驗證語法**

Run: `npx prisma format`
Expected: Schema 格式化成功，無錯誤

---

## Task 2: 新增組織圖資料模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增 OrgChart Model**

在 Enums 後面新增：

```prisma
// 組織圖
model OrgChart {
  id          String       @id @default(cuid())
  type        OrgChartType
  groupId     String?
  group       Group?       @relation(fields: [groupId], references: [id])
  companyId   String?
  company     Company?     @relation("CompanyOrgCharts", fields: [companyId], references: [id])
  name        String
  description String?
  isActive    Boolean      @default(true)

  nodes       OrgNode[]
  relations   OrgRelation[]

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([groupId])
  @@index([companyId])
  @@map("org_charts")
}

// 組織節點
model OrgNode {
  id           String      @id @default(cuid())
  chartId      String
  chart        OrgChart    @relation(fields: [chartId], references: [id], onDelete: Cascade)

  nodeType     OrgNodeType
  referenceId  String?     // 關聯的 departmentId/positionId/employeeId

  // 視覺化位置
  posX         Float       @default(0)
  posY         Float       @default(0)

  // 自訂顯示
  label        String?

  fromRelations OrgRelation[] @relation("FromOrgNode")
  toRelations   OrgRelation[] @relation("ToOrgNode")

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([chartId])
  @@index([referenceId])
  @@map("org_nodes")
}

// 組織關係
model OrgRelation {
  id              String          @id @default(cuid())
  chartId         String
  chart           OrgChart        @relation(fields: [chartId], references: [id], onDelete: Cascade)

  fromNodeId      String
  fromNode        OrgNode         @relation("FromOrgNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNodeId        String
  toNode          OrgNode         @relation("ToOrgNode", fields: [toNodeId], references: [id], onDelete: Cascade)

  relationType    OrgRelationType @default(SOLID)

  // 簽核相關設定
  includeInApproval Boolean       @default(true)
  approvalOrder     Int?

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([chartId, fromNodeId, toNodeId])
  @@index([chartId])
  @@map("org_relations")
}
```

**Step 2: 更新 Group Model 新增 relation**

在 Group model 的 `companies Company[]` 後面新增：

```prisma
  orgCharts OrgChart[]
```

**Step 3: 更新 Company Model 新增 relation**

在 Company model 的 relations 區塊新增：

```prisma
  // 組織圖
  orgCharts         OrgChart[] @relation("CompanyOrgCharts")
```

**Step 4: 驗證 Schema**

Run: `npx prisma format`
Expected: 格式化成功

---

## Task 3: 新增流程引擎 Enums

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增流程引擎 Enums**

在組織圖 Models 後面新增：

```prisma
// ==================== 工作流程引擎 ====================

// 流程範圍
enum WorkflowScope {
  EMPLOYEE      // 員工特殊路徑
  REQUEST_TYPE  // 申請類型流程
  DEFAULT       // 預設流程
}

// 流程節點類型
enum WorkflowNodeType {
  START           // 開始
  APPROVAL        // 簽核
  CONDITION       // 條件判斷
  PARALLEL_START  // 並行開始
  PARALLEL_JOIN   // 並行匯合
  END             // 結束
}

// 簽核人指定類型
enum WorkflowApproverType {
  SPECIFIC_EMPLOYEE  // 特定員工
  POSITION           // 職位
  ROLE               // 角色
  ORG_RELATION       // 組織關係
  DEPARTMENT_HEAD    // 部門主管
  CUSTOM_FIELD       // 自訂欄位
}

// 組織關係簽核人類型
enum OrgRelationApproverType {
  DIRECT_SUPERVISOR   // 直屬主管
  DOTTED_SUPERVISOR   // 虛線主管
  N_LEVEL_UP          // 往上N層
  DEPARTMENT_MANAGER  // 部門最高主管
  COMPANY_HEAD        // 公司負責人
}

// 並行模式
enum WorkflowParallelMode {
  ALL       // 全部通過
  ANY       // 任一通過
  MAJORITY  // 多數通過
}

// 條件運算子
enum WorkflowConditionOperator {
  EQUALS
  NOT_EQUALS
  GREATER_THAN
  LESS_THAN
  GREATER_OR_EQUAL
  LESS_OR_EQUAL
  CONTAINS
  IN
  NOT_IN
}

// 流程實例狀態
enum WorkflowInstanceStatus {
  DRAFT
  PENDING
  IN_PROGRESS
  APPROVED
  REJECTED
  CANCELLED
  WITHDRAWN
}

// 簽核紀錄狀態
enum WorkflowApprovalStatus {
  WAITING
  PENDING
  APPROVED
  REJECTED
  SKIPPED
}

// 簽核動作
enum WorkflowApprovalAction {
  APPROVE
  REJECT
  RETURN
  ADD_SIGNER
  TRANSFER
}
```

**Step 2: 驗證 Schema**

Run: `npx prisma format`
Expected: 格式化成功

---

## Task 4: 新增流程定義資料模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增 WorkflowDefinition Model**

```prisma
// 流程定義
model WorkflowDefinition {
  id            String          @id @default(cuid())
  name          String
  description   String?

  // 適用範圍
  scopeType     WorkflowScope
  groupId       String?
  group         Group?          @relation(fields: [groupId], references: [id])
  companyId     String?
  company       Company?        @relation("CompanyWorkflows", fields: [companyId], references: [id])

  // 員工特殊路徑
  employeeId    String?
  employee      Employee?       @relation("EmployeeWorkflows", fields: [employeeId], references: [id])

  // 申請類型
  requestType   String?

  // 生效期間
  effectiveFrom DateTime?
  effectiveTo   DateTime?
  isActive      Boolean         @default(true)

  // 版本控制
  version       Int             @default(1)

  // 設定者
  createdById   String
  createdBy     Employee        @relation("WorkflowCreator", fields: [createdById], references: [id])

  nodes         WorkflowNode[]
  edges         WorkflowEdge[]
  instances     WorkflowInstance[]

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([companyId])
  @@index([employeeId])
  @@index([requestType])
  @@index([scopeType, isActive])
  @@map("workflow_definitions")
}

// 流程節點
model WorkflowNode {
  id              String                  @id @default(cuid())
  definitionId    String
  definition      WorkflowDefinition      @relation(fields: [definitionId], references: [id], onDelete: Cascade)

  nodeType        WorkflowNodeType
  name            String?

  // 簽核人設定
  approverType    WorkflowApproverType?
  approverId      String?
  orgRelation     OrgRelationApproverType?
  orgLevelUp      Int?
  customFieldName String?

  // 並行設定
  parallelMode    WorkflowParallelMode?

  // 視覺化位置
  posX            Float                   @default(0)
  posY            Float                   @default(0)

  fromEdges       WorkflowEdge[]          @relation("FromWorkflowNode")
  toEdges         WorkflowEdge[]          @relation("ToWorkflowNode")
  approvalRecords WorkflowApprovalRecord[]

  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@index([definitionId])
  @@map("workflow_nodes")
}

// 節點連線
model WorkflowEdge {
  id                String                      @id @default(cuid())
  definitionId      String
  definition        WorkflowDefinition          @relation(fields: [definitionId], references: [id], onDelete: Cascade)

  fromNodeId        String
  fromNode          WorkflowNode                @relation("FromWorkflowNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNodeId          String
  toNode            WorkflowNode                @relation("ToWorkflowNode", fields: [toNodeId], references: [id], onDelete: Cascade)

  // 條件設定
  conditionField    String?
  conditionOperator WorkflowConditionOperator?
  conditionValue    String?
  isDefault         Boolean                     @default(false)

  sortOrder         Int                         @default(0)

  createdAt         DateTime                    @default(now())
  updatedAt         DateTime                    @updatedAt

  @@index([definitionId])
  @@index([fromNodeId])
  @@map("workflow_edges")
}
```

**Step 2: 更新 Group Model 新增 relation**

在 Group model 新增：

```prisma
  workflowDefinitions WorkflowDefinition[]
```

**Step 3: 更新 Company Model 新增 relation**

```prisma
  // 工作流程
  workflowDefinitions WorkflowDefinition[] @relation("CompanyWorkflows")
  workflowInstances   WorkflowInstance[]
```

**Step 4: 更新 Employee Model 新增 relations**

```prisma
  // 工作流程
  workflowDefinitions   WorkflowDefinition[] @relation("EmployeeWorkflows")
  workflowDefinitionsCreated WorkflowDefinition[] @relation("WorkflowCreator")
  workflowInstances     WorkflowInstance[]
  approvalRecordsAsApprover WorkflowApprovalRecord[] @relation("WorkflowApprover")
  approvalRecordsAsSigner   WorkflowApprovalRecord[] @relation("WorkflowActualSigner")
  delegatesAsPrincipal  WorkflowApprovalDelegate[] @relation("DelegatePrincipal")
  delegatesAsDelegate   WorkflowApprovalDelegate[] @relation("DelegateDelegate")
```

**Step 5: 驗證 Schema**

Run: `npx prisma format`
Expected: 格式化成功

---

## Task 5: 新增流程實例與簽核紀錄資料模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增 WorkflowInstance Model**

```prisma
// 流程實例
model WorkflowInstance {
  id              String                  @id @default(cuid())
  definitionId    String
  definition      WorkflowDefinition      @relation(fields: [definitionId], references: [id])

  // 關聯申請單
  requestType     String
  requestId       String

  // 申請人
  applicantId     String
  applicant       Employee                @relation(fields: [applicantId], references: [id])
  companyId       String
  company         Company                 @relation(fields: [companyId], references: [id])

  // 狀態
  status          WorkflowInstanceStatus  @default(DRAFT)
  currentNodeId   String?

  // 時間戳
  submittedAt     DateTime?
  completedAt     DateTime?

  approvalRecords WorkflowApprovalRecord[]

  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@unique([requestType, requestId])
  @@index([applicantId])
  @@index([companyId])
  @@index([status])
  @@map("workflow_instances")
}

// 簽核紀錄
model WorkflowApprovalRecord {
  id              String                  @id @default(cuid())
  instanceId      String
  instance        WorkflowInstance        @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  nodeId          String
  node            WorkflowNode            @relation(fields: [nodeId], references: [id])

  // 簽核人
  approverId      String
  approver        Employee                @relation("WorkflowApprover", fields: [approverId], references: [id])
  actualSignerId  String?
  actualSigner    Employee?               @relation("WorkflowActualSigner", fields: [actualSignerId], references: [id])

  // 簽核結果
  status          WorkflowApprovalStatus  @default(WAITING)
  action          WorkflowApprovalAction?
  comment         String?

  // 時間
  assignedAt      DateTime                @default(now())
  actionAt        DateTime?

  // 加簽/轉簽/退回
  addedSignerIds  String[]
  transferredToId String?
  returnToNodeId  String?

  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@index([instanceId])
  @@index([approverId])
  @@index([status])
  @@map("workflow_approval_records")
}

// 職務代理
model WorkflowApprovalDelegate {
  id              String      @id @default(cuid())
  principalId     String
  principal       Employee    @relation("DelegatePrincipal", fields: [principalId], references: [id])
  delegateId      String
  delegate        Employee    @relation("DelegateDelegate", fields: [delegateId], references: [id])

  startDate       DateTime
  endDate         DateTime

  // 代理範圍
  requestTypes    String[]
  companyIds      String[]

  isActive        Boolean     @default(true)

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([principalId])
  @@index([delegateId])
  @@index([startDate, endDate])
  @@map("workflow_approval_delegates")
}
```

**Step 2: 驗證 Schema**

Run: `npx prisma format`
Expected: 格式化成功

---

## Task 6: 執行資料庫遷移

**Files:**
- Generate: `prisma/migrations/YYYYMMDDHHMMSS_add_workflow_orgchart/migration.sql`

**Step 1: 產生遷移檔案**

Run: `npx prisma migrate dev --name add_workflow_orgchart`
Expected: 遷移成功，產生新的 migration 檔案

**Step 2: 確認 Prisma Client 已更新**

Run: `npx prisma generate`
Expected: Prisma Client 產生成功

**Step 3: Commit Schema 變更**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add workflow engine and org chart schema"
```

---

## Task 7: 建立組織圖 tRPC Router

**Files:**
- Create: `src/server/routers/orgChart.ts`

**Step 1: 建立 orgChart.ts router 檔案**

```typescript
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
      nodeType: z.enum(['DEPARTMENT', 'POSITION', 'EMPLOYEE']),
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
      nodeType: z.enum(['DEPARTMENT', 'POSITION', 'EMPLOYEE']),
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
    }),
})
```

**Step 2: Commit**

```bash
git add src/server/routers/orgChart.ts
git commit -m "feat: add org chart tRPC router"
```

---

## Task 8: 建立流程定義 tRPC Router

**Files:**
- Create: `src/server/routers/workflow.ts`

**Step 1: 建立 workflow.ts router 檔案**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/server/routers/workflow.ts
git commit -m "feat: add workflow tRPC router"
```

---

## Task 9: 建立職務代理 tRPC Router

**Files:**
- Create: `src/server/routers/delegate.ts`

**Step 1: 建立 delegate.ts router 檔案**

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const delegateRouter = router({
  // 取得我的代理設定
  getMyDelegates: publicProcedure
    .input(z.object({ principalId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workflowApprovalDelegate.findMany({
        where: { principalId: input.principalId },
        include: {
          delegate: { select: { id: true, name: true, employeeNo: true } },
        },
        orderBy: { startDate: 'desc' },
      })
    }),

  // 取得代理我的人
  getMyPrincipals: publicProcedure
    .input(z.object({ delegateId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workflowApprovalDelegate.findMany({
        where: { delegateId: input.delegateId, isActive: true },
        include: {
          principal: { select: { id: true, name: true, employeeNo: true } },
        },
        orderBy: { startDate: 'desc' },
      })
    }),

  // 建立職務代理
  create: publicProcedure
    .input(z.object({
      principalId: z.string(),
      delegateId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
      requestTypes: z.array(z.string()).default([]),
      companyIds: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      // 驗證：不能代理自己
      if (input.principalId === input.delegateId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不能指定自己為代理人' })
      }

      // 驗證：結束日期需大於開始日期
      if (input.endDate <= input.startDate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '結束日期需大於開始日期' })
      }

      return ctx.prisma.workflowApprovalDelegate.create({
        data: input,
        include: {
          delegate: { select: { id: true, name: true, employeeNo: true } },
        },
      })
    }),

  // 更新職務代理
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      requestTypes: z.array(z.string()).optional(),
      companyIds: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.workflowApprovalDelegate.update({
        where: { id },
        data,
        include: {
          delegate: { select: { id: true, name: true, employeeNo: true } },
        },
      })
    }),

  // 取消職務代理
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workflowApprovalDelegate.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),

  // 刪除職務代理
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workflowApprovalDelegate.delete({
        where: { id: input.id },
      })
    }),

  // 檢查是否有有效代理人
  getActiveDelegate: publicProcedure
    .input(z.object({
      principalId: z.string(),
      requestType: z.string().optional(),
      companyId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()

      const delegates = await ctx.prisma.workflowApprovalDelegate.findMany({
        where: {
          principalId: input.principalId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          delegate: { select: { id: true, name: true, employeeNo: true } },
        },
      })

      // 過濾符合條件的代理
      const validDelegates = delegates.filter((d) => {
        // 如果有指定申請類型，檢查是否在範圍內
        if (input.requestType && d.requestTypes.length > 0) {
          if (!d.requestTypes.includes(input.requestType)) return false
        }
        // 如果有指定公司，檢查是否在範圍內
        if (input.companyId && d.companyIds.length > 0) {
          if (!d.companyIds.includes(input.companyId)) return false
        }
        return true
      })

      return validDelegates.length > 0 ? validDelegates[0] : null
    }),
})
```

**Step 2: Commit**

```bash
git add src/server/routers/delegate.ts
git commit -m "feat: add workflow delegate tRPC router"
```

---

## Task 10: 註冊新 Router 到 App Router

**Files:**
- Modify: `src/server/routers/_app.ts`

**Step 1: 讀取現有 _app.ts 並新增 imports**

在檔案開頭新增 imports：

```typescript
import { orgChartRouter } from './orgChart'
import { workflowRouter } from './workflow'
import { delegateRouter } from './delegate'
```

**Step 2: 在 router 中新增新的 routers**

```typescript
export const appRouter = router({
  // ... 現有的 routers
  orgChart: orgChartRouter,
  workflow: workflowRouter,
  delegate: delegateRouter,
})
```

**Step 3: Commit**

```bash
git add src/server/routers/_app.ts
git commit -m "feat: register workflow and org chart routers"
```

---

## Task 11: 最終驗證

**Step 1: 執行 TypeScript 類型檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 2: 執行開發伺服器測試**

Run: `npm run dev`
Expected: 伺服器正常啟動

**Step 3: 建立總結 Commit**

```bash
git add .
git commit -m "feat: complete Phase 1 - workflow engine and org chart foundation

- Add Prisma schema for OrgChart, OrgNode, OrgRelation
- Add Prisma schema for WorkflowDefinition, WorkflowNode, WorkflowEdge
- Add Prisma schema for WorkflowInstance, WorkflowApprovalRecord
- Add Prisma schema for WorkflowApprovalDelegate
- Create orgChart tRPC router with CRUD operations
- Create workflow tRPC router with design save/load
- Create delegate tRPC router for approval delegation
- Register all new routers in app router"
```

---

## Summary

Phase 1 完成後，您將擁有：

| 功能 | 狀態 |
|------|------|
| 組織圖資料模型 | ✅ |
| 組織圖 CRUD API | ✅ |
| 流程定義資料模型 | ✅ |
| 流程定義 CRUD API | ✅ |
| 流程設計儲存/載入 | ✅ |
| 職務代理 API | ✅ |
| 流程優先權查詢 | ✅ |

下一階段（Phase 2）將實作：
- 組織圖可視化編輯器 UI
- React Flow 整合
