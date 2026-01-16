# Phase 4: 審核流程引擎 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立通用審核流程引擎，支援多關卡簽核、照會機制、條件式流程路由

**Architecture:**
- 新增審核流程模板（ApprovalFlow）定義可重複使用的審核流程
- 新增審核關卡（ApprovalStep）支援多層簽核
- 新增審核實例（ApprovalInstance）追蹤每筆申請的審核進度
- 支援條件式路由（依金額、天數、類型等條件決定流程）
- 照會機制（CC）通知相關人員但不需簽核

**Tech Stack:** Next.js 14, tRPC, Prisma, PostgreSQL, TailwindCSS, shadcn/ui

---

## Task 1: 新增審核流程 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增審核流程相關模型**

在 `prisma/schema.prisma` 檔案末尾加入：

```prisma
// ==================== 審核流程引擎 ====================

// 審核流程模板
model ApprovalFlow {
  id          String   @id @default(cuid())
  companyId   String?  // NULL = 集團通用
  code        String   // LEAVE, EXPENSE, OVERTIME, etc.
  name        String
  description String?
  module      String   // leave, expense, overtime, etc.

  // 條件觸發（JSON 格式）
  // 例如：{"minDays": 3, "leaveTypes": ["ANNUAL"]}
  conditions  String?

  isActive    Boolean  @default(true)
  isDefault   Boolean  @default(false) // 是否為該模組預設流程
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company   Company?       @relation(fields: [companyId], references: [id])
  steps     ApprovalStep[]
  instances ApprovalInstance[]

  @@unique([companyId, code])
  @@map("approval_flows")
}

// 審核關卡
model ApprovalStep {
  id         String   @id @default(cuid())
  flowId     String
  stepOrder  Int      // 關卡順序（1, 2, 3...）
  name       String   // 關卡名稱（如：直屬主管、部門主管、總經理）

  // 審核者設定
  approverType   ApproverType
  // SUPERVISOR: 直屬主管
  // DEPARTMENT_HEAD: 部門主管
  // POSITION_LEVEL: 指定職級以上
  // SPECIFIC_POSITION: 指定職位
  // SPECIFIC_EMPLOYEE: 指定員工
  // ROLE: 指定角色

  approverValue  String?  // 視 approverType 而定的值
  // POSITION_LEVEL: "3" (職級數字)
  // SPECIFIC_POSITION: positionId
  // SPECIFIC_EMPLOYEE: employeeId
  // ROLE: roleId

  // 簽核規則
  approvalMode   ApprovalMode @default(ANY)
  // ANY: 任一人核准即可
  // ALL: 全部人都需核准
  // MAJORITY: 過半數核准

  // 是否可跳過
  canSkip        Boolean  @default(false)
  skipCondition  String?  // JSON 格式跳過條件

  // 照會人（不需簽核但會收到通知）
  ccType         ApproverType?
  ccValue        String?

  // 逾時設定
  timeoutHours   Int      @default(0)  // 0 = 無逾時
  timeoutAction  TimeoutAction @default(NONE)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  flow           ApprovalFlow       @relation(fields: [flowId], references: [id], onDelete: Cascade)
  stepInstances  ApprovalStepInstance[]

  @@unique([flowId, stepOrder])
  @@map("approval_steps")
}

enum ApproverType {
  SUPERVISOR       // 直屬主管
  DEPARTMENT_HEAD  // 部門主管
  POSITION_LEVEL   // 指定職級以上
  SPECIFIC_POSITION // 指定職位
  SPECIFIC_EMPLOYEE // 指定員工
  ROLE             // 指定角色
}

enum ApprovalMode {
  ANY       // 任一人
  ALL       // 全部
  MAJORITY  // 過半數
}

enum TimeoutAction {
  NONE      // 無動作
  REMIND    // 提醒
  ESCALATE  // 升級至下一關
  AUTO_APPROVE // 自動核准
  AUTO_REJECT  // 自動拒絕
}

// 審核流程實例（每筆申請一個實例）
model ApprovalInstance {
  id           String   @id @default(cuid())
  flowId       String

  // 關聯的申請單
  module       String   // leave, expense, overtime
  referenceId  String   // LeaveRequest.id, ExpenseRequest.id, etc.

  // 申請人資訊
  applicantId  String   // employeeId
  companyId    String

  // 狀態
  status       ApprovalInstanceStatus @default(IN_PROGRESS)
  currentStep  Int      @default(1)  // 當前關卡順序

  // 時間戳
  startedAt    DateTime @default(now())
  completedAt  DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  flow         ApprovalFlow          @relation(fields: [flowId], references: [id])
  stepInstances ApprovalStepInstance[]

  @@unique([module, referenceId])
  @@index([applicantId, companyId])
  @@index([status])
  @@map("approval_instances")
}

enum ApprovalInstanceStatus {
  IN_PROGRESS  // 審核中
  APPROVED     // 已核准
  REJECTED     // 已拒絕
  CANCELLED    // 已取消
}

// 審核關卡實例（追蹤每個關卡的審核狀態）
model ApprovalStepInstance {
  id           String   @id @default(cuid())
  instanceId   String
  stepId       String
  stepOrder    Int

  // 審核者（可能多人）
  assignedTo   String   // JSON array of employeeIds

  // 審核結果
  status       StepInstanceStatus @default(PENDING)

  // 時間戳
  assignedAt   DateTime @default(now())
  dueAt        DateTime?
  completedAt  DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  instance     ApprovalInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  step         ApprovalStep     @relation(fields: [stepId], references: [id])
  actions      ApprovalAction[]

  @@unique([instanceId, stepOrder])
  @@map("approval_step_instances")
}

enum StepInstanceStatus {
  PENDING    // 待審核
  APPROVED   // 已核准
  REJECTED   // 已拒絕
  SKIPPED    // 已跳過
}

// 審核動作記錄
model ApprovalAction {
  id              String   @id @default(cuid())
  stepInstanceId  String

  // 審核者
  actorId         String   // employeeId

  // 動作
  action          ActionType
  comment         String?

  // 時間戳
  actedAt         DateTime @default(now())

  stepInstance    ApprovalStepInstance @relation(fields: [stepInstanceId], references: [id], onDelete: Cascade)

  @@map("approval_actions")
}

enum ActionType {
  APPROVE   // 核准
  REJECT    // 拒絕
  RETURN    // 退回（重新修改）
  DELEGATE  // 委託他人
  CC        // 照會已讀
}
```

**Step 2: 更新 Company model 加入 approvalFlows 關聯**

在 `Company` model 中加入：

```prisma
approvalFlows ApprovalFlow[]
```

**Step 3: 執行 migration**

```bash
cd .worktrees/initial-setup
npx prisma db push
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(approval): 新增審核流程引擎資料模型

- ApprovalFlow: 審核流程模板
- ApprovalStep: 審核關卡定義
- ApprovalInstance: 審核流程實例
- ApprovalStepInstance: 關卡審核進度
- ApprovalAction: 審核動作記錄

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 建立審核流程模板 tRPC Router

**Files:**
- Create: `src/server/routers/approvalFlow.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 approvalFlow router**

建立 `src/server/routers/approvalFlow.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const approvalFlowRouter = router({
  // 取得模組可用的審核流程
  listByModule: publicProcedure
    .input(z.object({
      companyId: z.string(),
      module: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalFlow.findMany({
        where: {
          module: input.module,
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      })
    }),

  // 取得單一流程詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalFlow.findUnique({
        where: { id: input.id },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
    }),

  // 建立審核流程
  create: publicProcedure
    .input(z.object({
      companyId: z.string().optional(),
      code: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      module: z.string(),
      conditions: z.string().optional(),
      isDefault: z.boolean().default(false),
      steps: z.array(z.object({
        stepOrder: z.number(),
        name: z.string(),
        approverType: z.enum([
          'SUPERVISOR', 'DEPARTMENT_HEAD', 'POSITION_LEVEL',
          'SPECIFIC_POSITION', 'SPECIFIC_EMPLOYEE', 'ROLE'
        ]),
        approverValue: z.string().optional(),
        approvalMode: z.enum(['ANY', 'ALL', 'MAJORITY']).default('ANY'),
        canSkip: z.boolean().default(false),
        skipCondition: z.string().optional(),
        ccType: z.enum([
          'SUPERVISOR', 'DEPARTMENT_HEAD', 'POSITION_LEVEL',
          'SPECIFIC_POSITION', 'SPECIFIC_EMPLOYEE', 'ROLE'
        ]).optional(),
        ccValue: z.string().optional(),
        timeoutHours: z.number().default(0),
        timeoutAction: z.enum(['NONE', 'REMIND', 'ESCALATE', 'AUTO_APPROVE', 'AUTO_REJECT']).default('NONE'),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { steps, ...flowData } = input

      // 如果設為預設，先取消其他預設
      if (flowData.isDefault) {
        await ctx.prisma.approvalFlow.updateMany({
          where: {
            module: flowData.module,
            companyId: flowData.companyId || null,
            isDefault: true,
          },
          data: { isDefault: false },
        })
      }

      return ctx.prisma.approvalFlow.create({
        data: {
          ...flowData,
          steps: {
            create: steps,
          },
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
    }),

  // 更新審核流程
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      conditions: z.string().optional(),
      isActive: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      // 如果設為預設，先取消其他預設
      if (data.isDefault) {
        const flow = await ctx.prisma.approvalFlow.findUnique({ where: { id } })
        if (flow) {
          await ctx.prisma.approvalFlow.updateMany({
            where: {
              module: flow.module,
              companyId: flow.companyId,
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          })
        }
      }

      return ctx.prisma.approvalFlow.update({
        where: { id },
        data,
      })
    }),

  // 刪除審核流程
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否有進行中的實例
      const activeInstances = await ctx.prisma.approvalInstance.count({
        where: {
          flowId: input.id,
          status: 'IN_PROGRESS',
        },
      })

      if (activeInstances > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `此流程有 ${activeInstances} 筆審核中的申請，無法刪除`,
        })
      }

      return ctx.prisma.approvalFlow.delete({
        where: { id: input.id },
      })
    }),

  // 根據條件匹配流程
  matchFlow: publicProcedure
    .input(z.object({
      companyId: z.string(),
      module: z.string(),
      context: z.record(z.any()), // 條件上下文，如 { totalDays: 5, leaveType: 'ANNUAL' }
    }))
    .query(async ({ ctx, input }) => {
      const flows = await ctx.prisma.approvalFlow.findMany({
        where: {
          module: input.module,
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
        orderBy: [{ companyId: 'desc' }, { sortOrder: 'asc' }],
      })

      // 找到第一個匹配條件的流程
      for (const flow of flows) {
        if (!flow.conditions) {
          if (flow.isDefault) return flow
          continue
        }

        try {
          const conditions = JSON.parse(flow.conditions)
          let match = true

          // 檢查條件
          if (conditions.minDays && input.context.totalDays < conditions.minDays) {
            match = false
          }
          if (conditions.maxDays && input.context.totalDays > conditions.maxDays) {
            match = false
          }
          if (conditions.leaveTypes && !conditions.leaveTypes.includes(input.context.leaveType)) {
            match = false
          }
          if (conditions.minAmount && input.context.amount < conditions.minAmount) {
            match = false
          }

          if (match) return flow
        } catch {
          continue
        }
      }

      // 返回預設流程
      return flows.find(f => f.isDefault) || flows[0] || null
    }),
})
```

**Step 2: 更新 _app.ts**

```typescript
import { approvalFlowRouter } from './approvalFlow'

// 在 router 中加入
approvalFlow: approvalFlowRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(approval): 新增審核流程模板 tRPC API

- listByModule: 取得模組可用流程
- create/update/delete: CRUD 操作
- matchFlow: 根據條件匹配適用流程

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 建立審核實例 tRPC Router

**Files:**
- Create: `src/server/routers/approvalInstance.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 approvalInstance router**

建立 `src/server/routers/approvalInstance.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// 根據 approverType 解析實際審核者
async function resolveApprovers(
  prisma: any,
  approverType: string,
  approverValue: string | null,
  applicantId: string,
  companyId: string
): Promise<string[]> {
  const assignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId: applicantId, companyId, status: 'ACTIVE' },
    include: { department: true, position: true },
  })

  if (!assignment) return []

  switch (approverType) {
    case 'SUPERVISOR':
      return assignment.supervisorId ? [assignment.supervisorId] : []

    case 'DEPARTMENT_HEAD':
      // 找部門主管（假設部門有 headId 或找該部門職級最高者）
      const deptHead = await prisma.employeeAssignment.findFirst({
        where: {
          companyId,
          departmentId: assignment.departmentId,
          status: 'ACTIVE',
          position: { level: { gte: 3 } }, // 假設職級 3+ 為主管
        },
        orderBy: { position: { level: 'desc' } },
      })
      return deptHead ? [deptHead.id] : []

    case 'POSITION_LEVEL':
      const level = parseInt(approverValue || '0')
      const levelApprovers = await prisma.employeeAssignment.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          position: { level: { gte: level } },
        },
        select: { id: true },
      })
      return levelApprovers.map((a: { id: string }) => a.id)

    case 'SPECIFIC_POSITION':
      const positionApprovers = await prisma.employeeAssignment.findMany({
        where: {
          companyId,
          positionId: approverValue,
          status: 'ACTIVE',
        },
        select: { id: true },
      })
      return positionApprovers.map((a: { id: string }) => a.id)

    case 'SPECIFIC_EMPLOYEE':
      return approverValue ? [approverValue] : []

    case 'ROLE':
      const roleApprovers = await prisma.employeeAssignment.findMany({
        where: {
          companyId,
          roleId: approverValue,
          status: 'ACTIVE',
        },
        select: { id: true },
      })
      return roleApprovers.map((a: { id: string }) => a.id)

    default:
      return []
  }
}

export const approvalInstanceRouter = router({
  // 建立審核實例（啟動審核流程）
  create: publicProcedure
    .input(z.object({
      flowId: z.string(),
      module: z.string(),
      referenceId: z.string(),
      applicantId: z.string(),
      companyId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 取得流程定義
      const flow = await ctx.prisma.approvalFlow.findUnique({
        where: { id: input.flowId },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
        },
      })

      if (!flow || flow.steps.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '審核流程不存在或無關卡' })
      }

      // 建立實例
      const instance = await ctx.prisma.approvalInstance.create({
        data: {
          flowId: input.flowId,
          module: input.module,
          referenceId: input.referenceId,
          applicantId: input.applicantId,
          companyId: input.companyId,
          status: 'IN_PROGRESS',
          currentStep: 1,
        },
      })

      // 建立第一個關卡實例
      const firstStep = flow.steps[0]
      const approvers = await resolveApprovers(
        ctx.prisma,
        firstStep.approverType,
        firstStep.approverValue,
        input.applicantId,
        input.companyId
      )

      await ctx.prisma.approvalStepInstance.create({
        data: {
          instanceId: instance.id,
          stepId: firstStep.id,
          stepOrder: 1,
          assignedTo: JSON.stringify(approvers),
          status: 'PENDING',
          dueAt: firstStep.timeoutHours > 0
            ? new Date(Date.now() + firstStep.timeoutHours * 60 * 60 * 1000)
            : null,
        },
      })

      return instance
    }),

  // 執行審核動作
  act: publicProcedure
    .input(z.object({
      instanceId: z.string(),
      actorId: z.string(),
      action: z.enum(['APPROVE', 'REJECT', 'RETURN', 'DELEGATE']),
      comment: z.string().optional(),
      delegateTo: z.string().optional(), // 委託對象
    }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.approvalInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          flow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          stepInstances: {
            where: { status: 'PENDING' },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })

      if (!instance) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '審核實例不存在' })
      }

      if (instance.status !== 'IN_PROGRESS') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此審核已結束' })
      }

      const currentStepInstance = instance.stepInstances[0]
      if (!currentStepInstance) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '無待審核關卡' })
      }

      // 驗證是否有權審核
      const assignedApprovers = JSON.parse(currentStepInstance.assignedTo || '[]')
      if (!assignedApprovers.includes(input.actorId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您無權審核此申請' })
      }

      // 記錄審核動作
      await ctx.prisma.approvalAction.create({
        data: {
          stepInstanceId: currentStepInstance.id,
          actorId: input.actorId,
          action: input.action,
          comment: input.comment,
        },
      })

      // 處理不同動作
      if (input.action === 'REJECT') {
        // 拒絕：結束整個流程
        await ctx.prisma.approvalStepInstance.update({
          where: { id: currentStepInstance.id },
          data: { status: 'REJECTED', completedAt: new Date() },
        })

        return ctx.prisma.approvalInstance.update({
          where: { id: input.instanceId },
          data: { status: 'REJECTED', completedAt: new Date() },
        })
      }

      if (input.action === 'RETURN') {
        // 退回：結束流程，讓申請者重新修改
        await ctx.prisma.approvalStepInstance.update({
          where: { id: currentStepInstance.id },
          data: { status: 'REJECTED', completedAt: new Date() },
        })

        return ctx.prisma.approvalInstance.update({
          where: { id: input.instanceId },
          data: { status: 'REJECTED', completedAt: new Date() },
        })
      }

      if (input.action === 'DELEGATE') {
        // 委託：更新審核者
        if (!input.delegateTo) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '需指定委託對象' })
        }

        return ctx.prisma.approvalStepInstance.update({
          where: { id: currentStepInstance.id },
          data: {
            assignedTo: JSON.stringify([input.delegateTo]),
          },
        })
      }

      // APPROVE：核准當前關卡
      const currentStep = instance.flow.steps.find(s => s.stepOrder === instance.currentStep)

      // 檢查是否需要所有人核准
      if (currentStep?.approvalMode === 'ALL') {
        const actions = await ctx.prisma.approvalAction.findMany({
          where: {
            stepInstanceId: currentStepInstance.id,
            action: 'APPROVE',
          },
        })
        const approvedBy = new Set(actions.map(a => a.actorId))
        approvedBy.add(input.actorId)

        if (approvedBy.size < assignedApprovers.length) {
          // 還有人未核准
          return instance
        }
      }

      // 核准當前關卡
      await ctx.prisma.approvalStepInstance.update({
        where: { id: currentStepInstance.id },
        data: { status: 'APPROVED', completedAt: new Date() },
      })

      // 檢查是否有下一關
      const nextStep = instance.flow.steps.find(s => s.stepOrder === instance.currentStep + 1)

      if (!nextStep) {
        // 無下一關，流程完成
        return ctx.prisma.approvalInstance.update({
          where: { id: input.instanceId },
          data: {
            status: 'APPROVED',
            completedAt: new Date(),
          },
        })
      }

      // 建立下一關卡實例
      const nextApprovers = await resolveApprovers(
        ctx.prisma,
        nextStep.approverType,
        nextStep.approverValue,
        instance.applicantId,
        instance.companyId
      )

      await ctx.prisma.approvalStepInstance.create({
        data: {
          instanceId: instance.id,
          stepId: nextStep.id,
          stepOrder: nextStep.stepOrder,
          assignedTo: JSON.stringify(nextApprovers),
          status: 'PENDING',
          dueAt: nextStep.timeoutHours > 0
            ? new Date(Date.now() + nextStep.timeoutHours * 60 * 60 * 1000)
            : null,
        },
      })

      return ctx.prisma.approvalInstance.update({
        where: { id: input.instanceId },
        data: { currentStep: nextStep.stepOrder },
      })
    }),

  // 取得審核實例詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalInstance.findUnique({
        where: { id: input.id },
        include: {
          flow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          stepInstances: {
            include: {
              step: true,
              actions: {
                orderBy: { actedAt: 'desc' },
              },
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
    }),

  // 取得待我審核的列表
  listPendingForMe: publicProcedure
    .input(z.object({ approverId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 找出所有包含此審核者的待審核關卡
      const pendingSteps = await ctx.prisma.approvalStepInstance.findMany({
        where: {
          status: 'PENDING',
          assignedTo: { contains: input.approverId },
        },
        include: {
          instance: {
            include: {
              flow: true,
            },
          },
          step: true,
        },
        orderBy: { assignedAt: 'asc' },
      })

      return pendingSteps
    }),

  // 取得申請的審核狀態
  getByReference: publicProcedure
    .input(z.object({
      module: z.string(),
      referenceId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalInstance.findUnique({
        where: {
          module_referenceId: {
            module: input.module,
            referenceId: input.referenceId,
          },
        },
        include: {
          flow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          stepInstances: {
            include: {
              step: true,
              actions: {
                orderBy: { actedAt: 'desc' },
              },
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
    }),
})
```

**Step 2: 更新 _app.ts**

```typescript
import { approvalInstanceRouter } from './approvalInstance'

// 在 router 中加入
approvalInstance: approvalInstanceRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(approval): 新增審核實例 tRPC API

- create: 建立審核實例（啟動流程）
- act: 執行審核動作（核准/拒絕/退回/委託）
- listPendingForMe: 待我審核列表
- getByReference: 取得申請的審核狀態

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 整合請假模組與審核流程引擎

**Files:**
- Modify: `src/server/routers/leaveRequest.ts`

**Step 1: 更新 leaveRequest.submit 整合審核流程**

在 `leaveRequest.ts` 中修改 `submit` procedure：

```typescript
  // 送出申請
  submit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: { leaveType: true },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以送出' })
      }

      // 計算請假天數
      const totalDays = request.totalHours / 8

      // 匹配適用的審核流程
      const flows = await ctx.prisma.approvalFlow.findMany({
        where: {
          module: 'leave',
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: request.companyId },
          ],
        },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
        },
        orderBy: [{ companyId: 'desc' }, { sortOrder: 'asc' }],
      })

      // 找到匹配的流程
      let matchedFlow = null
      for (const flow of flows) {
        if (!flow.conditions) {
          if (flow.isDefault) {
            matchedFlow = flow
            break
          }
          continue
        }

        try {
          const conditions = JSON.parse(flow.conditions)
          let match = true

          if (conditions.minDays && totalDays < conditions.minDays) match = false
          if (conditions.maxDays && totalDays > conditions.maxDays) match = false
          if (conditions.leaveTypes && !conditions.leaveTypes.includes(request.leaveType.code)) match = false

          if (match) {
            matchedFlow = flow
            break
          }
        } catch {
          continue
        }
      }

      if (!matchedFlow) {
        matchedFlow = flows.find(f => f.isDefault) || flows[0]
      }

      // 更新請假申請狀態
      const updatedRequest = await ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: 'PENDING',
          submittedAt: new Date(),
        },
      })

      // 如果有審核流程，建立審核實例
      if (matchedFlow && matchedFlow.steps.length > 0) {
        const firstStep = matchedFlow.steps[0]

        // 解析第一關審核者
        const assignment = await ctx.prisma.employeeAssignment.findFirst({
          where: { employeeId: request.employeeId, companyId: request.companyId, status: 'ACTIVE' },
        })

        let approvers: string[] = []
        if (firstStep.approverType === 'SUPERVISOR' && assignment?.supervisorId) {
          approvers = [assignment.supervisorId]
        }

        // 建立審核實例
        const instance = await ctx.prisma.approvalInstance.create({
          data: {
            flowId: matchedFlow.id,
            module: 'leave',
            referenceId: request.id,
            applicantId: request.employeeId,
            companyId: request.companyId,
            status: 'IN_PROGRESS',
            currentStep: 1,
          },
        })

        // 建立第一個關卡實例
        await ctx.prisma.approvalStepInstance.create({
          data: {
            instanceId: instance.id,
            stepId: firstStep.id,
            stepOrder: 1,
            assignedTo: JSON.stringify(approvers),
            status: 'PENDING',
          },
        })

        // 更新請假申請的當前審核者
        await ctx.prisma.leaveRequest.update({
          where: { id: input.id },
          data: { currentApproverId: approvers[0] || null },
        })
      }

      return updatedRequest
    }),
```

**Step 2: 更新 approve procedure 整合審核引擎**

```typescript
  // 審核（核准/拒絕）
  approve: publicProcedure
    .input(z.object({
      id: z.string(),
      action: z.enum(['APPROVE', 'REJECT']),
      approverId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: { leaveType: true },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請單無法審核' })
      }

      // 查找審核實例
      const instance = await ctx.prisma.approvalInstance.findUnique({
        where: {
          module_referenceId: {
            module: 'leave',
            referenceId: input.id,
          },
        },
        include: {
          flow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          stepInstances: {
            where: { status: 'PENDING' },
            include: { step: true },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })

      if (instance && instance.stepInstances.length > 0) {
        const currentStepInstance = instance.stepInstances[0]

        // 記錄審核動作
        await ctx.prisma.approvalAction.create({
          data: {
            stepInstanceId: currentStepInstance.id,
            actorId: input.approverId,
            action: input.action,
            comment: input.comment,
          },
        })

        if (input.action === 'REJECT') {
          // 拒絕：結束審核流程
          await ctx.prisma.approvalStepInstance.update({
            where: { id: currentStepInstance.id },
            data: { status: 'REJECTED', completedAt: new Date() },
          })

          await ctx.prisma.approvalInstance.update({
            where: { id: instance.id },
            data: { status: 'REJECTED', completedAt: new Date() },
          })

          return ctx.prisma.leaveRequest.update({
            where: { id: input.id },
            data: {
              status: 'REJECTED',
              processedAt: new Date(),
              rejectedById: input.approverId,
              approvalComment: input.comment,
            },
          })
        }

        // 核准當前關卡
        await ctx.prisma.approvalStepInstance.update({
          where: { id: currentStepInstance.id },
          data: { status: 'APPROVED', completedAt: new Date() },
        })

        // 檢查是否有下一關
        const nextStep = instance.flow.steps.find(s => s.stepOrder === instance.currentStep + 1)

        if (nextStep) {
          // 有下一關，建立下一關卡實例
          const assignment = await ctx.prisma.employeeAssignment.findFirst({
            where: { employeeId: request.employeeId, companyId: request.companyId, status: 'ACTIVE' },
          })

          let nextApprovers: string[] = []
          if (nextStep.approverType === 'SUPERVISOR' && assignment?.supervisorId) {
            // 找上一層主管
            const supervisor = await ctx.prisma.employeeAssignment.findUnique({
              where: { id: assignment.supervisorId },
            })
            if (supervisor?.supervisorId) {
              nextApprovers = [supervisor.supervisorId]
            }
          }

          await ctx.prisma.approvalStepInstance.create({
            data: {
              instanceId: instance.id,
              stepId: nextStep.id,
              stepOrder: nextStep.stepOrder,
              assignedTo: JSON.stringify(nextApprovers),
              status: 'PENDING',
            },
          })

          await ctx.prisma.approvalInstance.update({
            where: { id: instance.id },
            data: { currentStep: nextStep.stepOrder },
          })

          // 更新請假申請的當前審核者
          return ctx.prisma.leaveRequest.update({
            where: { id: input.id },
            data: { currentApproverId: nextApprovers[0] || null },
          })
        }

        // 無下一關，流程完成
        await ctx.prisma.approvalInstance.update({
          where: { id: instance.id },
          data: { status: 'APPROVED', completedAt: new Date() },
        })
      }

      // 更新請假申請為已核准
      const updated = await ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
          approvedById: input.approverId,
          approvalComment: input.comment,
        },
      })

      // 更新假別餘額
      const year = new Date().getFullYear()
      await ctx.prisma.leaveBalance.upsert({
        where: {
          employeeId_companyId_leaveTypeId_year: {
            employeeId: request.employeeId,
            companyId: request.companyId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
        update: {
          usedHours: { increment: request.totalHours },
        },
        create: {
          employeeId: request.employeeId,
          companyId: request.companyId,
          leaveTypeId: request.leaveTypeId,
          year,
          usedHours: request.totalHours,
        },
      })

      return updated
    }),
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(approval): 整合請假模組與審核流程引擎

- submit: 自動匹配並啟動審核流程
- approve: 支援多關卡審核流程

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 建立審核流程設定頁面

**Files:**
- Create: `src/app/dashboard/settings/approval-flows/page.tsx`
- Create: `src/components/approval/flow-form.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

**Step 1: 建立審核流程設定頁面**

建立 `src/app/dashboard/settings/approval-flows/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GitBranch, Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ApprovalFlowsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得所有審核流程
  const flows = await prisma.approvalFlow.findMany({
    where: { isActive: true },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
      company: true,
    },
    orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }],
  })

  const moduleNames: Record<string, string> = {
    leave: '請假',
    expense: '費用報銷',
    overtime: '加班',
  }

  const approverTypeNames: Record<string, string> = {
    SUPERVISOR: '直屬主管',
    DEPARTMENT_HEAD: '部門主管',
    POSITION_LEVEL: '指定職級',
    SPECIFIC_POSITION: '指定職位',
    SPECIFIC_EMPLOYEE: '指定員工',
    ROLE: '指定角色',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">審核流程設定</h1>
        <Button asChild>
          <Link href="/dashboard/settings/approval-flows/new">
            <Plus className="h-4 w-4 mr-2" />
            新增流程
          </Link>
        </Button>
      </div>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">尚未設定任何審核流程</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    {flow.name}
                    {flow.isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                        預設
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-normal text-muted-foreground">
                    {moduleNames[flow.module] || flow.module}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  {flow.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div className="px-3 py-1.5 bg-muted rounded-lg text-sm">
                        <span className="font-medium">{step.name}</span>
                        <span className="text-muted-foreground ml-1">
                          ({approverTypeNames[step.approverType]})
                        </span>
                      </div>
                      {index < flow.steps.length - 1 && (
                        <span className="mx-2 text-muted-foreground">→</span>
                      )}
                    </div>
                  ))}
                </div>
                {flow.conditions && (
                  <p className="text-sm text-muted-foreground mt-2">
                    條件：{flow.conditions}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: 更新系統設定頁面，新增審核流程連結**

在 `src/app/dashboard/settings/page.tsx` 的 `settingsItems` 陣列中加入：

```typescript
{
  title: '審核流程',
  description: '設定各模組的審核流程與關卡',
  href: '/dashboard/settings/approval-flows',
  icon: GitBranch,
},
```

同時在 import 中加入 `GitBranch`。

**Step 3: 驗證編譯**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/dashboard/settings/
git commit -m "feat(approval): 建立審核流程設定頁面

- 審核流程列表顯示
- 新增設定入口

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 更新審核中心顯示審核進度

**Files:**
- Modify: `src/components/approval/pending-list.tsx`
- Modify: `src/app/dashboard/approval/page.tsx`

**Step 1: 更新 pending-list 顯示審核進度**

修改 `src/components/approval/pending-list.tsx` 加入審核進度顯示：

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc'
import { FileText, Check, X, ChevronRight } from 'lucide-react'

interface PendingListProps {
  approverId: string
}

export function PendingList({ approverId }: PendingListProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)

  const { data: pendingRequests, refetch } = trpc.leaveRequest.listPending.useQuery({
    approverId,
  })

  const approveMutation = trpc.leaveRequest.approve.useMutation({
    onSuccess: () => refetch(),
  })

  const handleApprove = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setProcessingId(id)
    try {
      await approveMutation.mutateAsync({
        id,
        action,
        approverId,
      })
    } catch (error) {
      console.error('Approve error:', error)
      alert(error instanceof Error ? error.message : '審核失敗')
    } finally {
      setProcessingId(null)
    }
  }

  if (!pendingRequests?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            待審核請假
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">目前沒有待審核的請假申請</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          待審核請假 ({pendingRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingRequests.map((req) => (
            <div key={req.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">{req.requestNo}</p>
                  <p className="text-sm text-muted-foreground">
                    {req.leaveType.name} | {req.totalHours / 8} 天
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {new Date(req.startDate).toLocaleDateString('zh-TW')}
                  {req.startDate.getTime() !== req.endDate.getTime() && (
                    <> ~ {new Date(req.endDate).toLocaleDateString('zh-TW')}</>
                  )}
                </div>
              </div>
              {req.reason && (
                <p className="text-sm text-muted-foreground mb-3">
                  事由：{req.reason}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(req.id, 'APPROVE')}
                  disabled={processingId === req.id}
                >
                  <Check className="h-4 w-4 mr-1" />
                  核准
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleApprove(req.id, 'REJECT')}
                  disabled={processingId === req.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  拒絕
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: 驗證編譯**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/approval/ src/app/dashboard/approval/
git commit -m "feat(approval): 更新審核中心顯示

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 更新 Seed 加入預設審核流程

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: 新增預設審核流程到 seed**

在 `prisma/seed.ts` 末尾加入：

```typescript
  // 12. 建立預設審核流程
  // 刪除現有的審核流程
  await prisma.approvalAction.deleteMany({})
  await prisma.approvalStepInstance.deleteMany({})
  await prisma.approvalInstance.deleteMany({})
  await prisma.approvalStep.deleteMany({})
  await prisma.approvalFlow.deleteMany({})

  // 請假審核流程 - 一般（3天以內，單關卡）
  const leaveFlowShort = await prisma.approvalFlow.create({
    data: {
      code: 'LEAVE_SHORT',
      name: '請假審核（3天以內）',
      module: 'leave',
      conditions: JSON.stringify({ maxDays: 3 }),
      isDefault: false,
      sortOrder: 1,
      steps: {
        create: [
          {
            stepOrder: 1,
            name: '直屬主管',
            approverType: 'SUPERVISOR',
            approvalMode: 'ANY',
          },
        ],
      },
    },
  })

  // 請假審核流程 - 長假（超過3天，多關卡）
  const leaveFlowLong = await prisma.approvalFlow.create({
    data: {
      code: 'LEAVE_LONG',
      name: '請假審核（超過3天）',
      module: 'leave',
      conditions: JSON.stringify({ minDays: 4 }),
      isDefault: false,
      sortOrder: 2,
      steps: {
        create: [
          {
            stepOrder: 1,
            name: '直屬主管',
            approverType: 'SUPERVISOR',
            approvalMode: 'ANY',
          },
          {
            stepOrder: 2,
            name: '部門主管',
            approverType: 'DEPARTMENT_HEAD',
            approvalMode: 'ANY',
          },
        ],
      },
    },
  })

  // 請假審核流程 - 預設
  const leaveFlowDefault = await prisma.approvalFlow.create({
    data: {
      code: 'LEAVE_DEFAULT',
      name: '請假審核（預設）',
      module: 'leave',
      isDefault: true,
      sortOrder: 99,
      steps: {
        create: [
          {
            stepOrder: 1,
            name: '直屬主管',
            approverType: 'SUPERVISOR',
            approvalMode: 'ANY',
          },
        ],
      },
    },
  })

  console.log('✅ 預設審核流程已建立')
```

**Step 2: 執行 seed**

```bash
npm run db:seed
```

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(approval): 新增預設審核流程 seed

- 請假審核（3天以內）：單關卡
- 請假審核（超過3天）：多關卡
- 請假審核（預設）

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 測試與部署

**Step 1: 驗證編譯**

```bash
npm run build
```

**Step 2: 推送到 GitHub**

```bash
git push origin feature/initial-setup
```

**Step 3: 合併到 master**

```bash
cd C:\ClaudeCode\your-remit-erp02
git fetch origin
git checkout master
git merge origin/feature/initial-setup --no-edit
git push origin master
```

**Step 4: 確認 Netlify 部署完成**

---

## Summary

Phase 4 審核流程引擎包含：

| 功能 | 說明 |
|-----|------|
| 審核流程模板 | 可重複使用的審核流程定義 |
| 多關卡簽核 | 支援 1-N 關卡，依序審核 |
| 條件式路由 | 依天數、金額等條件選擇流程 |
| 審核者類型 | 直屬主管、部門主管、指定職位、指定員工、指定角色 |
| 審核模式 | 任一人、全部、過半數核准 |
| 照會機制 | 通知相關人員但不需簽核 |
| 逾時處理 | 提醒、升級、自動核准/拒絕 |

**下一階段 (Phase 5)：** 財務會計模組（費用報銷、薪資計算）
