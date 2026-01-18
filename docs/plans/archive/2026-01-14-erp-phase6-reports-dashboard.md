# Phase 6: 報表與儀表板 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立動態儀表板與各模組報表系統，提供出勤、請假、費用的統計分析

**Architecture:**
- 新增 dashboard tRPC router 提供即時統計數據
- 新增 report tRPC router 處理各類報表查詢
- 更新首頁儀表板顯示真實數據與圖表
- 建立報表中心頁面，整合出勤報表、請假統計、費用分析

**Tech Stack:** Next.js 14, tRPC, Prisma, PostgreSQL, TailwindCSS, shadcn/ui, recharts (圖表)

---

## Task 1: 安裝圖表套件

**Files:**
- Modify: `package.json`

**Step 1: 安裝 recharts**

```bash
cd C:\ClaudeCode\your-remit-erp02\.worktrees\initial-setup
npm install recharts
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 安裝 recharts 圖表套件

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 建立儀表板統計 tRPC Router

**Files:**
- Create: `src/server/routers/dashboard.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 dashboard router**

建立 `src/server/routers/dashboard.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const dashboardRouter = router({
  // 取得員工個人儀表板統計
  getMyStats: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()
      const startOfMonth = new Date(year, month, 1)
      const endOfMonth = new Date(year, month + 1, 0)
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year, 11, 31)

      // 本月出勤天數
      const attendanceCount = await ctx.prisma.attendanceRecord.count({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          date: { gte: startOfMonth, lte: endOfMonth },
          status: { in: ['NORMAL', 'LATE', 'EARLY_LEAVE'] },
        },
      })

      // 待審核申請數（請假 + 費用）
      const pendingLeave = await ctx.prisma.leaveRequest.count({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'PENDING',
        },
      })

      const pendingExpense = await ctx.prisma.expenseRequest.count({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'PENDING',
        },
      })

      // 剩餘特休時數
      const annualLeaveType = await ctx.prisma.leaveType.findFirst({
        where: { code: 'ANNUAL' },
      })

      let remainingAnnualHours = 0
      if (annualLeaveType) {
        const balance = await ctx.prisma.leaveBalance.findFirst({
          where: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            leaveTypeId: annualLeaveType.id,
            year,
          },
        })
        if (balance) {
          remainingAnnualHours =
            balance.entitledHours + balance.carriedHours + balance.adjustedHours
            - balance.usedHours - balance.pendingHours
        }
      }

      // 本年度費用報銷總額
      const expenseTotal = await ctx.prisma.expenseRequest.aggregate({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'APPROVED',
          periodStart: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { totalAmount: true },
      })

      return {
        attendanceDays: attendanceCount,
        pendingApprovals: pendingLeave + pendingExpense,
        remainingAnnualDays: Math.floor(remainingAnnualHours / 8),
        yearlyExpenseTotal: expenseTotal._sum.totalAmount || 0,
      }
    }),

  // 取得主管儀表板統計（待審核數量）
  getApproverStats: publicProcedure
    .input(z.object({ approverId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 取得下屬
      const subordinates = await ctx.prisma.employeeAssignment.findMany({
        where: { supervisorId: input.approverId, status: 'ACTIVE' },
        select: { employeeId: true, companyId: true },
      })

      if (subordinates.length === 0) {
        return { pendingLeave: 0, pendingExpense: 0, subordinateCount: 0 }
      }

      const pendingLeave = await ctx.prisma.leaveRequest.count({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({
            employeeId: s.employeeId,
            companyId: s.companyId,
          })),
        },
      })

      const pendingExpense = await ctx.prisma.expenseRequest.count({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({
            employeeId: s.employeeId,
            companyId: s.companyId,
          })),
        },
      })

      return {
        pendingLeave,
        pendingExpense,
        subordinateCount: subordinates.length,
      }
    }),

  // 取得近期活動
  getRecentActivity: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      limit: z.number().default(5),
    }))
    .query(async ({ ctx, input }) => {
      const [recentLeave, recentExpense, recentAttendance] = await Promise.all([
        ctx.prisma.leaveRequest.findMany({
          where: {
            employeeId: input.employeeId,
            companyId: input.companyId,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: { leaveType: true },
        }),
        ctx.prisma.expenseRequest.findMany({
          where: {
            employeeId: input.employeeId,
            companyId: input.companyId,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
        ctx.prisma.attendanceRecord.findMany({
          where: {
            employeeId: input.employeeId,
            companyId: input.companyId,
          },
          orderBy: { date: 'desc' },
          take: 3,
        }),
      ])

      // 合併並排序
      const activities = [
        ...recentLeave.map(l => ({
          type: 'leave' as const,
          title: `${l.leaveType.name} 申請`,
          status: l.status,
          date: l.createdAt,
          id: l.id,
        })),
        ...recentExpense.map(e => ({
          type: 'expense' as const,
          title: e.title,
          status: e.status,
          date: e.createdAt,
          id: e.id,
        })),
        ...recentAttendance.map(a => ({
          type: 'attendance' as const,
          title: `出勤打卡`,
          status: a.status,
          date: a.date,
          id: a.id,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, input.limit)

      return activities
    }),
})
```

**Step 2: 更新 _app.ts**

```typescript
import { dashboardRouter } from './dashboard'

// 在 router 中加入
dashboard: dashboardRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(dashboard): 新增儀表板統計 tRPC API

- getMyStats: 個人統計（出勤、待審、特休、費用）
- getApproverStats: 主管統計（待審核數量）
- getRecentActivity: 近期活動

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 更新首頁儀表板顯示真實數據

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: 重寫儀表板頁面**

將 `src/app/dashboard/page.tsx` 改為使用真實數據：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, Calendar, FileText, Receipt, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得員工任職資訊
  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: { company: true, department: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">歡迎回來</h1>
        <p className="text-muted-foreground mt-2">請聯繫管理員設定您的任職資訊</p>
      </div>
    )
  }

  const assignment = employee.assignments[0]
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const startOfMonth = new Date(year, month, 1)
  const endOfMonth = new Date(year, month + 1, 0)
  const startOfYear = new Date(year, 0, 1)

  // 本月出勤天數
  const attendanceCount = await prisma.attendanceRecord.count({
    where: {
      employeeId: employee.id,
      companyId: assignment.companyId,
      date: { gte: startOfMonth, lte: endOfMonth },
      status: { in: ['NORMAL', 'LATE', 'EARLY_LEAVE'] },
    },
  })

  // 待審核申請
  const pendingLeave = await prisma.leaveRequest.count({
    where: { employeeId: employee.id, status: 'PENDING' },
  })
  const pendingExpense = await prisma.expenseRequest.count({
    where: { employeeId: employee.id, status: 'PENDING' },
  })

  // 待我審核（主管）
  const subordinates = await prisma.employeeAssignment.findMany({
    where: { supervisorId: assignment.id, status: 'ACTIVE' },
    select: { employeeId: true, companyId: true },
  })

  let pendingForMe = 0
  if (subordinates.length > 0) {
    const pendingLeaveForMe = await prisma.leaveRequest.count({
      where: {
        status: 'PENDING',
        OR: subordinates.map(s => ({ employeeId: s.employeeId, companyId: s.companyId })),
      },
    })
    const pendingExpenseForMe = await prisma.expenseRequest.count({
      where: {
        status: 'PENDING',
        OR: subordinates.map(s => ({ employeeId: s.employeeId, companyId: s.companyId })),
      },
    })
    pendingForMe = pendingLeaveForMe + pendingExpenseForMe
  }

  // 剩餘特休
  const annualLeaveType = await prisma.leaveType.findFirst({ where: { code: 'ANNUAL' } })
  let remainingAnnualDays = 0
  if (annualLeaveType) {
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        employeeId: employee.id,
        companyId: assignment.companyId,
        leaveTypeId: annualLeaveType.id,
        year,
      },
    })
    if (balance) {
      const totalHours = balance.entitledHours + balance.carriedHours + balance.adjustedHours
      const usedHours = balance.usedHours + balance.pendingHours
      remainingAnnualDays = Math.floor((totalHours - usedHours) / 8)
    }
  }

  // 本年度費用報銷
  const expenseTotal = await prisma.expenseRequest.aggregate({
    where: {
      employeeId: employee.id,
      companyId: assignment.companyId,
      status: 'APPROVED',
      periodStart: { gte: startOfYear },
    },
    _sum: { totalAmount: true },
  })

  // 近期活動
  const recentLeave = await prisma.leaveRequest.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { leaveType: true },
  })

  const recentExpense = await prisma.expenseRequest.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })

  const stats = [
    {
      name: '本月出勤',
      value: `${attendanceCount} 天`,
      icon: Clock,
      color: 'text-green-600',
      href: '/dashboard/attendance',
    },
    {
      name: '待審核申請',
      value: `${pendingLeave + pendingExpense}`,
      icon: FileText,
      color: 'text-blue-600',
      href: '/dashboard/leave',
    },
    {
      name: '剩餘特休',
      value: `${remainingAnnualDays} 天`,
      icon: Calendar,
      color: 'text-orange-600',
      href: '/dashboard/leave',
    },
    {
      name: '年度報銷',
      value: `$${(expenseTotal._sum.totalAmount || 0).toLocaleString()}`,
      icon: Receipt,
      color: 'text-purple-600',
      href: '/dashboard/expense',
    },
  ]

  // 如果是主管，加入待審核
  if (pendingForMe > 0) {
    stats.push({
      name: '待我審核',
      value: `${pendingForMe}`,
      icon: Users,
      color: 'text-red-600',
      href: '/dashboard/approval',
    })
  }

  const statusLabels: Record<string, string> = {
    DRAFT: '草稿',
    PENDING: '審核中',
    APPROVED: '已核准',
    REJECTED: '已拒絕',
    CANCELLED: '已取消',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          歡迎回來，{employee.name}
        </h1>
        <p className="text-muted-foreground">
          {assignment.company.name} - {assignment.department?.name || '未分配部門'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.name} href={stat.href}>
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.name}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近請假</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeave.length === 0 ? (
              <p className="text-muted-foreground">暫無請假記錄</p>
            ) : (
              <div className="space-y-3">
                {recentLeave.map((leave) => (
                  <div key={leave.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{leave.leaveType.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(leave.startDate).toLocaleDateString('zh-TW')}
                      </p>
                    </div>
                    <span className="text-sm">{statusLabels[leave.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近報銷</CardTitle>
          </CardHeader>
          <CardContent>
            {recentExpense.length === 0 ? (
              <p className="text-muted-foreground">暫無報銷記錄</p>
            ) : (
              <div className="space-y-3">
                {recentExpense.map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{expense.title}</p>
                      <p className="text-sm text-muted-foreground">
                        ${expense.totalAmount.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-sm">{statusLabels[expense.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 2: 驗證編譯**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/dashboard/
git commit -m "feat(dashboard): 更新首頁顯示真實數據

- 本月出勤、待審核、剩餘特休、年度報銷
- 主管顯示待審核數量
- 最近請假與報銷記錄

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 建立報表 tRPC Router

**Files:**
- Create: `src/server/routers/report.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 report router**

建立 `src/server/routers/report.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const reportRouter = router({
  // 出勤月報
  attendanceMonthly: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string().optional(),
      year: z.number(),
      month: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.year, input.month - 1, 1)
      const endDate = new Date(input.year, input.month, 0)

      // 取得員工列表
      const employeeFilter: Record<string, unknown> = {
        companyId: input.companyId,
        status: 'ACTIVE',
      }
      if (input.departmentId) {
        employeeFilter.departmentId = input.departmentId
      }

      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: employeeFilter,
        include: {
          employee: true,
          department: true,
        },
      })

      // 取得出勤記錄
      const records = await ctx.prisma.attendanceRecord.findMany({
        where: {
          companyId: input.companyId,
          date: { gte: startDate, lte: endDate },
          employeeId: { in: assignments.map(a => a.employeeId) },
        },
      })

      // 統計每位員工
      const report = assignments.map(assignment => {
        const empRecords = records.filter(r => r.employeeId === assignment.employeeId)
        return {
          employeeId: assignment.employeeId,
          employeeName: assignment.employee.name,
          employeeNo: assignment.employee.employeeNo,
          department: assignment.department?.name || '-',
          normalDays: empRecords.filter(r => r.status === 'NORMAL').length,
          lateDays: empRecords.filter(r => r.status === 'LATE').length,
          earlyLeaveDays: empRecords.filter(r => r.status === 'EARLY_LEAVE').length,
          absentDays: empRecords.filter(r => r.status === 'ABSENT').length,
          leaveDays: empRecords.filter(r => r.status === 'LEAVE').length,
          totalOvertimeMinutes: empRecords.reduce((sum, r) => sum + r.overtimeMinutes, 0),
        }
      })

      return {
        period: { year: input.year, month: input.month },
        data: report,
        summary: {
          totalEmployees: report.length,
          avgNormalDays: report.length > 0
            ? (report.reduce((sum, r) => sum + r.normalDays, 0) / report.length).toFixed(1)
            : 0,
          totalOvertimeHours: (report.reduce((sum, r) => sum + r.totalOvertimeMinutes, 0) / 60).toFixed(1),
        },
      }
    }),

  // 請假統計
  leaveStatistics: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string().optional(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const startOfYear = new Date(input.year, 0, 1)
      const endOfYear = new Date(input.year, 11, 31)

      // 取得請假類型
      const leaveTypes = await ctx.prisma.leaveType.findMany({
        where: {
          isActive: true,
          OR: [{ companyId: null }, { companyId: input.companyId }],
        },
      })

      // 員工篩選
      const employeeFilter: Record<string, unknown> = {
        companyId: input.companyId,
        status: 'ACTIVE',
      }
      if (input.departmentId) {
        employeeFilter.departmentId = input.departmentId
      }

      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: employeeFilter,
        include: { employee: true, department: true },
      })

      // 取得請假記錄
      const requests = await ctx.prisma.leaveRequest.findMany({
        where: {
          companyId: input.companyId,
          employeeId: { in: assignments.map(a => a.employeeId) },
          status: 'APPROVED',
          startDate: { gte: startOfYear, lte: endOfYear },
        },
        include: { leaveType: true },
      })

      // 按假別統計
      const byType = leaveTypes.map(type => ({
        typeId: type.id,
        typeName: type.name,
        typeCode: type.code,
        totalHours: requests
          .filter(r => r.leaveTypeId === type.id)
          .reduce((sum, r) => sum + r.totalHours, 0),
        requestCount: requests.filter(r => r.leaveTypeId === type.id).length,
      }))

      // 按月份統計
      const byMonth = Array.from({ length: 12 }, (_, i) => {
        const monthRequests = requests.filter(r =>
          new Date(r.startDate).getMonth() === i
        )
        return {
          month: i + 1,
          totalHours: monthRequests.reduce((sum, r) => sum + r.totalHours, 0),
          requestCount: monthRequests.length,
        }
      })

      return {
        year: input.year,
        byType,
        byMonth,
        summary: {
          totalRequests: requests.length,
          totalHours: requests.reduce((sum, r) => sum + r.totalHours, 0),
          avgPerEmployee: assignments.length > 0
            ? (requests.reduce((sum, r) => sum + r.totalHours, 0) / assignments.length).toFixed(1)
            : 0,
        },
      }
    }),

  // 費用分析
  expenseAnalysis: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string().optional(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const startOfYear = new Date(input.year, 0, 1)
      const endOfYear = new Date(input.year, 11, 31)

      // 取得費用類別
      const categories = await ctx.prisma.expenseCategory.findMany({
        where: {
          isActive: true,
          OR: [{ companyId: null }, { companyId: input.companyId }],
        },
      })

      // 員工篩選
      const employeeFilter: Record<string, unknown> = {
        companyId: input.companyId,
        status: 'ACTIVE',
      }
      if (input.departmentId) {
        employeeFilter.departmentId = input.departmentId
      }

      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: employeeFilter,
        include: { employee: true, department: true },
      })

      // 取得費用記錄
      const requests = await ctx.prisma.expenseRequest.findMany({
        where: {
          companyId: input.companyId,
          employeeId: { in: assignments.map(a => a.employeeId) },
          status: 'APPROVED',
          periodStart: { gte: startOfYear, lte: endOfYear },
        },
        include: {
          items: { include: { category: true } },
        },
      })

      // 按類別統計
      const allItems = requests.flatMap(r => r.items)
      const byCategory = categories.map(cat => ({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryCode: cat.code,
        totalAmount: allItems
          .filter(item => item.categoryId === cat.id)
          .reduce((sum, item) => sum + item.amount, 0),
        itemCount: allItems.filter(item => item.categoryId === cat.id).length,
      }))

      // 按月份統計
      const byMonth = Array.from({ length: 12 }, (_, i) => {
        const monthRequests = requests.filter(r =>
          new Date(r.periodStart).getMonth() === i
        )
        return {
          month: i + 1,
          totalAmount: monthRequests.reduce((sum, r) => sum + r.totalAmount, 0),
          requestCount: monthRequests.length,
        }
      })

      // 按部門統計
      const byDepartment = assignments.reduce((acc, assignment) => {
        const deptName = assignment.department?.name || '未分配'
        const deptRequests = requests.filter(r => r.employeeId === assignment.employeeId)
        const total = deptRequests.reduce((sum, r) => sum + r.totalAmount, 0)

        const existing = acc.find(d => d.departmentName === deptName)
        if (existing) {
          existing.totalAmount += total
          existing.requestCount += deptRequests.length
        } else {
          acc.push({
            departmentName: deptName,
            totalAmount: total,
            requestCount: deptRequests.length,
          })
        }
        return acc
      }, [] as { departmentName: string; totalAmount: number; requestCount: number }[])

      return {
        year: input.year,
        byCategory,
        byMonth,
        byDepartment,
        summary: {
          totalRequests: requests.length,
          totalAmount: requests.reduce((sum, r) => sum + r.totalAmount, 0),
          avgPerRequest: requests.length > 0
            ? (requests.reduce((sum, r) => sum + r.totalAmount, 0) / requests.length).toFixed(0)
            : 0,
        },
      }
    }),
})
```

**Step 2: 更新 _app.ts**

```typescript
import { reportRouter } from './report'

// 在 router 中加入
report: reportRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(report): 新增報表統計 tRPC API

- attendanceMonthly: 出勤月報
- leaveStatistics: 請假統計
- expenseAnalysis: 費用分析

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 建立報表中心頁面

**Files:**
- Create: `src/app/dashboard/reports/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: 建立報表中心首頁**

建立 `src/app/dashboard/reports/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Calendar, Receipt, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default async function ReportsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const reportItems = [
    {
      title: '出勤報表',
      description: '查看員工出勤記錄、遲到早退、加班統計',
      href: '/dashboard/reports/attendance',
      icon: Clock,
    },
    {
      title: '請假統計',
      description: '各類假別使用統計、年度趨勢分析',
      href: '/dashboard/reports/leave',
      icon: Calendar,
    },
    {
      title: '費用分析',
      description: '費用類別分布、月度趨勢、部門比較',
      href: '/dashboard/reports/expense',
      icon: Receipt,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">報表中心</h1>
        <p className="text-muted-foreground">查看各項統計報表與分析數據</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-primary">查看報表 &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: 更新 sidebar**

在 `src/components/layout/sidebar.tsx` 加入報表選單：

```typescript
{
  title: '報表中心',
  href: '/dashboard/reports',
  icon: BarChart3,
},
```

Import `BarChart3` from lucide-react。

**Step 3: 驗證編譯**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/dashboard/reports/ src/components/layout/
git commit -m "feat(report): 建立報表中心首頁

- 報表類型選單
- sidebar 選單

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 建立出勤報表頁面

**Files:**
- Create: `src/app/dashboard/reports/attendance/page.tsx`

**Step 1: 建立出勤報表頁面**

建立 `src/app/dashboard/reports/attendance/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Users, AlertTriangle, TrendingUp } from 'lucide-react'

export default async function AttendanceReportPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得員工任職資訊
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
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const startOfMonth = new Date(year, month, 1)
  const endOfMonth = new Date(year, month + 1, 0)

  // 取得部門列表
  const departments = await prisma.department.findMany({
    where: { companyId: assignment.companyId, isActive: true },
    orderBy: { name: 'asc' },
  })

  // 取得所有員工任職
  const assignments = await prisma.employeeAssignment.findMany({
    where: { companyId: assignment.companyId, status: 'ACTIVE' },
    include: { employee: true, department: true },
  })

  // 取得本月出勤記錄
  const records = await prisma.attendanceRecord.findMany({
    where: {
      companyId: assignment.companyId,
      date: { gte: startOfMonth, lte: endOfMonth },
    },
  })

  // 統計
  const report = assignments.map(a => {
    const empRecords = records.filter(r => r.employeeId === a.employeeId)
    return {
      employeeId: a.employeeId,
      employeeName: a.employee.name,
      employeeNo: a.employee.employeeNo,
      department: a.department?.name || '-',
      normalDays: empRecords.filter(r => r.status === 'NORMAL').length,
      lateDays: empRecords.filter(r => r.status === 'LATE').length,
      earlyLeaveDays: empRecords.filter(r => r.status === 'EARLY_LEAVE').length,
      absentDays: empRecords.filter(r => r.status === 'ABSENT').length,
      overtimeHours: (empRecords.reduce((sum, r) => sum + r.overtimeMinutes, 0) / 60).toFixed(1),
    }
  })

  const summary = {
    totalEmployees: report.length,
    avgNormalDays: report.length > 0
      ? (report.reduce((sum, r) => sum + r.normalDays, 0) / report.length).toFixed(1)
      : '0',
    totalLateDays: report.reduce((sum, r) => sum + r.lateDays, 0),
    totalOvertimeHours: report.reduce((sum, r) => sum + parseFloat(r.overtimeHours), 0).toFixed(1),
  }

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                      '七月', '八月', '九月', '十月', '十一月', '十二月']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">出勤報表</h1>
        <p className="text-muted-foreground">
          {year}年{monthNames[month]} - {assignment.company.name}
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              員工人數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalEmployees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              平均出勤
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.avgNormalDays} 天</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              總遲到次數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{summary.totalLateDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              總加班時數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalOvertimeHours} hr</p>
          </CardContent>
        </Card>
      </div>

      {/* 員工列表 */}
      <Card>
        <CardHeader>
          <CardTitle>員工出勤明細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">員工編號</th>
                  <th className="text-left py-3 px-2">姓名</th>
                  <th className="text-left py-3 px-2">部門</th>
                  <th className="text-center py-3 px-2">正常</th>
                  <th className="text-center py-3 px-2">遲到</th>
                  <th className="text-center py-3 px-2">早退</th>
                  <th className="text-center py-3 px-2">缺勤</th>
                  <th className="text-center py-3 px-2">加班(hr)</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr key={row.employeeId} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">{row.employeeNo}</td>
                    <td className="py-3 px-2 font-medium">{row.employeeName}</td>
                    <td className="py-3 px-2">{row.department}</td>
                    <td className="py-3 px-2 text-center">{row.normalDays}</td>
                    <td className="py-3 px-2 text-center text-orange-600">{row.lateDays || '-'}</td>
                    <td className="py-3 px-2 text-center text-yellow-600">{row.earlyLeaveDays || '-'}</td>
                    <td className="py-3 px-2 text-center text-red-600">{row.absentDays || '-'}</td>
                    <td className="py-3 px-2 text-center">{row.overtimeHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: 驗證編譯**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/dashboard/reports/attendance/
git commit -m "feat(report): 建立出勤報表頁面

- 統計卡片（員工數、平均出勤、遲到、加班）
- 員工出勤明細表格

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 建立請假統計頁面

**Files:**
- Create: `src/app/dashboard/reports/leave/page.tsx`

**Step 1: 建立請假統計頁面**

建立 `src/app/dashboard/reports/leave/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, TrendingUp, Users } from 'lucide-react'

export default async function LeaveReportPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

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
  const year = new Date().getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31)

  // 取得假別
  const leaveTypes = await prisma.leaveType.findMany({
    where: {
      isActive: true,
      OR: [{ companyId: null }, { companyId: assignment.companyId }],
    },
    orderBy: { sortOrder: 'asc' },
  })

  // 取得請假記錄
  const requests = await prisma.leaveRequest.findMany({
    where: {
      companyId: assignment.companyId,
      status: 'APPROVED',
      startDate: { gte: startOfYear, lte: endOfYear },
    },
    include: { leaveType: true },
  })

  // 按假別統計
  const byType = leaveTypes.map(type => ({
    typeName: type.name,
    typeCode: type.code,
    totalHours: requests
      .filter(r => r.leaveTypeId === type.id)
      .reduce((sum, r) => sum + r.totalHours, 0),
    totalDays: requests
      .filter(r => r.leaveTypeId === type.id)
      .reduce((sum, r) => sum + r.totalHours, 0) / 8,
    requestCount: requests.filter(r => r.leaveTypeId === type.id).length,
  })).filter(t => t.requestCount > 0)

  // 按月份統計
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const monthRequests = requests.filter(r =>
      new Date(r.startDate).getMonth() === i
    )
    return {
      month: i + 1,
      monthName: `${i + 1}月`,
      totalDays: monthRequests.reduce((sum, r) => sum + r.totalHours, 0) / 8,
      requestCount: monthRequests.length,
    }
  })

  const summary = {
    totalRequests: requests.length,
    totalDays: (requests.reduce((sum, r) => sum + r.totalHours, 0) / 8).toFixed(1),
    mostUsedType: byType.sort((a, b) => b.totalDays - a.totalDays)[0]?.typeName || '-',
    peakMonth: byMonth.sort((a, b) => b.totalDays - a.totalDays)[0]?.monthName || '-',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">請假統計</h1>
        <p className="text-muted-foreground">
          {year}年度 - {assignment.company.name}
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              總請假天數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalDays} 天</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              請假筆數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalRequests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              最常使用假別
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.mostUsedType}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              請假高峰月
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.peakMonth}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 假別統計 */}
        <Card>
          <CardHeader>
            <CardTitle>各假別使用統計</CardTitle>
          </CardHeader>
          <CardContent>
            {byType.length === 0 ? (
              <p className="text-muted-foreground">本年度尚無請假記錄</p>
            ) : (
              <div className="space-y-4">
                {byType.map((type) => (
                  <div key={type.typeCode} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{type.typeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {type.requestCount} 筆
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{type.totalDays.toFixed(1)} 天</p>
                      <p className="text-sm text-muted-foreground">
                        {type.totalHours.toFixed(0)} 小時
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 月份統計 */}
        <Card>
          <CardHeader>
            <CardTitle>月度請假趨勢</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byMonth.map((month) => (
                <div key={month.month} className="flex items-center gap-2">
                  <span className="w-8 text-sm text-muted-foreground">{month.monthName}</span>
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (month.totalDays / Math.max(...byMonth.map(m => m.totalDays)) * 100) || 0)}%`
                      }}
                    />
                  </div>
                  <span className="w-16 text-right text-sm">
                    {month.totalDays.toFixed(1)} 天
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 2: 驗證編譯**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/dashboard/reports/leave/
git commit -m "feat(report): 建立請假統計頁面

- 統計卡片（總天數、筆數、常用假別、高峰月）
- 假別使用統計
- 月度趨勢圖

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 建立費用分析頁面

**Files:**
- Create: `src/app/dashboard/reports/expense/page.tsx`

**Step 1: 建立費用分析頁面**

建立 `src/app/dashboard/reports/expense/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt, TrendingUp, PieChart, Building2 } from 'lucide-react'

export default async function ExpenseReportPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

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
  const year = new Date().getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31)

  // 取得費用類別
  const categories = await prisma.expenseCategory.findMany({
    where: {
      isActive: true,
      OR: [{ companyId: null }, { companyId: assignment.companyId }],
    },
    orderBy: { sortOrder: 'asc' },
  })

  // 取得費用記錄
  const requests = await prisma.expenseRequest.findMany({
    where: {
      companyId: assignment.companyId,
      status: 'APPROVED',
      periodStart: { gte: startOfYear, lte: endOfYear },
    },
    include: {
      items: { include: { category: true } },
    },
  })

  // 按類別統計
  const allItems = requests.flatMap(r => r.items)
  const byCategory = categories.map(cat => ({
    categoryName: cat.name,
    categoryCode: cat.code,
    totalAmount: allItems
      .filter(item => item.categoryId === cat.id)
      .reduce((sum, item) => sum + item.amount, 0),
    itemCount: allItems.filter(item => item.categoryId === cat.id).length,
  })).filter(c => c.itemCount > 0).sort((a, b) => b.totalAmount - a.totalAmount)

  // 按月份統計
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const monthRequests = requests.filter(r =>
      new Date(r.periodStart).getMonth() === i
    )
    return {
      month: i + 1,
      monthName: `${i + 1}月`,
      totalAmount: monthRequests.reduce((sum, r) => sum + r.totalAmount, 0),
      requestCount: monthRequests.length,
    }
  })

  const totalAmount = requests.reduce((sum, r) => sum + r.totalAmount, 0)
  const summary = {
    totalRequests: requests.length,
    totalAmount,
    avgPerRequest: requests.length > 0 ? Math.round(totalAmount / requests.length) : 0,
    topCategory: byCategory[0]?.categoryName || '-',
    peakMonth: byMonth.sort((a, b) => b.totalAmount - a.totalAmount)[0]?.monthName || '-',
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">費用分析</h1>
        <p className="text-muted-foreground">
          {year}年度 - {assignment.company.name}
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              年度總費用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatAmount(summary.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              報銷筆數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalRequests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              最大類別
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.topCategory}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              費用高峰月
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.peakMonth}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 類別統計 */}
        <Card>
          <CardHeader>
            <CardTitle>費用類別分布</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-muted-foreground">本年度尚無費用記錄</p>
            ) : (
              <div className="space-y-4">
                {byCategory.map((cat) => (
                  <div key={cat.categoryCode}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{cat.categoryName}</span>
                      <span className="text-sm">{formatAmount(cat.totalAmount)}</span>
                    </div>
                    <div className="bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{
                          width: `${(cat.totalAmount / totalAmount * 100)}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cat.itemCount} 筆 ({(cat.totalAmount / totalAmount * 100).toFixed(1)}%)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 月份統計 */}
        <Card>
          <CardHeader>
            <CardTitle>月度費用趨勢</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byMonth.map((month) => (
                <div key={month.month} className="flex items-center gap-2">
                  <span className="w-8 text-sm text-muted-foreground">{month.monthName}</span>
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-green-500 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (month.totalAmount / Math.max(...byMonth.map(m => m.totalAmount)) * 100) || 0)}%`
                      }}
                    />
                  </div>
                  <span className="w-20 text-right text-sm">
                    {formatAmount(month.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 2: 驗證編譯**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/dashboard/reports/expense/
git commit -m "feat(report): 建立費用分析頁面

- 統計卡片（總費用、筆數、最大類別、高峰月）
- 類別分布圖
- 月度趨勢圖

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: 測試與部署

**Step 1: 驗證編譯**

```bash
npm run build
```

**Step 2: 合併到 master**

```bash
cd C:\ClaudeCode\your-remit-erp02
git checkout master
git merge --no-edit feature/initial-setup
git push origin master
```

**Step 3: 確認 Netlify 部署完成**

---

## Summary

Phase 6 報表與儀表板包含：

| 功能 | 說明 |
|-----|------|
| 動態儀表板 | 真實數據統計（出勤、待審、特休、費用） |
| 主管視圖 | 待審核數量、下屬統計 |
| 近期活動 | 最近請假與報銷記錄 |
| 出勤報表 | 月度出勤明細、遲到早退、加班統計 |
| 請假統計 | 假別使用分布、月度趨勢 |
| 費用分析 | 類別分布、月度趨勢、費用高峰 |

**新增 tRPC Routers：**
- `dashboard`: 儀表板統計 API
- `report`: 報表查詢 API

**新增頁面：**
- `/dashboard` - 動態儀表板（更新）
- `/dashboard/reports` - 報表中心首頁
- `/dashboard/reports/attendance` - 出勤報表
- `/dashboard/reports/leave` - 請假統計
- `/dashboard/reports/expense` - 費用分析
