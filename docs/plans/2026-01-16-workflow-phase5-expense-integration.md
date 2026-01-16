# Phase 5: 費用報銷公司選擇與流程整合 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 實作費用報銷時可選擇報銷公司功能，並確保流程引擎正確依據選擇的公司執行簽核

**Architecture:** 新增 API 取得使用者可選擇的報銷公司，修改費用報銷表單新增公司選擇器，流程引擎依據選擇的公司執行

**Tech Stack:** Prisma, tRPC, Next.js, React

---

## Task 1: 新增取得可報銷公司 API

**Files:**
- Modify: `src/server/routers/company.ts`

**Step 1: 新增 getSelectableForExpense procedure**

在 `companyRouter` 中新增以下 procedure：

```typescript
  // 取得使用者可選擇的報銷公司
  getSelectableForExpense: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { userId } = input

      // 1. 檢查是否為集團管理員 (可選擇所有公司)
      const groupPermission = await ctx.prisma.groupPermission.findFirst({
        where: {
          employeeId: userId,
          permissionType: 'GROUP_ADMIN',
        },
      })

      if (groupPermission) {
        // 集團管理員：回傳所有啟用的公司
        return ctx.prisma.company.findMany({
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            group: { select: { id: true, name: true } },
          },
          orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
        })
      }

      // 2. 一般員工：回傳有任職的公司
      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: {
          employeeId: userId,
          status: 'ACTIVE',
        },
        select: {
          companyId: true,
        },
      })

      const companyIds = [...new Set(assignments.map(a => a.companyId))]

      if (companyIds.length === 0) {
        return []
      }

      return ctx.prisma.company.findMany({
        where: {
          id: { in: companyIds },
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          group: { select: { id: true, name: true } },
        },
        orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
      })
    }),
```

**Step 2: Commit**

```bash
git add src/server/routers/company.ts
git commit -m "feat: add getSelectableForExpense API for expense company selection"
```

---

## Task 2: 修改費用報銷表單新增公司選擇器

**Files:**
- Modify: `src/app/dashboard/expense/new/expense-form.tsx`

**Step 1: 新增公司選擇 state 和 query**

在 ExpenseFormProps 中新增：
```typescript
interface ExpenseFormProps {
  employeeId: string
  companyId: string  // 預設公司
  companyName: string
  canSelectCompany: boolean  // 新增：是否可選擇公司
}
```

在元件內新增：
```typescript
  // 選擇的公司 ID (預設為傳入的 companyId)
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId)

  // 取得可選擇的公司列表
  const { data: selectableCompanies } = trpc.company.getSelectableForExpense.useQuery(
    { userId: employeeId },
    { enabled: canSelectCompany }
  )

  // 取得選擇的公司名稱
  const selectedCompanyName = selectableCompanies?.find(c => c.id === selectedCompanyId)?.name || companyName
```

**Step 2: 修改表單，新增公司選擇下拉選單**

在「報銷資訊」Card 內，標題下方新增：

```typescript
          {/* 報銷公司選擇 */}
          {canSelectCompany && selectableCompanies && selectableCompanies.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="company">報銷公司 *</Label>
              <select
                id="company"
                className="w-full border rounded-md p-2"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
              >
                {selectableCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.group?.name ? `${company.group.name} - ` : ''}{company.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                選擇要報銷的公司，簽核流程將依據此公司的設定執行
              </p>
            </div>
          )}
```

**Step 3: 修改費用類別查詢使用選擇的公司**

將原本的：
```typescript
const { data: categories, isLoading: isCategoriesLoading } = trpc.expenseCategory.list.useQuery({ companyId })
```

修改為：
```typescript
const { data: categories, isLoading: isCategoriesLoading } = trpc.expenseCategory.list.useQuery(
  { companyId: selectedCompanyId },
  { enabled: !!selectedCompanyId }
)
```

**Step 4: 修改提交邏輯使用選擇的公司**

在 handleSaveDraft 和 handleSubmit 中，將所有 `companyId` 改為 `selectedCompanyId`

**Step 5: 更新標題顯示**

將：
```typescript
<p className="text-sm text-muted-foreground">{companyName}</p>
```

修改為：
```typescript
<p className="text-sm text-muted-foreground">{selectedCompanyName}</p>
```

**Step 6: Commit**

```bash
git add src/app/dashboard/expense/new/expense-form.tsx
git commit -m "feat: add company selector to expense form"
```

---

## Task 3: 修改費用報銷頁面傳遞 canSelectCompany

**Files:**
- Modify: `src/app/dashboard/expense/new/page.tsx`

**Step 1: 新增權限判斷**

讀取現有的 page.tsx，然後修改：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { prisma } from '@/lib/prisma'
import { ExpenseForm } from './expense-form'

export default async function NewExpensePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">新增費用報銷</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  // 檢查是否可選擇公司 (集團管理員或多公司任職)
  const [groupPermission, assignments] = await Promise.all([
    prisma.groupPermission.findFirst({
      where: {
        employeeId: session.user.id,
        permissionType: 'GROUP_ADMIN',
      },
    }),
    prisma.employeeAssignment.findMany({
      where: {
        employeeId: session.user.id,
        status: 'ACTIVE',
      },
      select: { companyId: true },
    }),
  ])

  const uniqueCompanyIds = [...new Set(assignments.map(a => a.companyId))]
  const canSelectCompany = !!groupPermission || uniqueCompanyIds.length > 1

  return (
    <ExpenseForm
      employeeId={session.user.id}
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      canSelectCompany={canSelectCompany}
    />
  )
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/expense/new/page.tsx
git commit -m "feat: pass canSelectCompany prop to expense form"
```

---

## Task 4: 新增 WorkflowStatus 元件到費用報銷詳情

**Files:**
- Create: `src/app/dashboard/expense/[id]/page.tsx`
- Create: `src/app/dashboard/expense/[id]/expense-detail.tsx`

**Step 1: 建立詳情頁面路由**

```typescript
// src/app/dashboard/expense/[id]/page.tsx
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ExpenseDetail } from './expense-detail'

interface ExpenseDetailPageProps {
  params: { id: string }
}

export default async function ExpenseDetailPage({ params }: ExpenseDetailPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const expense = await prisma.expenseRequest.findUnique({
    where: { id: params.id },
    include: {
      employee: { select: { id: true, name: true, employeeNo: true } },
      company: { select: { id: true, name: true } },
      items: {
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { expenseDate: 'asc' },
      },
    },
  })

  if (!expense) {
    notFound()
  }

  return (
    <ExpenseDetail
      expense={expense}
      currentUserId={session.user.id}
    />
  )
}
```

**Step 2: 建立詳情元件**

```typescript
// src/app/dashboard/expense/[id]/expense-detail.tsx
'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkflowStatus } from '@/components/workflow/workflow-status'
import { ArrowLeft, Receipt, Calendar, Building, User } from 'lucide-react'
import { format } from 'date-fns'

interface ExpenseItem {
  id: string
  expenseDate: Date
  description: string
  amount: number
  vendorName: string | null
  receiptNo: string | null
  category: { id: string; name: string }
}

interface Expense {
  id: string
  title: string
  description: string | null
  status: string
  totalAmount: number
  periodStart: Date | null
  periodEnd: Date | null
  createdAt: Date
  employee: { id: string; name: string; employeeNo: string }
  company: { id: string; name: string }
  items: ExpenseItem[]
}

interface ExpenseDetailProps {
  expense: Expense
  currentUserId: string
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: '草稿', variant: 'secondary' },
  PENDING: { label: '待審核', variant: 'outline' },
  APPROVED: { label: '已核准', variant: 'default' },
  REJECTED: { label: '已駁回', variant: 'destructive' },
  CANCELLED: { label: '已取消', variant: 'secondary' },
}

export function ExpenseDetail({ expense, currentUserId }: ExpenseDetailProps) {
  const status = statusConfig[expense.status] || { label: expense.status, variant: 'outline' as const }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/expense">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{expense.title}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{expense.company.name}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 左側：基本資訊 */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                報銷資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">申請人：</span>
                  <span>{expense.employee.name} ({expense.employee.employeeNo})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">報銷公司：</span>
                  <span>{expense.company.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">報銷期間：</span>
                  <span>
                    {expense.periodStart && expense.periodEnd
                      ? `${format(new Date(expense.periodStart), 'yyyy/MM/dd')} - ${format(new Date(expense.periodEnd), 'yyyy/MM/dd')}`
                      : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">申請日期：</span>
                  <span>{format(new Date(expense.createdAt), 'yyyy/MM/dd HH:mm')}</span>
                </div>
              </div>

              {expense.description && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">說明</p>
                  <p className="text-sm">{expense.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 費用明細 */}
          <Card>
            <CardHeader>
              <CardTitle>費用明細</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expense.items.map((item, index) => (
                  <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        <Badge variant="outline">{item.category.name}</Badge>
                      </div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(item.expenseDate), 'yyyy/MM/dd')}
                        {item.vendorName && ` | ${item.vendorName}`}
                        {item.receiptNo && ` | 發票：${item.receiptNo}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${item.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end items-center gap-4 pt-4 mt-4 border-t">
                <span className="text-lg font-medium">總金額：</span>
                <span className="text-2xl font-bold text-primary">
                  ${expense.totalAmount.toLocaleString()} TWD
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右側：簽核狀態 */}
        <div className="space-y-6">
          <WorkflowStatus
            requestType="EXPENSE"
            requestId={expense.id}
          />
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/dashboard/expense/[id]/page.tsx src/app/dashboard/expense/[id]/expense-detail.tsx
git commit -m "feat: add expense detail page with workflow status"
```

---

## Task 5: 更新費用報銷列表頁面連結到詳情

**Files:**
- Modify: `src/app/dashboard/expense/page.tsx`

**Step 1: 讀取現有頁面並確認列表項目有連結**

確保列表中的報銷單項目可以點擊進入詳情頁：

在列表項目上加入 Link：
```typescript
<Link href={`/dashboard/expense/${expense.id}`}>
  {/* 現有的列表項目內容 */}
</Link>
```

或在查看按鈕上：
```typescript
<Link href={`/dashboard/expense/${expense.id}`}>
  <Button variant="outline" size="sm">查看</Button>
</Link>
```

**Step 2: Commit**

```bash
git add src/app/dashboard/expense/page.tsx
git commit -m "feat: add links to expense detail page"
```

---

## Task 6: 最終驗證

**Step 1: 執行 TypeScript 類型檢查**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: 無錯誤

**Step 2: 執行建置**

Run: `npm run build`

Expected: 建置成功

**Step 3: 功能驗證清單**

- [ ] 集團管理員可在費用報銷表單中選擇任何公司
- [ ] 多公司任職員工可選擇有任職的公司
- [ ] 一般員工不顯示公司選擇器（使用當前公司）
- [ ] 選擇不同公司後，費用類別列表正確更新
- [ ] 送出報銷時使用選擇的公司
- [ ] 費用報銷詳情頁正確顯示簽核狀態

**Step 4: Commit 總結**

```bash
git add .
git commit -m "feat(workflow): 實作 Phase 5 - 費用報銷公司選擇與流程整合

- 新增 getSelectableForExpense API 取得使用者可選擇的報銷公司
- 費用報銷表單新增公司選擇器
- 集團管理員可選擇任何公司
- 多公司任職員工可選擇有任職的公司
- 新增費用報銷詳情頁面含簽核狀態顯示
- 流程引擎依據選擇的公司執行簽核"
```

---

## Summary

Phase 5 完成後，您將擁有：

| 功能 | 狀態 |
|------|------|
| 取得可報銷公司 API | ✅ |
| 費用報銷公司選擇器 | ✅ |
| 集團管理員選擇任意公司 | ✅ |
| 多公司任職選擇 | ✅ |
| 費用報銷詳情頁 | ✅ |
| 簽核狀態顯示整合 | ✅ |

下一階段（Phase 6）將實作：
- 請假申請整合
- 用印申請整合
- 名片申請整合
- 文具申請整合
