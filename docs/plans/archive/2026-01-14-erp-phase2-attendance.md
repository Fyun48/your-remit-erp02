# Phase 2: 出勤管理模組 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立完整的出勤打卡系統，包含班別設定、打卡功能、出勤紀錄查詢

**Architecture:**
- 新增 Prisma 資料模型（班別、打卡紀錄、打卡規則）
- 建立 tRPC API 處理打卡邏輯與查詢
- 前端頁面：員工打卡、出勤紀錄、班別管理（管理員）

**Tech Stack:** Next.js 14, tRPC, Prisma, PostgreSQL, TailwindCSS, shadcn/ui

---

## Task 1: 新增出勤相關 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增班別相關模型到 schema.prisma**

在 `prisma/schema.prisma` 檔案末尾加入以下內容：

```prisma
// ==================== 出勤管理 ====================

model WorkShift {
  id        String    @id @default(cuid())
  companyId String
  name      String    // 班別名稱（早班、晚班、彈性班）
  code      String
  shiftType ShiftType @default(FIXED)

  // 工作時間
  workStartTime String // 格式 "HH:mm"
  workEndTime   String // 格式 "HH:mm"

  // 彈性班設定
  coreStartTime  String? // 核心開始時間
  coreEndTime    String? // 核心結束時間
  flexStartRange String? // 最早可上班時間
  flexEndRange   String? // 最晚可下班時間
  requiredHours  Float?  // 每日應工作時數

  // 規則設定
  lateGraceMinutes      Int @default(0)  // 遲到寬限（分鐘）
  earlyLeaveGraceMinutes Int @default(0) // 早退寬限（分鐘）
  overtimeThreshold     Int @default(30) // 加班起算門檻（分鐘）

  workDays  String @default("1,2,3,4,5") // 工作日，逗號分隔
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company     Company           @relation(fields: [companyId], references: [id])
  breaks      ShiftBreak[]
  assignments ShiftAssignment[]

  @@unique([companyId, code])
  @@map("work_shifts")
}

enum ShiftType {
  FIXED    // 固定班
  FLEXIBLE // 彈性班
}

model ShiftBreak {
  id         String  @id @default(cuid())
  shiftId    String
  name       String  // 休息名稱（午休、下午茶等）
  startTime  String  // 格式 "HH:mm"
  endTime    String  // 格式 "HH:mm"
  isPaid     Boolean @default(false) // 是否計薪
  isRequired Boolean @default(true)  // 是否強制
  sortOrder  Int     @default(0)

  shift WorkShift @relation(fields: [shiftId], references: [id], onDelete: Cascade)

  @@map("shift_breaks")
}

model ShiftAssignment {
  id            String   @id @default(cuid())
  employeeId    String
  companyId     String
  shiftId       String
  effectiveDate DateTime // 生效日
  endDate       DateTime? // 結束日（可選）
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  shift WorkShift @relation(fields: [shiftId], references: [id])

  @@unique([employeeId, companyId, effectiveDate])
  @@map("shift_assignments")
}

model AttendanceRecord {
  id         String   @id @default(cuid())
  employeeId String
  companyId  String
  date       DateTime @db.Date // 打卡日期

  // 上班打卡
  clockInTime     DateTime?
  clockInMethod   ClockMethod?
  clockInLocation String? // JSON: {lat, lng}
  clockInIp       String?

  // 下班打卡
  clockOutTime     DateTime?
  clockOutMethod   ClockMethod?
  clockOutLocation String?
  clockOutIp       String?

  // 系統計算
  status            AttendanceStatus @default(PENDING)
  lateMinutes       Int              @default(0)
  earlyLeaveMinutes Int              @default(0)
  overtimeMinutes   Int              @default(0)
  workHours         Float            @default(0)

  // 補打卡
  isAmended    Boolean  @default(false)
  amendReason  String?
  approvedById String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, companyId, date])
  @@map("attendance_records")
}

enum ClockMethod {
  WEB      // 網頁打卡
  APP      // App 打卡
  GPS      // GPS 定位打卡
  IP       // IP 限制打卡
  FACE     // 人臉辨識
  MANUAL   // 人工補登
}

enum AttendanceStatus {
  PENDING     // 待確認
  NORMAL      // 正常
  LATE        // 遲到
  EARLY_LEAVE // 早退
  ABSENT      // 曠職
  LEAVE       // 請假
  EXEMPT      // 免打卡
}
```

**Step 2: 更新 Company model 加入 workShifts 關聯**

在 `Company` model 中加入：

```prisma
model Company {
  // ... 現有欄位 ...
  workShifts  WorkShift[]
  // ... 其他關聯 ...
}
```

**Step 3: 執行 migration**

```bash
cd .worktrees/initial-setup
npx prisma migrate dev --name add_attendance_models
```

Expected: Migration 成功，產生新的 migration 檔案

**Step 4: 產生 Prisma Client**

```bash
npx prisma generate
```

Expected: Prisma Client 更新成功

**Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(attendance): 新增出勤管理資料模型

- WorkShift: 班別設定
- ShiftBreak: 班別休息時段
- ShiftAssignment: 班別指派
- AttendanceRecord: 打卡紀錄

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 建立出勤 tRPC Router - 班別管理

**Files:**
- Create: `src/server/routers/workShift.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 workShift router**

建立 `src/server/routers/workShift.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const workShiftRouter = router({
  // 取得公司所有班別
  list: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workShift.findMany({
        where: { companyId: input.companyId, isActive: true },
        include: { breaks: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { name: 'asc' },
      })
    }),

  // 取得單一班別
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workShift.findUnique({
        where: { id: input.id },
        include: { breaks: { orderBy: { sortOrder: 'asc' } } },
      })
    }),

  // 建立班別
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      name: z.string().min(1),
      code: z.string().min(1),
      shiftType: z.enum(['FIXED', 'FLEXIBLE']).default('FIXED'),
      workStartTime: z.string().regex(/^\d{2}:\d{2}$/),
      workEndTime: z.string().regex(/^\d{2}:\d{2}$/),
      coreStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      coreEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      flexStartRange: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      flexEndRange: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      requiredHours: z.number().optional(),
      lateGraceMinutes: z.number().default(0),
      earlyLeaveGraceMinutes: z.number().default(0),
      overtimeThreshold: z.number().default(30),
      workDays: z.string().default('1,2,3,4,5'),
      breaks: z.array(z.object({
        name: z.string(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        isPaid: z.boolean().default(false),
        isRequired: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { breaks, ...shiftData } = input
      return ctx.prisma.workShift.create({
        data: {
          ...shiftData,
          breaks: breaks ? { create: breaks } : undefined,
        },
        include: { breaks: true },
      })
    }),

  // 更新班別
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      workStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      workEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      lateGraceMinutes: z.number().optional(),
      earlyLeaveGraceMinutes: z.number().optional(),
      overtimeThreshold: z.number().optional(),
      workDays: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.workShift.update({
        where: { id },
        data,
      })
    }),

  // 刪除班別（軟刪除）
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workShift.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),
})
```

**Step 2: 更新 _app.ts 加入 workShift router**

修改 `src/server/routers/_app.ts`：

```typescript
import { router } from '../trpc'
import { healthRouter } from './health'
import { workShiftRouter } from './workShift'

export const appRouter = router({
  health: healthRouter,
  workShift: workShiftRouter,
})

export type AppRouter = typeof appRouter
```

**Step 3: 驗證 TypeScript 編譯**

```bash
npx tsc --noEmit
```

Expected: 無錯誤

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(attendance): 新增班別管理 tRPC API

- list: 取得公司所有班別
- getById: 取得單一班別
- create: 建立班別
- update: 更新班別
- delete: 軟刪除班別

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 建立出勤 tRPC Router - 打卡功能

**Files:**
- Create: `src/server/routers/attendance.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 attendance router**

建立 `src/server/routers/attendance.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// 計算出勤狀態
function calculateAttendanceStatus(
  clockInTime: Date | null,
  clockOutTime: Date | null,
  workStartTime: string,
  workEndTime: string,
  lateGraceMinutes: number,
  earlyLeaveGraceMinutes: number
) {
  if (!clockInTime) {
    return { status: 'ABSENT' as const, lateMinutes: 0, earlyLeaveMinutes: 0 }
  }

  const [startHour, startMin] = workStartTime.split(':').map(Number)
  const [endHour, endMin] = workEndTime.split(':').map(Number)

  const scheduledStart = new Date(clockInTime)
  scheduledStart.setHours(startHour, startMin, 0, 0)

  const scheduledEnd = new Date(clockInTime)
  scheduledEnd.setHours(endHour, endMin, 0, 0)

  // 計算遲到分鐘數
  let lateMinutes = 0
  if (clockInTime > scheduledStart) {
    lateMinutes = Math.floor((clockInTime.getTime() - scheduledStart.getTime()) / 60000)
    lateMinutes = Math.max(0, lateMinutes - lateGraceMinutes)
  }

  // 計算早退分鐘數
  let earlyLeaveMinutes = 0
  if (clockOutTime && clockOutTime < scheduledEnd) {
    earlyLeaveMinutes = Math.floor((scheduledEnd.getTime() - clockOutTime.getTime()) / 60000)
    earlyLeaveMinutes = Math.max(0, earlyLeaveMinutes - earlyLeaveGraceMinutes)
  }

  let status: 'NORMAL' | 'LATE' | 'EARLY_LEAVE' = 'NORMAL'
  if (lateMinutes > 0 && earlyLeaveMinutes > 0) {
    status = 'LATE' // 優先顯示遲到
  } else if (lateMinutes > 0) {
    status = 'LATE'
  } else if (earlyLeaveMinutes > 0) {
    status = 'EARLY_LEAVE'
  }

  return { status, lateMinutes, earlyLeaveMinutes }
}

export const attendanceRouter = router({
  // 上班打卡
  clockIn: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      method: z.enum(['WEB', 'APP', 'GPS', 'IP']).default('WEB'),
      location: z.string().optional(), // JSON string
      ip: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // 檢查是否已有今日紀錄
      const existing = await ctx.prisma.attendanceRecord.findUnique({
        where: {
          employeeId_companyId_date: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            date: today,
          },
        },
      })

      if (existing?.clockInTime) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '今日已完成上班打卡',
        })
      }

      const now = new Date()

      if (existing) {
        // 更新現有紀錄
        return ctx.prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            clockInTime: now,
            clockInMethod: input.method,
            clockInLocation: input.location,
            clockInIp: input.ip,
          },
        })
      }

      // 建立新紀錄
      return ctx.prisma.attendanceRecord.create({
        data: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          date: today,
          clockInTime: now,
          clockInMethod: input.method,
          clockInLocation: input.location,
          clockInIp: input.ip,
          status: 'PENDING',
        },
      })
    }),

  // 下班打卡
  clockOut: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      method: z.enum(['WEB', 'APP', 'GPS', 'IP']).default('WEB'),
      location: z.string().optional(),
      ip: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // 檢查是否有今日紀錄
      const existing = await ctx.prisma.attendanceRecord.findUnique({
        where: {
          employeeId_companyId_date: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            date: today,
          },
        },
      })

      if (!existing) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '尚未完成上班打卡',
        })
      }

      if (existing.clockOutTime) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '今日已完成下班打卡',
        })
      }

      const now = new Date()

      // 取得班別設定計算狀態
      const assignment = await ctx.prisma.shiftAssignment.findFirst({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          effectiveDate: { lte: today },
          OR: [
            { endDate: null },
            { endDate: { gte: today } },
          ],
        },
        include: { shift: true },
        orderBy: { effectiveDate: 'desc' },
      })

      let status: 'NORMAL' | 'LATE' | 'EARLY_LEAVE' | 'PENDING' = 'PENDING'
      let lateMinutes = 0
      let earlyLeaveMinutes = 0
      let workHours = 0

      if (assignment?.shift && existing.clockInTime) {
        const result = calculateAttendanceStatus(
          existing.clockInTime,
          now,
          assignment.shift.workStartTime,
          assignment.shift.workEndTime,
          assignment.shift.lateGraceMinutes,
          assignment.shift.earlyLeaveGraceMinutes
        )
        status = result.status
        lateMinutes = result.lateMinutes
        earlyLeaveMinutes = result.earlyLeaveMinutes
        workHours = (now.getTime() - existing.clockInTime.getTime()) / 3600000
      }

      return ctx.prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          clockOutTime: now,
          clockOutMethod: input.method,
          clockOutLocation: input.location,
          clockOutIp: input.ip,
          status,
          lateMinutes,
          earlyLeaveMinutes,
          workHours: Math.round(workHours * 100) / 100,
        },
      })
    }),

  // 取得今日打卡狀態
  getTodayStatus: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      return ctx.prisma.attendanceRecord.findUnique({
        where: {
          employeeId_companyId_date: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            date: today,
          },
        },
      })
    }),

  // 取得出勤紀錄列表
  list: publicProcedure
    .input(z.object({
      employeeId: z.string().optional(),
      companyId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.attendanceRecord.findMany({
        where: {
          companyId: input.companyId,
          employeeId: input.employeeId,
          date: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        orderBy: { date: 'desc' },
      })
    }),

  // 取得部門出勤紀錄（主管用）
  listByDepartment: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string(),
      date: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      // 取得部門員工
      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: {
          companyId: input.companyId,
          departmentId: input.departmentId,
          status: 'ACTIVE',
        },
        include: { employee: true },
      })

      const employeeIds = assignments.map(a => a.employeeId)

      // 取得出勤紀錄
      const records = await ctx.prisma.attendanceRecord.findMany({
        where: {
          companyId: input.companyId,
          employeeId: { in: employeeIds },
          date: input.date,
        },
      })

      // 合併資料
      return assignments.map(assignment => ({
        employee: assignment.employee,
        attendance: records.find(r => r.employeeId === assignment.employeeId) || null,
      }))
    }),
})
```

**Step 2: 更新 _app.ts**

修改 `src/server/routers/_app.ts`：

```typescript
import { router } from '../trpc'
import { healthRouter } from './health'
import { workShiftRouter } from './workShift'
import { attendanceRouter } from './attendance'

export const appRouter = router({
  health: healthRouter,
  workShift: workShiftRouter,
  attendance: attendanceRouter,
})

export type AppRouter = typeof appRouter
```

**Step 3: 驗證 TypeScript 編譯**

```bash
npx tsc --noEmit
```

Expected: 無錯誤

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(attendance): 新增打卡功能 tRPC API

- clockIn: 上班打卡
- clockOut: 下班打卡
- getTodayStatus: 取得今日打卡狀態
- list: 取得出勤紀錄列表
- listByDepartment: 取得部門出勤紀錄

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 建立打卡頁面 UI

**Files:**
- Modify: `src/app/dashboard/attendance/page.tsx`
- Create: `src/components/attendance/clock-card.tsx`

**Step 1: 建立打卡卡片元件**

建立 `src/components/attendance/clock-card.tsx`：

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface ClockCardProps {
  employeeId: string
  companyId: string
}

export function ClockCard({ employeeId, companyId }: ClockCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const { data: todayStatus, refetch } = trpc.attendance.getTodayStatus.useQuery({
    employeeId,
    companyId,
  })

  const clockInMutation = trpc.attendance.clockIn.useMutation({
    onSuccess: () => refetch(),
  })

  const clockOutMutation = trpc.attendance.clockOut.useMutation({
    onSuccess: () => refetch(),
  })

  const handleClockIn = async () => {
    setIsLoading(true)
    try {
      await clockInMutation.mutateAsync({
        employeeId,
        companyId,
        method: 'WEB',
      })
    } catch (error) {
      console.error('Clock in error:', error)
      alert(error instanceof Error ? error.message : '打卡失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClockOut = async () => {
    setIsLoading(true)
    try {
      await clockOutMutation.mutateAsync({
        employeeId,
        companyId,
        method: 'WEB',
      })
    } catch (error) {
      console.error('Clock out error:', error)
      alert(error instanceof Error ? error.message : '打卡失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (date: Date | null | undefined) => {
    if (!date) return '--:--'
    return new Date(date).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const now = new Date()
  const currentTime = now.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          今日打卡
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 現在時間 */}
        <div className="text-center">
          <p className="text-sm text-gray-500">現在時間</p>
          <p className="text-4xl font-bold">{currentTime}</p>
          <p className="text-sm text-gray-500">
            {now.toLocaleDateString('zh-TW', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </div>

        {/* 打卡紀錄 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-500">上班打卡</p>
            <p className="text-2xl font-semibold text-green-600">
              {formatTime(todayStatus?.clockInTime)}
            </p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-500">下班打卡</p>
            <p className="text-2xl font-semibold text-orange-600">
              {formatTime(todayStatus?.clockOutTime)}
            </p>
          </div>
        </div>

        {/* 打卡按鈕 */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={handleClockIn}
            disabled={isLoading || !!todayStatus?.clockInTime}
            className="h-16 text-lg"
            variant={todayStatus?.clockInTime ? 'outline' : 'default'}
          >
            <LogIn className="mr-2 h-5 w-5" />
            上班打卡
          </Button>
          <Button
            onClick={handleClockOut}
            disabled={isLoading || !todayStatus?.clockInTime || !!todayStatus?.clockOutTime}
            className="h-16 text-lg"
            variant={todayStatus?.clockOutTime ? 'outline' : 'default'}
          >
            <LogOut className="mr-2 h-5 w-5" />
            下班打卡
          </Button>
        </div>

        {/* 狀態顯示 */}
        {todayStatus?.status && todayStatus.status !== 'PENDING' && (
          <div className="text-center">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
              ${todayStatus.status === 'NORMAL' ? 'bg-green-100 text-green-800' : ''}
              ${todayStatus.status === 'LATE' ? 'bg-red-100 text-red-800' : ''}
              ${todayStatus.status === 'EARLY_LEAVE' ? 'bg-yellow-100 text-yellow-800' : ''}
            `}>
              {todayStatus.status === 'NORMAL' && '正常出勤'}
              {todayStatus.status === 'LATE' && `遲到 ${todayStatus.lateMinutes} 分鐘`}
              {todayStatus.status === 'EARLY_LEAVE' && `早退 ${todayStatus.earlyLeaveMinutes} 分鐘`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: 更新出勤管理頁面**

修改 `src/app/dashboard/attendance/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ClockCard } from '@/components/attendance/clock-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Calendar } from 'lucide-react'

export default async function AttendancePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得員工的主要任職公司
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: {
      company: true,
    },
  })

  if (!assignment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">出勤管理</h1>
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            您尚未被指派到任何公司
          </CardContent>
        </Card>
      </div>
    )
  }

  // 取得本月出勤紀錄
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: session.user.id,
      companyId: assignment.companyId,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    orderBy: { date: 'desc' },
  })

  const stats = {
    total: records.length,
    normal: records.filter(r => r.status === 'NORMAL').length,
    late: records.filter(r => r.status === 'LATE').length,
    earlyLeave: records.filter(r => r.status === 'EARLY_LEAVE').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">出勤管理</h1>
        <span className="text-sm text-gray-500">{assignment.company.name}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 打卡卡片 */}
        <ClockCard
          employeeId={session.user.id}
          companyId={assignment.companyId}
        />

        {/* 本月統計 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              本月出勤統計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-500">出勤天數</p>
                <p className="text-2xl font-semibold text-blue-600">{stats.total}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-500">正常</p>
                <p className="text-2xl font-semibold text-green-600">{stats.normal}</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-500">遲到</p>
                <p className="text-2xl font-semibold text-red-600">{stats.late}</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-500">早退</p>
                <p className="text-2xl font-semibold text-yellow-600">{stats.earlyLeave}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 出勤紀錄列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            本月出勤紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-center text-gray-500 py-8">本月尚無出勤紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">日期</th>
                    <th className="text-left py-3 px-2">上班</th>
                    <th className="text-left py-3 px-2">下班</th>
                    <th className="text-left py-3 px-2">工時</th>
                    <th className="text-left py-3 px-2">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">
                        {new Date(record.date).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="py-3 px-2">
                        {record.clockInTime
                          ? new Date(record.clockInTime).toLocaleTimeString('zh-TW', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </td>
                      <td className="py-3 px-2">
                        {record.clockOutTime
                          ? new Date(record.clockOutTime).toLocaleTimeString('zh-TW', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </td>
                      <td className="py-3 px-2">
                        {record.workHours > 0 ? `${record.workHours.toFixed(1)} 小時` : '-'}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
                          ${record.status === 'NORMAL' ? 'bg-green-100 text-green-800' : ''}
                          ${record.status === 'LATE' ? 'bg-red-100 text-red-800' : ''}
                          ${record.status === 'EARLY_LEAVE' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${record.status === 'PENDING' ? 'bg-gray-100 text-gray-800' : ''}
                          ${record.status === 'ABSENT' ? 'bg-red-200 text-red-900' : ''}
                        `}>
                          {record.status === 'NORMAL' && '正常'}
                          {record.status === 'LATE' && '遲到'}
                          {record.status === 'EARLY_LEAVE' && '早退'}
                          {record.status === 'PENDING' && '待確認'}
                          {record.status === 'ABSENT' && '曠職'}
                        </span>
                      </td>
                    </tr>
                  ))}
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

**Step 3: 驗證編譯**

```bash
npm run build
```

Expected: Build 成功

**Step 4: Commit**

```bash
git add src/app/dashboard/attendance/ src/components/attendance/
git commit -m "feat(attendance): 建立出勤管理頁面 UI

- ClockCard: 打卡卡片元件（上班/下班打卡）
- 本月出勤統計
- 出勤紀錄列表

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 新增班別管理頁面（系統設定）

**Files:**
- Create: `src/app/dashboard/settings/shifts/page.tsx`
- Create: `src/components/settings/shift-form.tsx`

**Step 1: 建立班別表單元件**

建立 `src/components/settings/shift-form.tsx`：

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trpc } from '@/lib/trpc'

interface ShiftFormProps {
  companyId: string
  onSuccess?: () => void
}

export function ShiftForm({ companyId, onSuccess }: ShiftFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    workStartTime: '09:00',
    workEndTime: '18:00',
    lateGraceMinutes: 0,
    earlyLeaveGraceMinutes: 0,
  })
  const [isLoading, setIsLoading] = useState(false)

  const createMutation = trpc.workShift.create.useMutation({
    onSuccess: () => {
      setFormData({
        name: '',
        code: '',
        workStartTime: '09:00',
        workEndTime: '18:00',
        lateGraceMinutes: 0,
        earlyLeaveGraceMinutes: 0,
      })
      onSuccess?.()
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await createMutation.mutateAsync({
        companyId,
        ...formData,
        breaks: [
          {
            name: '午休',
            startTime: '12:00',
            endTime: '13:00',
            isPaid: false,
            isRequired: true,
            sortOrder: 0,
          },
        ],
      })
    } catch (error) {
      console.error('Create shift error:', error)
      alert(error instanceof Error ? error.message : '建立失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新增班別</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">班別名稱</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例：早班"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">班別代碼</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="例：MORNING"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workStartTime">上班時間</Label>
              <Input
                id="workStartTime"
                type="time"
                value={formData.workStartTime}
                onChange={(e) => setFormData({ ...formData, workStartTime: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workEndTime">下班時間</Label>
              <Input
                id="workEndTime"
                type="time"
                value={formData.workEndTime}
                onChange={(e) => setFormData({ ...formData, workEndTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lateGraceMinutes">遲到寬限（分鐘）</Label>
              <Input
                id="lateGraceMinutes"
                type="number"
                min="0"
                value={formData.lateGraceMinutes}
                onChange={(e) => setFormData({ ...formData, lateGraceMinutes: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="earlyLeaveGraceMinutes">早退寬限（分鐘）</Label>
              <Input
                id="earlyLeaveGraceMinutes"
                type="number"
                min="0"
                value={formData.earlyLeaveGraceMinutes}
                onChange={(e) => setFormData({ ...formData, earlyLeaveGraceMinutes: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? '建立中...' : '建立班別'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 2: 建立班別管理頁面**

建立 `src/app/dashboard/settings/shifts/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import { ShiftForm } from '@/components/settings/shift-form'

export default async function ShiftsSettingPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得員工的主要任職公司
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: {
      company: true,
      role: true,
    },
  })

  if (!assignment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">班別設定</h1>
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            您尚未被指派到任何公司
          </CardContent>
        </Card>
      </div>
    )
  }

  // 檢查權限（只有 SUPER_ADMIN 和 COMPANY_ADMIN 可以設定班別）
  const isAdmin = assignment.role?.name === 'SUPER_ADMIN' || assignment.role?.name === 'COMPANY_ADMIN'

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">班別設定</h1>
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            您沒有權限存取此頁面
          </CardContent>
        </Card>
      </div>
    )
  }

  // 取得現有班別
  const shifts = await prisma.workShift.findMany({
    where: {
      companyId: assignment.companyId,
      isActive: true,
    },
    include: {
      breaks: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">班別設定</h1>
        <span className="text-sm text-gray-500">{assignment.company.name}</span>
      </div>

      {/* 新增班別 */}
      <ShiftForm companyId={assignment.companyId} />

      {/* 現有班別列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            現有班別
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">尚未設定任何班別</p>
          ) : (
            <div className="space-y-4">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{shift.name}</h3>
                      <p className="text-sm text-gray-500">代碼：{shift.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {shift.workStartTime} - {shift.workEndTime}
                      </p>
                      <p className="text-sm text-gray-500">
                        遲到寬限：{shift.lateGraceMinutes} 分鐘
                      </p>
                    </div>
                  </div>
                  {shift.breaks.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-sm text-gray-500">
                        休息時段：
                        {shift.breaks.map((b) => `${b.name} (${b.startTime}-${b.endTime})`).join('、')}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: 更新系統設定頁面加入連結**

修改 `src/app/dashboard/settings/page.tsx`：

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, Clock, Users, Shield } from 'lucide-react'
import Link from 'next/link'

const settingItems = [
  {
    title: '班別設定',
    description: '管理公司班別、工作時間設定',
    href: '/dashboard/settings/shifts',
    icon: Clock,
  },
  {
    title: '角色權限',
    description: '管理角色與權限設定',
    href: '/dashboard/settings/roles',
    icon: Shield,
  },
  {
    title: '員工管理',
    description: '管理員工帳號與任職',
    href: '/dashboard/hr',
    icon: Users,
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系統設定</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:bg-gray-50 cursor-pointer transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: 驗證編譯**

```bash
npm run build
```

Expected: Build 成功

**Step 5: Commit**

```bash
git add src/app/dashboard/settings/ src/components/settings/
git commit -m "feat(attendance): 新增班別管理頁面

- 班別設定頁面（新增、列表）
- 更新系統設定首頁加入功能連結

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 更新 Seed 資料加入預設班別

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: 更新 seed.ts 加入班別資料**

在 `prisma/seed.ts` 的 `main()` 函數中，在建立任職關係之後加入：

```typescript
  // 9. 建立預設班別
  const normalShift = await prisma.workShift.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'NORMAL' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '正常班',
      code: 'NORMAL',
      shiftType: 'FIXED',
      workStartTime: '09:00',
      workEndTime: '18:00',
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeThreshold: 30,
      workDays: '1,2,3,4,5',
      breaks: {
        create: [
          {
            name: '午休',
            startTime: '12:00',
            endTime: '13:00',
            isPaid: false,
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
    },
  })
  console.log('✅ 班別已建立:', normalShift.name)

  // 10. 指派班別給員工
  const staffAssignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId: staffEmployee.id, companyId: company1.id },
  })

  if (staffAssignment) {
    await prisma.shiftAssignment.upsert({
      where: {
        employeeId_companyId_effectiveDate: {
          employeeId: staffEmployee.id,
          companyId: company1.id,
          effectiveDate: new Date('2023-06-01'),
        },
      },
      update: {},
      create: {
        employeeId: staffEmployee.id,
        companyId: company1.id,
        shiftId: normalShift.id,
        effectiveDate: new Date('2023-06-01'),
      },
    })
  }
  console.log('✅ 班別指派完成')
```

**Step 2: 執行 seed**

```bash
npm run db:seed
```

Expected: Seed 執行成功，顯示班別已建立

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(attendance): 更新 seed 加入預設班別

- 新增正常班（09:00-18:00）
- 指派班別給測試員工

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 測試與部署

**Step 1: 本地測試**

```bash
npm run dev
```

測試項目：
1. 登入 staff@your-remit.com
2. 進入出勤管理頁面
3. 點擊上班打卡
4. 點擊下班打卡
5. 確認出勤紀錄顯示

**Step 2: 全部推送到 GitHub**

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

Expected: Netlify 自動部署

**Step 4: 最終 Commit（如有調整）**

```bash
git add -A
git commit -m "feat(attendance): Phase 2 出勤管理模組完成

- Prisma schema: WorkShift, ShiftBreak, ShiftAssignment, AttendanceRecord
- tRPC API: 班別管理、打卡功能
- UI: 打卡頁面、班別設定頁面
- Seed: 預設班別資料

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

Phase 2 出勤管理模組包含：

| 功能 | 說明 |
|-----|------|
| 班別設定 | 建立、編輯、刪除班別 |
| 班別指派 | 將員工指派到特定班別 |
| 上班打卡 | 記錄上班時間 |
| 下班打卡 | 記錄下班時間、計算狀態 |
| 出勤紀錄 | 查看個人出勤紀錄 |
| 出勤統計 | 本月出勤統計 |

**下一階段 (Phase 3)：** 請假管理模組
