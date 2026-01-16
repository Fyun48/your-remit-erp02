# Phase 7: 請假申請工作流程整合 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 整合請假申請的工作流程，使其使用統一的流程引擎

**Architecture:** 在請假表單送出時啟動工作流程，建立詳情頁面並加入 WorkflowStatus 元件顯示簽核狀態

**Tech Stack:** Prisma, tRPC, Next.js, React

---

## Task 1: 請假表單整合工作流程

**Files:**
- Modify: `src/components/leave/leave-form.tsx`

**Step 1: 引入 workflow mutation**

在 imports 區塊後，加入 useRouter 和 workflow mutation：

```typescript
import { useRouter } from 'next/navigation'
// ... 其他 imports
```

在 component 內加入：
```typescript
const router = useRouter()
const startWorkflow = trpc.workflow.startInstance.useMutation()
```

**Step 2: 修改 handleSubmit 函數**

將原本的 create + submit 改為 create + 嘗試啟動 workflow：

```typescript
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

    // 嘗試啟動工作流程
    try {
      await startWorkflow.mutateAsync({
        requestType: 'LEAVE',
        requestId: request.id,
        applicantId: employeeId,
        companyId,
        requestData: {
          leaveTypeId: formData.leaveTypeId,
          totalHours: request.totalHours,
        },
      })
    } catch {
      // 無工作流程定義，使用傳統審批
      console.log('No workflow defined, using traditional approval')
      await submitMutation.mutateAsync({ id: request.id })
    }

    // 重置表單
    setFormData({
      leaveTypeId: '',
      startDate: '',
      startPeriod: 'FULL_DAY',
      endDate: '',
      endPeriod: 'FULL_DAY',
      reason: '',
    })
    router.refresh()
    onSuccess?.()
  } catch (error) {
    console.error('Submit error:', error)
    alert(error instanceof Error ? error.message : '申請失敗')
  } finally {
    setIsLoading(false)
  }
}
```

**Step 3: Commit**

```bash
git add src/components/leave/leave-form.tsx
git commit -m "feat: integrate workflow engine for leave request form"
```

---

## Task 2: 建立請假詳情頁面

**Files:**
- Create: `src/app/dashboard/leave/[id]/page.tsx`
- Create: `src/app/dashboard/leave/[id]/leave-request-detail.tsx`

**Step 1: 建立 page.tsx**

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { LeaveRequestDetail } from './leave-request-detail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LeaveRequestDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { id } = await params

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      leaveType: true,
      employee: {
        select: { id: true, name: true, employeeNo: true, email: true },
      },
      company: {
        select: { id: true, name: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
      rejectedBy: {
        select: { id: true, name: true },
      },
    },
  })

  if (!leaveRequest) {
    notFound()
  }

  return (
    <LeaveRequestDetail
      request={leaveRequest}
      currentUserId={session.user.id}
    />
  )
}
```

**Step 2: 建立 leave-request-detail.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Trash2,
  User,
  Building2,
  FileText,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { WorkflowStatus } from '@/components/workflow/workflow-status'

interface LeaveRequest {
  id: string
  requestNo: string
  employeeId: string
  companyId: string
  leaveTypeId: string
  startDate: Date
  startPeriod: string
  endDate: Date
  endPeriod: string
  totalHours: number
  reason: string | null
  status: string
  submittedAt: Date | null
  processedAt: Date | null
  approvedById: string | null
  rejectedById: string | null
  approvalComment: string | null
  createdAt: Date
  updatedAt: Date
  leaveType: { id: string; name: string; code: string }
  employee: { id: string; name: string; employeeNo: string; email: string }
  company: { id: string; name: string }
  approvedBy: { id: string; name: string } | null
  rejectedBy: { id: string; name: string } | null
}

interface LeaveRequestDetailProps {
  request: LeaveRequest
  currentUserId: string
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  PENDING: { label: '待審核', color: 'bg-blue-100 text-blue-700', icon: Clock },
  APPROVED: { label: '已核准', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '已駁回', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500', icon: XCircle },
}

const periodLabels: Record<string, string> = {
  FULL_DAY: '全天',
  AM: '上午',
  PM: '下午',
}

export function LeaveRequestDetail({ request, currentUserId }: LeaveRequestDetailProps) {
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const submit = trpc.leaveRequest.submit.useMutation({
    onSuccess: () => router.refresh(),
  })

  const cancel = trpc.leaveRequest.cancel.useMutation({
    onSuccess: () => {
      setShowCancelDialog(false)
      router.refresh()
    },
  })

  const approve = trpc.leaveRequest.approve.useMutation({
    onSuccess: () => router.refresh(),
  })

  const status = statusConfig[request.status] || statusConfig.DRAFT
  const StatusIcon = status.icon

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-TW')
  }

  const formatDateTime = (date: Date | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('zh-TW')
  }

  const isOwner = request.employeeId === currentUserId

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/leave">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{request.requestNo}</h1>
              <Badge className={status.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">{request.company.name}</p>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-2">
          {request.status === 'DRAFT' && isOwner && (
            <>
              <Button onClick={() => submit.mutate({ id: request.id })}>
                <Send className="h-4 w-4 mr-2" />
                提交審批
              </Button>
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() => setShowCancelDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                取消
              </Button>
            </>
          )}
          {request.status === 'PENDING' && (
            <>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() =>
                  approve.mutate({
                    id: request.id,
                    action: 'APPROVE',
                    approverId: currentUserId,
                  })
                }
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                核准
              </Button>
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() =>
                  approve.mutate({
                    id: request.id,
                    action: 'REJECT',
                    approverId: currentUserId,
                  })
                }
              >
                <XCircle className="h-4 w-4 mr-2" />
                駁回
              </Button>
              {isOwner && (
                <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
                  取消申請
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 主要內容 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 請假資訊 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                請假資訊
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">假別</p>
                  <p className="font-medium">{request.leaveType.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">請假天數</p>
                  <p className="font-medium">{request.totalHours / 8} 天</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">開始日期</p>
                  <p className="font-medium">
                    {formatDate(request.startDate)} {periodLabels[request.startPeriod]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">結束日期</p>
                  <p className="font-medium">
                    {formatDate(request.endDate)} {periodLabels[request.endPeriod]}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 請假事由 */}
          {request.reason && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  請假事由
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{request.reason}</p>
              </CardContent>
            </Card>
          )}

          {/* 處理紀錄 */}
          <Card>
            <CardHeader>
              <CardTitle>處理紀錄</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium">申請建立</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                </div>
                {request.submittedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-yellow-500" />
                    <div>
                      <p className="font-medium">送出審核</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(request.submittedAt)}
                      </p>
                    </div>
                  </div>
                )}
                {request.processedAt && (
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-2 h-2 mt-2 rounded-full ${
                        request.status === 'REJECTED' ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    />
                    <div>
                      <p className="font-medium">
                        {request.status === 'REJECTED' ? '已駁回' : '已核准'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(request.processedAt)} by{' '}
                        {request.approvedBy?.name || request.rejectedBy?.name}
                      </p>
                      {request.approvalComment && (
                        <p className="text-sm mt-1">{request.approvalComment}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 側邊欄 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                申請人資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">申請人</span>
                <span className="font-medium">{request.employee.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">員工編號</span>
                <span>{request.employee.employeeNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-sm">{request.employee.email}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                公司資訊
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{request.company.name}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                時間資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">建立時間</span>
                <span>{formatDateTime(request.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">更新時間</span>
                <span>{formatDateTime(request.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* 簽核狀態 */}
          <WorkflowStatus
            requestType="LEAVE"
            requestId={request.id}
          />
        </div>
      </div>

      {/* 取消對話框 */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消申請</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            確定要取消此請假申請嗎？此操作無法復原。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              返回
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancel.mutate({ id: request.id })}
            >
              確定取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/dashboard/leave/[id]/
git commit -m "feat: add leave request detail page with WorkflowStatus"
```

---

## Task 3: 更新請假列表，加入查看按鈕

**Files:**
- Modify: `src/app/dashboard/leave/page.tsx`

**Step 1: 引入 Link 和 Eye icon**

```typescript
import Link from 'next/link'
import { FileText, Eye } from 'lucide-react'
```

**Step 2: 在表格新增操作欄位**

在 `<thead>` 加入操作欄：
```typescript
<th className="text-left py-3 px-2 font-medium">操作</th>
```

在 `<tbody>` 每行加入查看按鈕：
```typescript
<td className="py-3 px-2">
  <Link href={`/dashboard/leave/${req.id}`}>
    <Button variant="ghost" size="sm">
      <Eye className="h-4 w-4" />
    </Button>
  </Link>
</td>
```

**Step 3: Commit**

```bash
git add src/app/dashboard/leave/page.tsx
git commit -m "feat: add view button to leave request list"
```

---

## Task 4: 最終驗證

**Step 1: 執行 TypeScript 類型檢查**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: 無錯誤

**Step 2: 執行建置**

Run: `npm run build`

Expected: 建置成功

**Step 3: 功能驗證清單**

- [ ] 請假申請送出時啟動工作流程
- [ ] 請假申請詳情頁顯示正確資訊
- [ ] 請假申請詳情頁顯示 WorkflowStatus
- [ ] 請假列表有查看按鈕可進入詳情頁

**Step 4: Commit 總結**

```bash
git add .
git commit -m "feat(workflow): 實作 Phase 7 - 請假申請工作流程整合

- 請假表單整合工作流程引擎
- 建立請假詳情頁面
- 詳情頁加入 WorkflowStatus 元件
- 請假列表加入查看按鈕
- 保留傳統審批作為 fallback"
```

---

## Summary

Phase 7 完成後，您將擁有：

| 功能 | 狀態 |
|------|------|
| 請假申請工作流程整合 | ✅ |
| 請假詳情頁面 | ✅ |
| 請假詳情頁 WorkflowStatus | ✅ |
| 請假列表查看按鈕 | ✅ |

下一階段可考慮實作：
- 審核中心整合所有申請類型
- 流程統計報表
- 職務代理設定
