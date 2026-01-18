# Phase 5: 財務會計模組 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立費用報銷申請系統，整合審核流程引擎，支援多種費用類別與報銷流程

**Architecture:**
- 新增費用類別（ExpenseCategory）管理不同類型的費用
- 新增費用報銷申請（ExpenseRequest）支援明細項目與附件
- 整合 Phase 4 審核流程引擎，支援依金額分級審核
- 提供費用報銷申請、審核、查詢完整流程

**Tech Stack:** Next.js 14, tRPC, Prisma, PostgreSQL, TailwindCSS, shadcn/ui

---

## Task 1: 新增費用報銷 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增費用報銷相關模型**

在 `prisma/schema.prisma` 檔案末尾加入：

```prisma
// ==================== 費用報銷 ====================

// 費用類別
model ExpenseCategory {
  id           String   @id @default(cuid())
  companyId    String?  // NULL = 集團通用
  code         String   // TRAVEL, MEAL, TRANSPORT, SUPPLIES, etc.
  name         String
  description  String?

  // 報銷規則
  requiresReceipt      Boolean @default(true)  // 是否需要發票/收據
  maxAmountPerItem     Float?                  // 單項最高金額限制
  maxAmountPerMonth    Float?                  // 每月最高金額限制
  requiresPreApproval  Boolean @default(false) // 是否需要事前核准

  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company      Company?         @relation(fields: [companyId], references: [id])
  items        ExpenseItem[]

  @@unique([companyId, code])
  @@map("expense_categories")
}

// 費用報銷申請
model ExpenseRequest {
  id           String   @id @default(cuid())
  requestNo    String   @unique        // 申請單號
  employeeId   String
  companyId    String

  // 報銷期間
  periodStart  DateTime @db.Date       // 報銷起始日
  periodEnd    DateTime @db.Date       // 報銷結束日

  // 金額
  totalAmount  Float    @default(0)    // 總金額
  currency     String   @default("TWD")

  // 說明
  title        String                  // 報銷標題
  description  String?                 // 說明

  // 狀態
  status       ExpenseStatus @default(DRAFT)
  submittedAt  DateTime?
  processedAt  DateTime?

  // 審核資訊
  currentApproverId String?
  approvedById      String?
  rejectedById      String?
  approvalComment   String?

  // 付款資訊
  paymentStatus PaymentStatus @default(UNPAID)
  paidAt        DateTime?
  paymentRef    String?                // 付款參考號

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  items        ExpenseItem[]

  @@index([employeeId, companyId])
  @@index([status])
  @@map("expense_requests")
}

enum ExpenseStatus {
  DRAFT      // 草稿
  PENDING    // 審核中
  APPROVED   // 已核准
  REJECTED   // 已拒絕
  CANCELLED  // 已取消
}

enum PaymentStatus {
  UNPAID     // 未付款
  PROCESSING // 處理中
  PAID       // 已付款
}

// 費用明細項目
model ExpenseItem {
  id           String   @id @default(cuid())
  requestId    String
  categoryId   String

  // 費用資訊
  date         DateTime @db.Date       // 消費日期
  description  String                  // 費用說明
  amount       Float                   // 金額
  currency     String   @default("TWD")

  // 發票/收據
  receiptNo    String?                 // 發票號碼
  receiptDate  DateTime?               // 發票日期
  vendorName   String?                 // 廠商名稱
  taxId        String?                 // 統一編號

  // 附件
  attachments  String?                 // JSON array of file URLs

  // 備註
  notes        String?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  request      ExpenseRequest   @relation(fields: [requestId], references: [id], onDelete: Cascade)
  category     ExpenseCategory  @relation(fields: [categoryId], references: [id])

  @@map("expense_items")
}
```

**Step 2: 更新 Company model 加入 expenseCategories 關聯**

在 `Company` model 中加入：

```prisma
expenseCategories ExpenseCategory[]
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
git commit -m "feat(expense): 新增費用報銷資料模型

- ExpenseCategory: 費用類別
- ExpenseRequest: 費用報銷申請
- ExpenseItem: 費用明細項目

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 建立費用類別 tRPC Router

**Files:**
- Create: `src/server/routers/expenseCategory.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 expenseCategory router**

建立 `src/server/routers/expenseCategory.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const expenseCategoryRouter = router({
  // 取得所有費用類別
  list: publicProcedure
    .input(z.object({
      companyId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.expenseCategory.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
    }),

  // 取得單一費用類別
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.expenseCategory.findUnique({
        where: { id: input.id },
      })
    }),

  // 建立費用類別
  create: publicProcedure
    .input(z.object({
      companyId: z.string().optional(),
      code: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      requiresReceipt: z.boolean().default(true),
      maxAmountPerItem: z.number().optional(),
      maxAmountPerMonth: z.number().optional(),
      requiresPreApproval: z.boolean().default(false),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查代碼是否重複
      const existing = await ctx.prisma.expenseCategory.findFirst({
        where: {
          code: input.code,
          companyId: input.companyId || null,
        },
      })

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '費用類別代碼已存在',
        })
      }

      return ctx.prisma.expenseCategory.create({
        data: input,
      })
    }),

  // 更新費用類別
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      requiresReceipt: z.boolean().optional(),
      maxAmountPerItem: z.number().nullable().optional(),
      maxAmountPerMonth: z.number().nullable().optional(),
      requiresPreApproval: z.boolean().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.expenseCategory.update({
        where: { id },
        data,
      })
    }),

  // 刪除費用類別（軟刪除）
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.expenseCategory.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),
})
```

**Step 2: 更新 _app.ts**

在 `src/server/routers/_app.ts` 中加入：

```typescript
import { expenseCategoryRouter } from './expenseCategory'

// 在 router 中加入
expenseCategory: expenseCategoryRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(expense): 新增費用類別 tRPC API

- list: 取得所有費用類別
- create/update/delete: CRUD 操作

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 建立費用報銷申請 tRPC Router

**Files:**
- Create: `src/server/routers/expenseRequest.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 expenseRequest router**

建立 `src/server/routers/expenseRequest.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// 產生申請單號
function generateRequestNo(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `EX${date}${random}`
}

export const expenseRequestRouter = router({
  // 建立費用報銷申請
  create: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      periodStart: z.date(),
      periodEnd: z.date(),
      items: z.array(z.object({
        categoryId: z.string(),
        date: z.date(),
        description: z.string(),
        amount: z.number().positive(),
        currency: z.string().default('TWD'),
        receiptNo: z.string().optional(),
        receiptDate: z.date().optional(),
        vendorName: z.string().optional(),
        taxId: z.string().optional(),
        attachments: z.string().optional(),
        notes: z.string().optional(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { items, ...requestData } = input

      // 計算總金額
      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)

      // 驗證費用類別
      for (const item of items) {
        const category = await ctx.prisma.expenseCategory.findUnique({
          where: { id: item.categoryId },
        })

        if (!category) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `費用類別不存在: ${item.categoryId}` })
        }

        // 檢查單項金額限制
        if (category.maxAmountPerItem && item.amount > category.maxAmountPerItem) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${category.name} 單項金額超過限制 ${category.maxAmountPerItem}`,
          })
        }

        // 檢查是否需要發票
        if (category.requiresReceipt && !item.receiptNo) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${category.name} 需要填寫發票號碼`,
          })
        }
      }

      // 建立申請單與明細
      return ctx.prisma.expenseRequest.create({
        data: {
          requestNo: generateRequestNo(),
          ...requestData,
          totalAmount,
          status: 'DRAFT',
          items: {
            create: items,
          },
        },
        include: {
          items: {
            include: { category: true },
          },
        },
      })
    }),

  // 更新費用報銷申請
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以修改' })
      }

      return ctx.prisma.expenseRequest.update({
        where: { id },
        data,
      })
    }),

  // 新增費用明細項目
  addItem: publicProcedure
    .input(z.object({
      requestId: z.string(),
      categoryId: z.string(),
      date: z.date(),
      description: z.string(),
      amount: z.number().positive(),
      currency: z.string().default('TWD'),
      receiptNo: z.string().optional(),
      receiptDate: z.date().optional(),
      vendorName: z.string().optional(),
      taxId: z.string().optional(),
      attachments: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { requestId, ...itemData } = input

      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: requestId },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以新增明細' })
      }

      // 建立明細並更新總金額
      const item = await ctx.prisma.expenseItem.create({
        data: {
          requestId,
          ...itemData,
        },
      })

      await ctx.prisma.expenseRequest.update({
        where: { id: requestId },
        data: {
          totalAmount: { increment: itemData.amount },
        },
      })

      return item
    }),

  // 刪除費用明細項目
  removeItem: publicProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.expenseItem.findUnique({
        where: { id: input.itemId },
        include: { request: true },
      })

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '明細項目不存在' })
      }

      if (item.request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以刪除明細' })
      }

      // 刪除明細並更新總金額
      await ctx.prisma.expenseItem.delete({
        where: { id: input.itemId },
      })

      await ctx.prisma.expenseRequest.update({
        where: { id: item.requestId },
        data: {
          totalAmount: { decrement: item.amount },
        },
      })

      return { success: true }
    }),

  // 送出申請
  submit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: input.id },
        include: { items: true },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以送出' })
      }

      if (request.items.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '至少需要一項費用明細' })
      }

      // 匹配適用的審核流程
      const flows = await ctx.prisma.approvalFlow.findMany({
        where: {
          module: 'expense',
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

          if (conditions.minAmount && request.totalAmount < conditions.minAmount) match = false
          if (conditions.maxAmount && request.totalAmount > conditions.maxAmount) match = false

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

      // 更新申請狀態
      const updatedRequest = await ctx.prisma.expenseRequest.update({
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
            module: 'expense',
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

        // 更新申請的當前審核者
        await ctx.prisma.expenseRequest.update({
          where: { id: input.id },
          data: { currentApproverId: approvers[0] || null },
        })
      }

      return updatedRequest
    }),

  // 審核（核准/拒絕）
  approve: publicProcedure
    .input(z.object({
      id: z.string(),
      action: z.enum(['APPROVE', 'REJECT']),
      approverId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: input.id },
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
            module: 'expense',
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

          return ctx.prisma.expenseRequest.update({
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

          return ctx.prisma.expenseRequest.update({
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

      // 更新申請為已核准
      return ctx.prisma.expenseRequest.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
          approvedById: input.approverId,
          approvalComment: input.comment,
        },
      })
    }),

  // 取消申請
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.expenseRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (!['DRAFT', 'PENDING'].includes(request.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請單無法取消' })
      }

      return ctx.prisma.expenseRequest.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      })
    }),

  // 取得我的報銷列表
  listMine: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const year = input.year || new Date().getFullYear()
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year, 11, 31)

      return ctx.prisma.expenseRequest.findMany({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          periodStart: { gte: startOfYear, lte: endOfYear },
        },
        include: {
          items: {
            include: { category: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得待審核列表（主管用）
  listPending: publicProcedure
    .input(z.object({ approverId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 取得此主管的下屬
      const subordinates = await ctx.prisma.employeeAssignment.findMany({
        where: { supervisorId: input.approverId, status: 'ACTIVE' },
        select: { employeeId: true, companyId: true },
      })

      if (subordinates.length === 0) return []

      return ctx.prisma.expenseRequest.findMany({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({
            employeeId: s.employeeId,
            companyId: s.companyId,
          })),
        },
        include: {
          items: {
            include: { category: true },
          },
        },
        orderBy: { submittedAt: 'asc' },
      })
    }),

  // 取得單一申請詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.expenseRequest.findUnique({
        where: { id: input.id },
        include: {
          items: {
            include: { category: true },
            orderBy: { date: 'asc' },
          },
        },
      })
    }),
})
```

**Step 2: 更新 _app.ts**

在 `src/server/routers/_app.ts` 中加入：

```typescript
import { expenseRequestRouter } from './expenseRequest'

// 在 router 中加入
expenseRequest: expenseRequestRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(expense): 新增費用報銷申請 tRPC API

- create: 建立報銷申請（含明細）
- addItem/removeItem: 管理費用明細
- submit: 送出申請（整合審核流程）
- approve: 審核（核准/拒絕）
- listMine/listPending: 查詢列表

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 建立費用報銷頁面

**Files:**
- Create: `src/app/dashboard/expense/page.tsx`
- Create: `src/app/dashboard/expense/new/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: 建立費用報銷列表頁面**

建立 `src/app/dashboard/expense/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Receipt, Plus, Clock, CheckCircle, XCircle, FileText } from 'lucide-react'
import Link from 'next/link'

export default async function ExpensePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得員工資訊
  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: { company: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  const assignment = employee.assignments[0]

  // 取得今年度的報銷申請
  const year = new Date().getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31)

  const requests = await prisma.expenseRequest.findMany({
    where: {
      employeeId: employee.id,
      companyId: assignment.companyId,
      periodStart: { gte: startOfYear, lte: endOfYear },
    },
    include: {
      items: {
        include: { category: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 統計
  const stats = {
    total: requests.length,
    draft: requests.filter(r => r.status === 'DRAFT').length,
    pending: requests.filter(r => r.status === 'PENDING').length,
    approved: requests.filter(r => r.status === 'APPROVED').length,
    totalAmount: requests
      .filter(r => r.status === 'APPROVED')
      .reduce((sum, r) => sum + r.totalAmount, 0),
  }

  const statusConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
    DRAFT: { label: '草稿', icon: FileText, color: 'text-gray-500' },
    PENDING: { label: '審核中', icon: Clock, color: 'text-yellow-500' },
    APPROVED: { label: '已核准', icon: CheckCircle, color: 'text-green-500' },
    REJECTED: { label: '已拒絕', icon: XCircle, color: 'text-red-500' },
    CANCELLED: { label: '已取消', icon: XCircle, color: 'text-gray-400' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">費用報銷</h1>
        <Button asChild>
          <Link href="/dashboard/expense/new">
            <Plus className="h-4 w-4 mr-2" />
            新增報銷
          </Link>
        </Button>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今年度報銷</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total} 筆</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待審核</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-500">{stats.pending} 筆</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已核准</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{stats.approved} 筆</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">報銷總額</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">NT$ {stats.totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 報銷列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            報銷申請記錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              尚無報銷申請記錄
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const config = statusConfig[request.status]
                const StatusIcon = config.icon
                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={config.color}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{request.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.requestNo} | {request.items.length} 項
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">NT$ {request.totalAmount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(request.periodStart).toLocaleDateString('zh-TW')} ~{' '}
                        {new Date(request.periodEnd).toLocaleDateString('zh-TW')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: 建立新增報銷頁面**

建立 `src/app/dashboard/expense/new/page.tsx`：

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { trpc } from '@/lib/trpc'
import { Plus, Trash2, Save, Send } from 'lucide-react'

interface ExpenseItem {
  categoryId: string
  date: string
  description: string
  amount: number
  receiptNo: string
  vendorName: string
}

export default function NewExpensePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([
    { categoryId: '', date: '', description: '', amount: 0, receiptNo: '', vendorName: '' },
  ])

  const { data: categories } = trpc.expenseCategory.list.useQuery({})
  const createMutation = trpc.expenseRequest.create.useMutation()
  const submitMutation = trpc.expenseRequest.submit.useMutation()

  const addItem = () => {
    setItems([
      ...items,
      { categoryId: '', date: '', description: '', amount: 0, receiptNo: '', vendorName: '' },
    ])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0)

  const handleSaveDraft = async () => {
    // TODO: Get from session
    const employeeId = 'current-user-id'
    const companyId = 'current-company-id'

    try {
      await createMutation.mutateAsync({
        employeeId,
        companyId,
        title,
        description,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        items: items.map(item => ({
          ...item,
          date: new Date(item.date),
          amount: Number(item.amount),
        })),
      })
      router.push('/dashboard/expense')
    } catch (error) {
      alert(error instanceof Error ? error.message : '儲存失敗')
    }
  }

  const handleSubmit = async () => {
    // TODO: Get from session
    const employeeId = 'current-user-id'
    const companyId = 'current-company-id'

    try {
      const request = await createMutation.mutateAsync({
        employeeId,
        companyId,
        title,
        description,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        items: items.map(item => ({
          ...item,
          date: new Date(item.date),
          amount: Number(item.amount),
        })),
      })

      await submitMutation.mutateAsync({ id: request.id })
      router.push('/dashboard/expense')
    } catch (error) {
      alert(error instanceof Error ? error.message : '送出失敗')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">新增費用報銷</h1>

      <Card>
        <CardHeader>
          <CardTitle>基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">報銷標題</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：2026年1月出差報銷"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">說明</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="選填"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="periodStart">報銷起始日</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">報銷結束日</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>費用明細</span>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              新增項目
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">項目 {index + 1}</span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>費用類別</Label>
                    <Select
                      value={item.categoryId}
                      onValueChange={(value) => updateItem(index, 'categoryId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇類別" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>消費日期</Label>
                    <Input
                      type="date"
                      value={item.date}
                      onChange={(e) => updateItem(index, 'date', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>金額</Label>
                    <Input
                      type="number"
                      value={item.amount || ''}
                      onChange={(e) => updateItem(index, 'amount', Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>費用說明</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="例如：計程車費"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>廠商名稱</Label>
                    <Input
                      value={item.vendorName}
                      onChange={(e) => updateItem(index, 'vendorName', e.target.value)}
                      placeholder="選填"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>發票號碼</Label>
                  <Input
                    value={item.receiptNo}
                    onChange={(e) => updateItem(index, 'receiptNo', e.target.value)}
                    placeholder="例如：AB-12345678"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t flex justify-between items-center">
            <div className="text-lg font-bold">
              總金額：NT$ {totalAmount.toLocaleString()}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={createMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                儲存草稿
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || submitMutation.isPending}>
                <Send className="h-4 w-4 mr-1" />
                送出審核
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: 更新 sidebar 加入費用報銷選單**

在 `src/components/layout/sidebar.tsx` 的選單項目中加入：

```typescript
{
  title: '費用報銷',
  href: '/dashboard/expense',
  icon: Receipt,
},
```

同時在 import 中加入 `Receipt` from lucide-react。

**Step 4: 驗證編譯**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/app/dashboard/expense/ src/components/layout/
git commit -m "feat(expense): 建立費用報銷頁面

- 報銷列表頁面（含統計）
- 新增報銷頁面（含明細管理）
- sidebar 選單

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 更新審核中心支援費用報銷

**Files:**
- Modify: `src/app/dashboard/approval/page.tsx`

**Step 1: 更新審核中心顯示費用報銷待審核**

在 `src/app/dashboard/approval/page.tsx` 中加入費用報銷待審核列表：

```typescript
// 取得待審核費用報銷
const pendingExpenses = await prisma.expenseRequest.findMany({
  where: {
    status: 'PENDING',
    OR: subordinates.map(s => ({
      employeeId: s.employeeId,
      companyId: s.companyId,
    })),
  },
  include: {
    items: {
      include: { category: true },
    },
  },
  orderBy: { submittedAt: 'asc' },
})
```

並在頁面中新增費用報銷待審核區塊。

**Step 2: 驗證編譯**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/dashboard/approval/
git commit -m "feat(expense): 審核中心支援費用報銷

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 建立費用類別設定頁面

**Files:**
- Create: `src/app/dashboard/settings/expense-categories/page.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

**Step 1: 建立費用類別設定頁面**

建立 `src/app/dashboard/settings/expense-categories/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function ExpenseCategoriesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const categories = await prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">費用類別設定</h1>
        <Button asChild>
          <Link href="/dashboard/settings/expense-categories/new">
            <Plus className="h-4 w-4 mr-2" />
            新增類別
          </Link>
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">尚未設定任何費用類別</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  {category.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{category.code}</p>
                {category.description && (
                  <p>{category.description}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  {category.requiresReceipt && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                      需發票
                    </span>
                  )}
                  {category.maxAmountPerItem && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                      單項上限 ${category.maxAmountPerItem.toLocaleString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: 更新系統設定頁面**

在 `src/app/dashboard/settings/page.tsx` 的 `settingsItems` 陣列中加入：

```typescript
{
  title: '費用類別',
  description: '管理費用報銷的類別與規則',
  href: '/dashboard/settings/expense-categories',
  icon: Receipt,
},
```

**Step 3: 驗證編譯**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/dashboard/settings/
git commit -m "feat(expense): 建立費用類別設定頁面

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 更新 Seed 加入預設費用類別與審核流程

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: 新增預設費用類別到 seed**

在 `prisma/seed.ts` 中加入：

```typescript
  // 13. 建立預設費用類別
  await prisma.expenseItem.deleteMany({})
  await prisma.expenseRequest.deleteMany({})
  await prisma.expenseCategory.deleteMany({})

  const expenseCategories = await Promise.all([
    prisma.expenseCategory.create({
      data: {
        code: 'TRAVEL',
        name: '差旅費',
        description: '出差交通、住宿費用',
        requiresReceipt: true,
        sortOrder: 1,
      },
    }),
    prisma.expenseCategory.create({
      data: {
        code: 'TRANSPORT',
        name: '交通費',
        description: '計程車、高鐵、捷運等',
        requiresReceipt: true,
        sortOrder: 2,
      },
    }),
    prisma.expenseCategory.create({
      data: {
        code: 'MEAL',
        name: '餐費',
        description: '業務餐費、加班餐費',
        requiresReceipt: true,
        maxAmountPerItem: 1000,
        sortOrder: 3,
      },
    }),
    prisma.expenseCategory.create({
      data: {
        code: 'SUPPLIES',
        name: '文具用品',
        description: '辦公文具、耗材',
        requiresReceipt: true,
        sortOrder: 4,
      },
    }),
    prisma.expenseCategory.create({
      data: {
        code: 'COMMUNICATION',
        name: '通訊費',
        description: '電話費、網路費',
        requiresReceipt: true,
        sortOrder: 5,
      },
    }),
    prisma.expenseCategory.create({
      data: {
        code: 'OTHER',
        name: '其他',
        description: '其他雜項支出',
        requiresReceipt: true,
        sortOrder: 99,
      },
    }),
  ])

  console.log('✅ 預設費用類別已建立')

  // 14. 建立費用報銷審核流程
  // 費用審核流程 - 小額（5000以內，單關卡）
  const expenseFlowSmall = await prisma.approvalFlow.create({
    data: {
      code: 'EXPENSE_SMALL',
      name: '費用報銷（5000以內）',
      module: 'expense',
      conditions: JSON.stringify({ maxAmount: 5000 }),
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

  // 費用審核流程 - 中額（5000-20000，兩關卡）
  const expenseFlowMedium = await prisma.approvalFlow.create({
    data: {
      code: 'EXPENSE_MEDIUM',
      name: '費用報銷（5000-20000）',
      module: 'expense',
      conditions: JSON.stringify({ minAmount: 5001, maxAmount: 20000 }),
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

  // 費用審核流程 - 大額（20000以上，三關卡）
  const expenseFlowLarge = await prisma.approvalFlow.create({
    data: {
      code: 'EXPENSE_LARGE',
      name: '費用報銷（20000以上）',
      module: 'expense',
      conditions: JSON.stringify({ minAmount: 20001 }),
      isDefault: false,
      sortOrder: 3,
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
          {
            stepOrder: 3,
            name: '財務主管',
            approverType: 'ROLE',
            approverValue: 'finance_manager',
            approvalMode: 'ANY',
          },
        ],
      },
    },
  })

  // 費用審核流程 - 預設
  const expenseFlowDefault = await prisma.approvalFlow.create({
    data: {
      code: 'EXPENSE_DEFAULT',
      name: '費用報銷（預設）',
      module: 'expense',
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

  console.log('✅ 費用報銷審核流程已建立')
```

**Step 2: 執行 seed**

```bash
npm run db:seed
```

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(expense): 新增預設費用類別與審核流程 seed

- 6 種預設費用類別
- 4 種審核流程（依金額分級）

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

Phase 5 財務會計模組包含：

| 功能 | 說明 |
|-----|------|
| 費用類別 | 支援多種費用分類（差旅、交通、餐費等） |
| 費用明細 | 每筆報銷可包含多項費用明細 |
| 發票管理 | 記錄發票號碼、廠商、統編 |
| 金額限制 | 支援單項金額限制 |
| 審核流程 | 整合 Phase 4 審核引擎，依金額分級審核 |
| 付款狀態 | 追蹤報銷付款狀態 |

**審核流程分級：**
- 5,000 以內：直屬主管核准
- 5,000 - 20,000：直屬主管 → 部門主管
- 20,000 以上：直屬主管 → 部門主管 → 財務主管

**下一階段 (Phase 6)：** 報表與儀表板（出勤報表、請假統計、費用分析）
