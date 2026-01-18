# Phase 3: 請假管理模組 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立完整的請假管理系統，包含假別設定、請假申請、餘額追蹤與審核流程

**Architecture:**
- 新增 Prisma 資料模型（假別、請假申請、假別餘額）
- 建立 tRPC API 處理請假申請與審核
- 前端頁面：請假申請、我的請假、審核待辦（主管）
- 符合台灣勞基法的假別預設值

**Tech Stack:** Next.js 14, tRPC, Prisma, PostgreSQL, TailwindCSS, shadcn/ui

---

## Task 1: 新增請假相關 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增假別與請假相關模型**

在 `prisma/schema.prisma` 檔案末尾加入：

```prisma
// ==================== 請假管理 ====================

model LeaveType {
  id        String       @id @default(cuid())
  companyId String?      // NULL = 集團共用法定假別
  code      String       // ANNUAL, SICK, PERSONAL, etc.
  name      String
  category  LeaveCategory @default(STATUTORY)

  // 請假規則
  requiresReason       Boolean @default(true)  // 是否需填事由
  requiresAttachment   Boolean @default(false) // 是否需附件
  attachmentAfterDays  Int     @default(0)     // 超過幾天需附證明
  minUnit              LeaveUnit @default(HOUR) // 最小請假單位

  // 額度規則
  quotaType          QuotaType @default(FIXED)
  annualQuotaDays    Float     @default(0)     // 年度額度（天）
  canCarryOver       Boolean   @default(false) // 可否遞延
  carryOverLimitDays Float     @default(0)     // 遞延上限（天）
  canCashOut         Boolean   @default(false) // 可否折現
  cashOutRate        Float     @default(1.0)   // 折現費率

  // 使用限制
  advanceDaysRequired Int      @default(0)     // 需提前幾天申請
  maxConsecutiveDays  Int      @default(0)     // 連續請假上限（0=無限）
  genderRestriction   Gender?                  // 性別限制
  applicableAfterDays Int      @default(0)     // 到職滿幾天可請

  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company  Company?       @relation(fields: [companyId], references: [id])
  requests LeaveRequest[]
  balances LeaveBalance[]

  @@unique([companyId, code])
  @@map("leave_types")
}

enum LeaveCategory {
  STATUTORY // 法定假
  COMPANY   // 公司自訂
}

enum LeaveUnit {
  HOUR     // 小時
  HALF_DAY // 半天
  DAY      // 天
}

enum QuotaType {
  FIXED     // 固定額度
  SENIORITY // 依年資
  UNLIMITED // 無限制
}

model LeaveRequest {
  id          String   @id @default(cuid())
  requestNo   String   @unique // 申請單號
  employeeId  String
  companyId   String
  leaveTypeId String

  // 請假期間
  startDate   DateTime
  startPeriod LeavePeriod @default(FULL_DAY)
  endDate     DateTime
  endPeriod   LeavePeriod @default(FULL_DAY)
  totalHours  Float       // 總請假時數（系統計算）

  // 申請內容
  reason      String?
  attachments String?  // JSON array of file URLs
  proxyEmployeeId String? // 職務代理人

  // 狀態
  status      LeaveStatus @default(DRAFT)
  submittedAt DateTime?
  processedAt DateTime?

  // 審核
  currentApproverId String?
  approvedById      String?
  rejectedById      String?
  approvalComment   String?

  // 銷假（若提前返回）
  actualEndDate    DateTime?
  cancelledHours   Float?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  leaveType LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@index([employeeId, companyId])
  @@index([status])
  @@map("leave_requests")
}

enum LeavePeriod {
  FULL_DAY // 全天
  AM       // 上午
  PM       // 下午
}

enum LeaveStatus {
  DRAFT     // 草稿
  PENDING   // 審核中
  APPROVED  // 已核准
  REJECTED  // 已拒絕
  CANCELLED // 已取消
}

model LeaveBalance {
  id          String @id @default(cuid())
  employeeId  String
  companyId   String
  leaveTypeId String
  year        Int    // 年度

  // 額度
  entitledHours Float @default(0) // 本年度應有額度
  carriedHours  Float @default(0) // 上年度遞延額度
  adjustedHours Float @default(0) // 人工調整

  // 使用
  usedHours    Float @default(0) // 已使用時數
  pendingHours Float @default(0) // 審核中時數

  // 折現
  cashedOutHours  Float @default(0)
  cashOutAmount   Float @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  leaveType LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@unique([employeeId, companyId, leaveTypeId, year])
  @@map("leave_balances")
}
```

**Step 2: 更新 Company model 加入 leaveTypes 關聯**

在 `Company` model 中加入：

```prisma
leaveTypes  LeaveType[]
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
git commit -m "feat(leave): 新增請假管理資料模型

- LeaveType: 假別設定
- LeaveRequest: 請假申請
- LeaveBalance: 假別餘額

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 建立假別管理 tRPC Router

**Files:**
- Create: `src/server/routers/leaveType.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 leaveType router**

建立 `src/server/routers/leaveType.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const leaveTypeRouter = router({
  // 取得可用假別列表（含集團共用 + 公司自訂）
  list: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveType.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId: null },        // 集團共用
            { companyId: input.companyId }, // 公司自訂
          ],
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
    }),

  // 取得單一假別
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveType.findUnique({
        where: { id: input.id },
      })
    }),

  // 建立假別（公司自訂）
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      code: z.string().min(1),
      name: z.string().min(1),
      category: z.enum(['STATUTORY', 'COMPANY']).default('COMPANY'),
      requiresReason: z.boolean().default(true),
      requiresAttachment: z.boolean().default(false),
      attachmentAfterDays: z.number().default(0),
      minUnit: z.enum(['HOUR', 'HALF_DAY', 'DAY']).default('HOUR'),
      quotaType: z.enum(['FIXED', 'SENIORITY', 'UNLIMITED']).default('FIXED'),
      annualQuotaDays: z.number().default(0),
      canCarryOver: z.boolean().default(false),
      carryOverLimitDays: z.number().default(0),
      advanceDaysRequired: z.number().default(0),
      maxConsecutiveDays: z.number().default(0),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.leaveType.create({ data: input })
    }),

  // 更新假別
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      requiresReason: z.boolean().optional(),
      requiresAttachment: z.boolean().optional(),
      annualQuotaDays: z.number().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.leaveType.update({ where: { id }, data })
    }),
})
```

**Step 2: 更新 _app.ts**

```typescript
import { router } from '../trpc'
import { healthRouter } from './health'
import { workShiftRouter } from './workShift'
import { attendanceRouter } from './attendance'
import { leaveTypeRouter } from './leaveType'

export const appRouter = router({
  health: healthRouter,
  workShift: workShiftRouter,
  attendance: attendanceRouter,
  leaveType: leaveTypeRouter,
})

export type AppRouter = typeof appRouter
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(leave): 新增假別管理 tRPC API

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 建立請假申請 tRPC Router

**Files:**
- Create: `src/server/routers/leaveRequest.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 leaveRequest router**

建立 `src/server/routers/leaveRequest.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// 產生申請單號
function generateRequestNo(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `LV${date}${random}`
}

// 計算請假時數
function calculateLeaveHours(
  startDate: Date,
  startPeriod: string,
  endDate: Date,
  endPeriod: string,
  workHoursPerDay: number = 8
): number {
  const start = new Date(startDate)
  const end = new Date(endDate)

  // 計算天數差
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  if (diffDays === 1) {
    // 同一天
    if (startPeriod === 'FULL_DAY') return workHoursPerDay
    return workHoursPerDay / 2 // AM 或 PM
  }

  // 多天
  let totalHours = (diffDays - 2) * workHoursPerDay // 中間天數

  // 第一天
  if (startPeriod === 'FULL_DAY') totalHours += workHoursPerDay
  else if (startPeriod === 'PM') totalHours += workHoursPerDay / 2
  else totalHours += workHoursPerDay // AM 開始算全天

  // 最後一天
  if (endPeriod === 'FULL_DAY') totalHours += workHoursPerDay
  else if (endPeriod === 'AM') totalHours += workHoursPerDay / 2
  else totalHours += workHoursPerDay // PM 結束算全天

  return totalHours
}

export const leaveRequestRouter = router({
  // 建立請假申請
  create: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      leaveTypeId: z.string(),
      startDate: z.date(),
      startPeriod: z.enum(['FULL_DAY', 'AM', 'PM']).default('FULL_DAY'),
      endDate: z.date(),
      endPeriod: z.enum(['FULL_DAY', 'AM', 'PM']).default('FULL_DAY'),
      reason: z.string().optional(),
      proxyEmployeeId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 驗證假別
      const leaveType = await ctx.prisma.leaveType.findUnique({
        where: { id: input.leaveTypeId },
      })

      if (!leaveType) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '假別不存在' })
      }

      // 檢查是否需要事由
      if (leaveType.requiresReason && !input.reason) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此假別需要填寫請假事由' })
      }

      // 計算請假時數
      const totalHours = calculateLeaveHours(
        input.startDate,
        input.startPeriod,
        input.endDate,
        input.endPeriod
      )

      // 取得直屬主管作為審核者
      const assignment = await ctx.prisma.employeeAssignment.findFirst({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'ACTIVE',
        },
      })

      return ctx.prisma.leaveRequest.create({
        data: {
          requestNo: generateRequestNo(),
          employeeId: input.employeeId,
          companyId: input.companyId,
          leaveTypeId: input.leaveTypeId,
          startDate: input.startDate,
          startPeriod: input.startPeriod,
          endDate: input.endDate,
          endPeriod: input.endPeriod,
          totalHours,
          reason: input.reason,
          proxyEmployeeId: input.proxyEmployeeId,
          status: 'DRAFT',
          currentApproverId: assignment?.supervisorId,
        },
      })
    }),

  // 送出申請
  submit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以送出' })
      }

      return ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: 'PENDING',
          submittedAt: new Date(),
        },
      })
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

      const newStatus = input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'

      // 更新請假申請
      const updated = await ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: newStatus,
          processedAt: new Date(),
          approvedById: input.action === 'APPROVE' ? input.approverId : undefined,
          rejectedById: input.action === 'REJECT' ? input.approverId : undefined,
          approvalComment: input.comment,
        },
      })

      // 如果核准，更新假別餘額
      if (input.action === 'APPROVE') {
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
      }

      return updated
    }),

  // 取消申請
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (!['DRAFT', 'PENDING'].includes(request.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請單無法取消' })
      }

      return ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      })
    }),

  // 取得我的請假列表
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

      return ctx.prisma.leaveRequest.findMany({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          startDate: { gte: startOfYear, lte: endOfYear },
        },
        include: { leaveType: true },
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

      return ctx.prisma.leaveRequest.findMany({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({
            employeeId: s.employeeId,
            companyId: s.companyId,
          })),
        },
        include: { leaveType: true },
        orderBy: { submittedAt: 'asc' },
      })
    }),

  // 取得單一申請詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: { leaveType: true },
      })
    }),
})
```

**Step 2: 更新 _app.ts 加入 leaveRequest**

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(leave): 新增請假申請 tRPC API

- create: 建立請假申請
- submit: 送出申請
- approve: 審核（核准/拒絕）
- cancel: 取消申請
- listMine: 我的請假列表
- listPending: 待審核列表

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 建立假別餘額 tRPC Router

**Files:**
- Create: `src/server/routers/leaveBalance.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 leaveBalance router**

建立 `src/server/routers/leaveBalance.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

// 特休年資計算（台灣勞基法）
function calculateAnnualLeaveDays(seniorityMonths: number): number {
  if (seniorityMonths < 6) return 0
  if (seniorityMonths < 12) return 3
  if (seniorityMonths < 24) return 7
  if (seniorityMonths < 36) return 10
  if (seniorityMonths < 60) return 14
  if (seniorityMonths < 120) return 15
  // 滿10年後每年加1天，最多30天
  const extraYears = Math.floor((seniorityMonths - 120) / 12)
  return Math.min(15 + extraYears, 30)
}

export const leaveBalanceRouter = router({
  // 取得員工所有假別餘額
  list: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const year = input.year || new Date().getFullYear()

      // 取得所有可用假別
      const leaveTypes = await ctx.prisma.leaveType.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        orderBy: { sortOrder: 'asc' },
      })

      // 取得現有餘額
      const balances = await ctx.prisma.leaveBalance.findMany({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          year,
        },
      })

      // 取得員工到職日以計算年資
      const employee = await ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
        select: { hireDate: true },
      })

      const hireDate = employee?.hireDate || new Date()
      const now = new Date()
      const seniorityMonths = Math.floor(
        (now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      )

      // 合併資料
      return leaveTypes.map(lt => {
        const balance = balances.find(b => b.leaveTypeId === lt.id)

        // 計算應有額度
        let entitledHours = lt.annualQuotaDays * 8
        if (lt.quotaType === 'SENIORITY' && lt.code === 'ANNUAL') {
          entitledHours = calculateAnnualLeaveDays(seniorityMonths) * 8
        } else if (lt.quotaType === 'UNLIMITED') {
          entitledHours = -1 // -1 表示無限
        }

        const usedHours = balance?.usedHours || 0
        const pendingHours = balance?.pendingHours || 0
        const carriedHours = balance?.carriedHours || 0
        const adjustedHours = balance?.adjustedHours || 0

        const totalAvailable = entitledHours === -1
          ? -1
          : entitledHours + carriedHours + adjustedHours
        const remainingHours = entitledHours === -1
          ? -1
          : totalAvailable - usedHours - pendingHours

        return {
          leaveType: lt,
          year,
          entitledHours,
          carriedHours,
          adjustedHours,
          totalAvailable,
          usedHours,
          pendingHours,
          remainingHours,
        }
      })
    }),

  // 調整餘額（管理員用）
  adjust: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      leaveTypeId: z.string(),
      year: z.number(),
      adjustedHours: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.leaveBalance.upsert({
        where: {
          employeeId_companyId_leaveTypeId_year: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            leaveTypeId: input.leaveTypeId,
            year: input.year,
          },
        },
        update: { adjustedHours: input.adjustedHours },
        create: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          leaveTypeId: input.leaveTypeId,
          year: input.year,
          adjustedHours: input.adjustedHours,
        },
      })
    }),
})
```

**Step 2: 更新 _app.ts**

**Step 3: Commit**

```bash
git add src/server/routers/
git commit -m "feat(leave): 新增假別餘額 tRPC API

- list: 取得員工所有假別餘額
- adjust: 調整餘額（管理員用）
- 包含特休年資計算邏輯

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 建立請假申請頁面 UI

**Files:**
- Modify: `src/app/dashboard/leave/page.tsx`
- Create: `src/components/leave/leave-form.tsx`
- Create: `src/components/leave/leave-balance-card.tsx`

**Step 1: 建立請假表單元件**

建立 `src/components/leave/leave-form.tsx`：

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trpc } from '@/lib/trpc'

interface LeaveFormProps {
  employeeId: string
  companyId: string
  onSuccess?: () => void
}

export function LeaveForm({ employeeId, companyId, onSuccess }: LeaveFormProps) {
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    startPeriod: 'FULL_DAY',
    endDate: '',
    endPeriod: 'FULL_DAY',
    reason: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const { data: leaveTypes } = trpc.leaveType.list.useQuery({ companyId })

  const createMutation = trpc.leaveRequest.create.useMutation()
  const submitMutation = trpc.leaveRequest.submit.useMutation({
    onSuccess: () => {
      setFormData({
        leaveTypeId: '',
        startDate: '',
        startPeriod: 'FULL_DAY',
        endDate: '',
        endPeriod: 'FULL_DAY',
        reason: '',
      })
      onSuccess?.()
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const request = await createMutation.mutateAsync({
        employeeId,
        companyId,
        leaveTypeId: formData.leaveTypeId,
        startDate: new Date(formData.startDate),
        startPeriod: formData.startPeriod as 'FULL_DAY' | 'AM' | 'PM',
        endDate: new Date(formData.endDate),
        endPeriod: formData.endPeriod as 'FULL_DAY' | 'AM' | 'PM',
        reason: formData.reason || undefined,
      })
      await submitMutation.mutateAsync({ id: request.id })
    } catch (error) {
      console.error('Submit error:', error)
      alert(error instanceof Error ? error.message : '申請失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedLeaveType = leaveTypes?.find(lt => lt.id === formData.leaveTypeId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>請假申請</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leaveType">假別</Label>
            <select
              id="leaveType"
              className="w-full border rounded-md p-2"
              value={formData.leaveTypeId}
              onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
              required
            >
              <option value="">請選擇假別</option>
              {leaveTypes?.map((lt) => (
                <option key={lt.id} value={lt.id}>{lt.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">開始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startPeriod">開始時段</Label>
              <select
                id="startPeriod"
                className="w-full border rounded-md p-2"
                value={formData.startPeriod}
                onChange={(e) => setFormData({ ...formData, startPeriod: e.target.value })}
              >
                <option value="FULL_DAY">全天</option>
                <option value="AM">上午</option>
                <option value="PM">下午</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">結束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endPeriod">結束時段</Label>
              <select
                id="endPeriod"
                className="w-full border rounded-md p-2"
                value={formData.endPeriod}
                onChange={(e) => setFormData({ ...formData, endPeriod: e.target.value })}
              >
                <option value="FULL_DAY">全天</option>
                <option value="AM">上午</option>
                <option value="PM">下午</option>
              </select>
            </div>
          </div>

          {selectedLeaveType?.requiresReason && (
            <div className="space-y-2">
              <Label htmlFor="reason">請假事由 *</Label>
              <textarea
                id="reason"
                className="w-full border rounded-md p-2 min-h-[80px]"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required={selectedLeaveType.requiresReason}
                placeholder="請填寫請假事由"
              />
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? '送出中...' : '送出申請'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 2: 建立餘額卡片元件**

建立 `src/components/leave/leave-balance-card.tsx`：

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trpc } from '@/lib/trpc'
import { Calendar } from 'lucide-react'

interface LeaveBalanceCardProps {
  employeeId: string
  companyId: string
}

export function LeaveBalanceCard({ employeeId, companyId }: LeaveBalanceCardProps) {
  const { data: balances, isLoading } = trpc.leaveBalance.list.useQuery({
    employeeId,
    companyId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            假別餘額
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">載入中...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          假別餘額
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {balances?.map((b) => (
            <div key={b.leaveType.id} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <p className="font-medium">{b.leaveType.name}</p>
                <p className="text-sm text-muted-foreground">
                  已用 {b.usedHours / 8} 天
                  {b.pendingHours > 0 && ` (審核中 ${b.pendingHours / 8} 天)`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">
                  {b.remainingHours === -1 ? '不限' : `${b.remainingHours / 8} 天`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {b.totalAvailable === -1 ? '' : `/ ${b.totalAvailable / 8} 天`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 3: 更新請假管理頁面**

更新 `src/app/dashboard/leave/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, FileText } from 'lucide-react'
import { LeaveForm } from '@/components/leave/leave-form'
import { LeaveBalanceCard } from '@/components/leave/leave-balance-card'

export default async function LeavePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id

  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: { company: true },
  })

  if (!assignment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">請假管理</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">尚未指派任職公司</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const companyId = assignment.companyId

  // 取得今年請假紀錄
  const year = new Date().getFullYear()
  const requests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      companyId,
      startDate: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31),
      },
    },
    include: { leaveType: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const statusConfig: Record<string, { label: string; className: string }> = {
    DRAFT: { label: '草稿', className: 'bg-gray-100 text-gray-800' },
    PENDING: { label: '審核中', className: 'bg-yellow-100 text-yellow-800' },
    APPROVED: { label: '已核准', className: 'bg-green-100 text-green-800' },
    REJECTED: { label: '已拒絕', className: 'bg-red-100 text-red-800' },
    CANCELLED: { label: '已取消', className: 'bg-gray-100 text-gray-500' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">請假管理</h1>
        <p className="text-sm text-muted-foreground">{assignment.company.name}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <LeaveForm employeeId={employeeId} companyId={companyId} />
        <LeaveBalanceCard employeeId={employeeId} companyId={companyId} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            我的請假紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">尚無請假紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">單號</th>
                    <th className="text-left py-3 px-2 font-medium">假別</th>
                    <th className="text-left py-3 px-2 font-medium">期間</th>
                    <th className="text-left py-3 px-2 font-medium">時數</th>
                    <th className="text-left py-3 px-2 font-medium">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const config = statusConfig[req.status] || statusConfig.DRAFT
                    return (
                      <tr key={req.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-mono text-sm">{req.requestNo}</td>
                        <td className="py-3 px-2">{req.leaveType.name}</td>
                        <td className="py-3 px-2">
                          {new Date(req.startDate).toLocaleDateString('zh-TW')}
                          {req.startDate.getTime() !== req.endDate.getTime() && (
                            <> ~ {new Date(req.endDate).toLocaleDateString('zh-TW')}</>
                          )}
                        </td>
                        <td className="py-3 px-2">{req.totalHours / 8} 天</td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                            {config.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 4: 驗證編譯**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/app/dashboard/leave/ src/components/leave/
git commit -m "feat(leave): 建立請假管理頁面 UI

- LeaveForm: 請假申請表單
- LeaveBalanceCard: 假別餘額顯示
- 請假紀錄列表

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 建立審核中心頁面

**Files:**
- Modify: `src/app/dashboard/approval/page.tsx`
- Create: `src/components/approval/pending-list.tsx`

**Step 1: 建立待審核列表元件**

建立 `src/components/approval/pending-list.tsx`：

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc'
import { FileText, Check, X } from 'lucide-react'

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

**Step 2: 更新審核中心頁面**

更新 `src/app/dashboard/approval/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import { PendingList } from '@/components/approval/pending-list'

export default async function ApprovalPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id

  // 檢查是否有下屬（是否為主管）
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      status: 'ACTIVE',
    },
  })

  const subordinates = assignment
    ? await prisma.employeeAssignment.findMany({
        where: { supervisorId: assignment.id, status: 'ACTIVE' },
        include: { employee: true },
      })
    : []

  const isManager = subordinates.length > 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">審核中心</h1>

      {!isManager ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              您目前沒有待審核的項目
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            您有 {subordinates.length} 位下屬：
            {subordinates.map(s => s.employee.name).join('、')}
          </div>
          <PendingList approverId={assignment!.id} />
        </>
      )}
    </div>
  )
}
```

**Step 3: 驗證編譯**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/dashboard/approval/ src/components/approval/
git commit -m "feat(leave): 建立審核中心頁面

- PendingList: 待審核請假列表
- 主管可核准/拒絕請假申請

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 更新 Seed 加入法定假別

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: 新增法定假別到 seed**

在 `prisma/seed.ts` 中加入：

```typescript
  // 11. 建立法定假別（集團共用）
  const leaveTypes = [
    {
      code: 'ANNUAL',
      name: '特別休假',
      category: 'STATUTORY' as const,
      requiresReason: false,
      minUnit: 'HOUR' as const,
      quotaType: 'SENIORITY' as const,
      canCarryOver: true,
      carryOverLimitDays: 10,
      canCashOut: true,
      sortOrder: 1,
    },
    {
      code: 'PERSONAL',
      name: '事假',
      category: 'STATUTORY' as const,
      requiresReason: true,
      minUnit: 'HOUR' as const,
      quotaType: 'FIXED' as const,
      annualQuotaDays: 14,
      sortOrder: 2,
    },
    {
      code: 'SICK',
      name: '病假',
      category: 'STATUTORY' as const,
      requiresReason: true,
      requiresAttachment: true,
      attachmentAfterDays: 3,
      minUnit: 'HOUR' as const,
      quotaType: 'FIXED' as const,
      annualQuotaDays: 30,
      sortOrder: 3,
    },
    {
      code: 'MENSTRUAL',
      name: '生理假',
      category: 'STATUTORY' as const,
      requiresReason: false,
      minUnit: 'DAY' as const,
      quotaType: 'FIXED' as const,
      annualQuotaDays: 12,
      genderRestriction: 'FEMALE' as const,
      sortOrder: 4,
    },
    {
      code: 'MARRIAGE',
      name: '婚假',
      category: 'STATUTORY' as const,
      requiresReason: true,
      requiresAttachment: true,
      minUnit: 'DAY' as const,
      quotaType: 'FIXED' as const,
      annualQuotaDays: 8,
      sortOrder: 5,
    },
    {
      code: 'FUNERAL',
      name: '喪假',
      category: 'STATUTORY' as const,
      requiresReason: true,
      requiresAttachment: true,
      minUnit: 'DAY' as const,
      quotaType: 'FIXED' as const,
      annualQuotaDays: 8,
      sortOrder: 6,
    },
    {
      code: 'MATERNITY',
      name: '產假',
      category: 'STATUTORY' as const,
      requiresReason: true,
      requiresAttachment: true,
      minUnit: 'DAY' as const,
      quotaType: 'FIXED' as const,
      annualQuotaDays: 56,
      genderRestriction: 'FEMALE' as const,
      sortOrder: 7,
    },
    {
      code: 'PATERNITY',
      name: '陪產假',
      category: 'STATUTORY' as const,
      requiresReason: true,
      requiresAttachment: true,
      minUnit: 'DAY' as const,
      quotaType: 'FIXED' as const,
      annualQuotaDays: 7,
      genderRestriction: 'MALE' as const,
      sortOrder: 8,
    },
  ]

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { companyId_code: { companyId: null as any, code: lt.code } },
      update: {},
      create: {
        ...lt,
        companyId: null,
      },
    })
  }
  console.log('✅ 法定假別已建立')
```

**Step 2: 執行 seed**

```bash
npm run db:seed
```

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(leave): 新增法定假別 seed

- 特休、事假、病假、生理假
- 婚假、喪假、產假、陪產假

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
cd ..
git fetch origin
git merge origin/feature/initial-setup --no-edit
git push origin master
```

**Step 4: 最終 Commit**

```bash
git add -A
git commit -m "feat(leave): Phase 3 請假管理模組完成

- Prisma schema: LeaveType, LeaveRequest, LeaveBalance
- tRPC API: 假別管理、請假申請、餘額查詢
- UI: 請假申請頁面、審核中心
- Seed: 台灣法定假別

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

Phase 3 請假管理模組包含：

| 功能 | 說明 |
|-----|------|
| 假別設定 | 支援法定假與公司自訂假 |
| 請假申請 | 選擇假別、日期、填寫事由 |
| 假別餘額 | 自動計算年資特休、追蹤使用量 |
| 審核流程 | 主管核准/拒絕請假 |
| 法定假別 | 特休、事假、病假、婚喪產假等 |

**下一階段 (Phase 4)：** 完整審核流程引擎（多關卡簽核、照會機制）
