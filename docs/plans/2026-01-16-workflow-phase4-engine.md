# Phase 4: 流程執行引擎 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立流程執行引擎，支援流程實例啟動、節點推進、簽核處理，並整合費用報銷功能

**Architecture:** 流程引擎核心放在 `src/lib/workflow-engine.ts`，提供 startWorkflow、getNextNodes、processApproval 等函數。tRPC router 擴展支援流程操作。費用報銷表單整合送簽流程。

**Tech Stack:** Prisma, tRPC, Next.js Server Actions

---

## Task 1: 建立流程執行引擎核心

**Files:**
- Create: `src/lib/workflow-engine.ts`

**Step 1: 建立流程引擎檔案**

```typescript
import { prisma } from './prisma'
import { TRPCError } from '@trpc/server'

// 類型定義
export interface StartWorkflowInput {
  definitionId: string
  requestType: string
  requestId: string
  applicantId: string
  companyId: string
  requestData?: Record<string, unknown> // 用於條件判斷的資料
}

export interface ProcessApprovalInput {
  instanceId: string
  recordId: string
  action: 'APPROVE' | 'REJECT' | 'RETURN'
  comment?: string
  signerId: string // 實際簽核人（可能是代理人）
}

// 取得適用的流程定義
export async function getApplicableDefinition(
  employeeId: string,
  companyId: string,
  requestType: string
) {
  const now = new Date()

  // 優先權 1：員工特殊路徑
  const employeeWorkflow = await prisma.workflowDefinition.findFirst({
    where: {
      scopeType: 'EMPLOYEE',
      employeeId,
      isActive: true,
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }],
    },
    include: { nodes: true, edges: true },
  })

  if (employeeWorkflow) return employeeWorkflow

  // 優先權 2：申請類型流程
  const typeWorkflow = await prisma.workflowDefinition.findFirst({
    where: {
      scopeType: 'REQUEST_TYPE',
      requestType,
      companyId,
      isActive: true,
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }],
    },
    include: { nodes: true, edges: true },
  })

  if (typeWorkflow) return typeWorkflow

  // 優先權 3：預設流程
  const defaultWorkflow = await prisma.workflowDefinition.findFirst({
    where: {
      scopeType: 'DEFAULT',
      companyId,
      isActive: true,
    },
    include: { nodes: true, edges: true },
  })

  return defaultWorkflow
}

// 啟動流程實例
export async function startWorkflow(input: StartWorkflowInput) {
  const { definitionId, requestType, requestId, applicantId, companyId, requestData } = input

  // 取得流程定義
  const definition = await prisma.workflowDefinition.findUnique({
    where: { id: definitionId },
    include: { nodes: true, edges: true },
  })

  if (!definition) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '找不到流程定義' })
  }

  // 找到開始節點
  const startNode = definition.nodes.find(n => n.nodeType === 'START')
  if (!startNode) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '流程缺少開始節點' })
  }

  // 建立流程實例
  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId,
      requestType,
      requestId,
      applicantId,
      companyId,
      status: 'PENDING',
      currentNodeId: startNode.id,
      submittedAt: new Date(),
    },
  })

  // 推進到下一個節點
  await advanceWorkflow(instance.id, startNode.id, requestData)

  return instance
}

// 推進流程
export async function advanceWorkflow(
  instanceId: string,
  fromNodeId: string,
  requestData?: Record<string, unknown>
) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: {
      definition: { include: { nodes: true, edges: true } },
      applicant: {
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
            include: {
              department: true,
              position: true,
              supervisor: true,
            },
          },
        },
      },
    },
  })

  if (!instance) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '找不到流程實例' })
  }

  const { nodes, edges } = instance.definition

  // 找到從當前節點出發的邊
  const outgoingEdges = edges
    .filter(e => e.fromNodeId === fromNodeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (outgoingEdges.length === 0) {
    return // 沒有後續節點
  }

  // 決定下一個節點
  let nextEdge = outgoingEdges.find(e => e.isDefault)

  // 如果有條件邊，評估條件
  for (const edge of outgoingEdges) {
    if (edge.conditionField && edge.conditionOperator && requestData) {
      const value = requestData[edge.conditionField]
      if (evaluateCondition(value, edge.conditionOperator, edge.conditionValue)) {
        nextEdge = edge
        break
      }
    }
  }

  if (!nextEdge) {
    nextEdge = outgoingEdges[0]
  }

  const nextNode = nodes.find(n => n.id === nextEdge!.toNodeId)
  if (!nextNode) return

  // 更新當前節點
  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: { currentNodeId: nextNode.id },
  })

  // 根據節點類型處理
  switch (nextNode.nodeType) {
    case 'APPROVAL':
      await createApprovalRecord(instance, nextNode)
      break
    case 'END':
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: 'APPROVED', completedAt: new Date() },
      })
      break
    case 'CONDITION':
      // 條件節點直接推進
      await advanceWorkflow(instanceId, nextNode.id, requestData)
      break
    case 'PARALLEL_START':
      await handleParallelStart(instance, nextNode)
      break
    default:
      break
  }
}

// 建立簽核紀錄
async function createApprovalRecord(
  instance: Awaited<ReturnType<typeof prisma.workflowInstance.findUnique>> & {
    applicant: { assignments: Array<{ supervisor?: { id: string } | null; department?: { id: string } | null }> }
  },
  node: { id: string; approverType: string | null; approverId: string | null; orgRelation: string | null; orgLevelUp: number | null; customFieldName: string | null }
) {
  if (!instance) return

  let approverId: string | null = null

  switch (node.approverType) {
    case 'SPECIFIC_EMPLOYEE':
      approverId = node.approverId
      break
    case 'ORG_RELATION':
      // 從組織關係找簽核人
      const primaryAssignment = instance.applicant.assignments.find(a => a.supervisor)
      if (node.orgRelation === 'DIRECT_SUPERVISOR' && primaryAssignment?.supervisor) {
        approverId = primaryAssignment.supervisor.id
      }
      // TODO: 處理其他組織關係
      break
    case 'DEPARTMENT_HEAD':
      // TODO: 找部門主管
      break
    default:
      break
  }

  if (approverId) {
    await prisma.workflowApprovalRecord.create({
      data: {
        instanceId: instance.id,
        nodeId: node.id,
        approverId,
        status: 'PENDING',
      },
    })

    // 更新實例狀態
    await prisma.workflowInstance.update({
      where: { id: instance.id },
      data: { status: 'IN_PROGRESS' },
    })
  }
}

// 處理並行開始
async function handleParallelStart(
  instance: NonNullable<Awaited<ReturnType<typeof prisma.workflowInstance.findUnique>>>,
  node: { id: string }
) {
  // TODO: 實作並行分支
  console.log('Parallel start:', instance.id, node.id)
}

// 評估條件
function evaluateCondition(
  value: unknown,
  operator: string,
  conditionValue: string | null
): boolean {
  if (conditionValue === null) return false

  switch (operator) {
    case 'EQUALS':
      return String(value) === conditionValue
    case 'NOT_EQUALS':
      return String(value) !== conditionValue
    case 'GREATER_THAN':
      return Number(value) > Number(conditionValue)
    case 'LESS_THAN':
      return Number(value) < Number(conditionValue)
    case 'GREATER_OR_EQUAL':
      return Number(value) >= Number(conditionValue)
    case 'LESS_OR_EQUAL':
      return Number(value) <= Number(conditionValue)
    case 'CONTAINS':
      return String(value).includes(conditionValue)
    case 'IN':
      return conditionValue.split(',').map(s => s.trim()).includes(String(value))
    case 'NOT_IN':
      return !conditionValue.split(',').map(s => s.trim()).includes(String(value))
    default:
      return false
  }
}

// 處理簽核
export async function processApproval(input: ProcessApprovalInput) {
  const { instanceId, recordId, action, comment, signerId } = input

  const record = await prisma.workflowApprovalRecord.findUnique({
    where: { id: recordId },
    include: {
      instance: {
        include: {
          definition: { include: { nodes: true, edges: true } },
        },
      },
    },
  })

  if (!record) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '找不到簽核紀錄' })
  }

  if (record.status !== 'PENDING') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '此簽核紀錄已處理' })
  }

  // 更新簽核紀錄
  await prisma.workflowApprovalRecord.update({
    where: { id: recordId },
    data: {
      status: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'PENDING',
      action: action as 'APPROVE' | 'REJECT' | 'RETURN',
      actualSignerId: signerId,
      comment,
      actionAt: new Date(),
    },
  })

  if (action === 'APPROVE') {
    // 推進到下一個節點
    await advanceWorkflow(instanceId, record.nodeId)
  } else if (action === 'REJECT') {
    // 拒絕流程
    await prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: 'REJECTED', completedAt: new Date() },
    })
  }

  return { success: true }
}

// 取得待簽核項目
export async function getPendingApprovals(approverId: string) {
  return prisma.workflowApprovalRecord.findMany({
    where: {
      approverId,
      status: 'PENDING',
    },
    include: {
      instance: {
        include: {
          applicant: { select: { id: true, name: true, employeeNo: true } },
          company: { select: { id: true, name: true } },
          definition: { select: { id: true, name: true, requestType: true } },
        },
      },
      node: { select: { id: true, name: true, nodeType: true } },
    },
    orderBy: { assignedAt: 'asc' },
  })
}
```

**Step 2: Commit**

```bash
git add src/lib/workflow-engine.ts
git commit -m "feat: add workflow execution engine core"
```

---

## Task 2: 擴展 tRPC Workflow Router 支援流程操作

**Files:**
- Modify: `src/server/routers/workflow.ts`

**Step 1: 新增流程操作 procedures**

在 `workflowRouter` 中新增以下 procedures：

```typescript
// 在檔案開頭 import
import {
  startWorkflow,
  processApproval,
  getPendingApprovals,
  getApplicableDefinition,
} from '@/lib/workflow-engine'

// 在 router 內新增以下 procedures:

  // 啟動流程實例
  startInstance: publicProcedure
    .input(z.object({
      definitionId: z.string().optional(),
      requestType: z.string(),
      requestId: z.string(),
      applicantId: z.string(),
      companyId: z.string(),
      requestData: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      let definitionId = input.definitionId

      // 如果沒有指定定義，自動尋找適用的流程
      if (!definitionId) {
        const definition = await getApplicableDefinition(
          input.applicantId,
          input.companyId,
          input.requestType
        )
        if (!definition) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '找不到適用的流程定義' })
        }
        definitionId = definition.id
      }

      return startWorkflow({
        definitionId,
        requestType: input.requestType,
        requestId: input.requestId,
        applicantId: input.applicantId,
        companyId: input.companyId,
        requestData: input.requestData,
      })
    }),

  // 處理簽核
  processApproval: publicProcedure
    .input(z.object({
      instanceId: z.string(),
      recordId: z.string(),
      action: z.enum(['APPROVE', 'REJECT', 'RETURN']),
      comment: z.string().optional(),
      signerId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return processApproval(input)
    }),

  // 取得待簽核項目
  getPendingApprovals: publicProcedure
    .input(z.object({
      approverId: z.string(),
    }))
    .query(async ({ input }) => {
      return getPendingApprovals(input.approverId)
    }),

  // 取得流程實例詳情
  getInstance: publicProcedure
    .input(z.object({
      instanceId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workflowInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          definition: { select: { id: true, name: true } },
          applicant: { select: { id: true, name: true, employeeNo: true } },
          company: { select: { id: true, name: true } },
          approvalRecords: {
            include: {
              node: { select: { id: true, name: true, nodeType: true } },
              approver: { select: { id: true, name: true, employeeNo: true } },
              actualSigner: { select: { id: true, name: true, employeeNo: true } },
            },
            orderBy: { assignedAt: 'asc' },
          },
        },
      })
    }),

  // 取得申請單的流程狀態
  getInstanceByRequest: publicProcedure
    .input(z.object({
      requestType: z.string(),
      requestId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workflowInstance.findUnique({
        where: {
          requestType_requestId: {
            requestType: input.requestType,
            requestId: input.requestId,
          },
        },
        include: {
          definition: { select: { id: true, name: true } },
          approvalRecords: {
            include: {
              node: { select: { id: true, name: true, nodeType: true } },
              approver: { select: { id: true, name: true } },
              actualSigner: { select: { id: true, name: true } },
            },
            orderBy: { assignedAt: 'asc' },
          },
        },
      })
    }),
```

**Step 2: Commit**

```bash
git add src/server/routers/workflow.ts
git commit -m "feat: add workflow instance operations to tRPC router"
```

---

## Task 3: 建立待簽核列表頁面

**Files:**
- Create: `src/app/dashboard/approval/page.tsx`
- Create: `src/app/dashboard/approval/approval-list.tsx`

**Step 1: 建立頁面路由**

```typescript
// src/app/dashboard/approval/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { ApprovalList } from './approval-list'

export default async function ApprovalPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)

  return (
    <ApprovalList
      userId={session.user.id}
      companyId={currentCompany?.id || null}
      companyName={currentCompany?.name || ''}
    />
  )
}
```

**Step 2: 建立待簽核列表元件**

```typescript
// src/app/dashboard/approval/approval-list.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/lib/trpc'
import { CheckCircle, XCircle, Clock, FileText, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface ApprovalListProps {
  userId: string
  companyId: string | null
  companyName: string
}

const requestTypeLabels: Record<string, string> = {
  EXPENSE: '費用報銷',
  LEAVE: '請假申請',
  SEAL: '用印申請',
  BUSINESS_CARD: '名片申請',
  STATIONERY: '文具領用',
}

export function ApprovalList({ userId, companyName }: ApprovalListProps) {
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null)

  const { data: pendingApprovals, isLoading, refetch } = trpc.workflow.getPendingApprovals.useQuery({
    approverId: userId,
  })

  const processApproval = trpc.workflow.processApproval.useMutation({
    onSuccess: () => {
      setSelectedRecord(null)
      setComment('')
      setActionType(null)
      refetch()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleAction = (recordId: string, action: 'APPROVE' | 'REJECT') => {
    setSelectedRecord(recordId)
    setActionType(action)
  }

  const confirmAction = () => {
    if (!selectedRecord || !actionType) return

    const record = pendingApprovals?.find(r => r.id === selectedRecord)
    if (!record) return

    processApproval.mutate({
      instanceId: record.instanceId,
      recordId: selectedRecord,
      action: actionType,
      comment: comment || undefined,
      signerId: userId,
    })
  }

  if (isLoading) {
    return <div className="p-6">載入中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">審核中心</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Clock className="h-4 w-4 mr-2" />
          待審核 {pendingApprovals?.length || 0} 件
        </Badge>
      </div>

      {!pendingApprovals || pendingApprovals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-muted-foreground">目前沒有待審核的項目</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map((record) => (
            <Card key={record.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {requestTypeLabels[record.instance.requestType] || record.instance.requestType}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {record.instance.definition.name}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {record.node.name || '審批'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>申請人：{record.instance.applicant.name}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {formatDistanceToNow(new Date(record.assignedAt), {
                      addSuffix: true,
                      locale: zhTW,
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleAction(record.id, 'APPROVE')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    核准
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleAction(record.id, 'REJECT')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    駁回
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 確認對話框 */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'APPROVE' ? '確認核准' : '確認駁回'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">簽核意見（選填）</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="輸入簽核意見..."
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRecord(null)}>
              取消
            </Button>
            <Button
              variant={actionType === 'REJECT' ? 'destructive' : 'default'}
              onClick={confirmAction}
              disabled={processApproval.isPending}
            >
              {processApproval.isPending ? '處理中...' : '確認'}
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
git add src/app/dashboard/approval/page.tsx src/app/dashboard/approval/approval-list.tsx
git commit -m "feat: add approval center page with pending approvals list"
```

---

## Task 4: 整合費用報銷送簽流程

**Files:**
- Modify: `src/app/dashboard/expense/new/expense-form.tsx`

**Step 1: 修改費用報銷表單，新增送簽邏輯**

在 expense-form.tsx 中修改 submitMutation 的邏輯：

找到 `submitMutation` 相關程式碼，修改為：

```typescript
// 在 trpc mutations 區域新增
const startWorkflow = trpc.workflow.startInstance.useMutation()

// 修改 handleSubmit 函數
const handleSubmit = async () => {
  setIsLoading(true)
  setError(null)

  try {
    // 驗證
    if (!formData.title.trim()) {
      throw new Error('請輸入報銷標題')
    }
    if (items.some(item => !item.categoryId || !item.amount)) {
      throw new Error('請完整填寫所有費用明細')
    }

    // 1. 建立報銷單
    const expense = await createMutation.mutateAsync({
      employeeId,
      companyId,
      title: formData.title,
      description: formData.description || undefined,
      periodStart: formData.periodStart ? new Date(formData.periodStart) : undefined,
      periodEnd: formData.periodEnd ? new Date(formData.periodEnd) : undefined,
      items: items.map(item => ({
        categoryId: item.categoryId,
        expenseDate: new Date(item.date),
        description: item.description || undefined,
        amount: parseFloat(item.amount),
        vendorName: item.vendorName || undefined,
        receiptNo: item.receiptNo || undefined,
      })),
    })

    // 2. 啟動簽核流程
    await startWorkflow.mutateAsync({
      requestType: 'EXPENSE',
      requestId: expense.id,
      applicantId: employeeId,
      companyId,
      requestData: {
        AMOUNT: totalAmount,
        REQUEST_TYPE: 'EXPENSE',
      },
    })

    router.push('/dashboard/expense')
  } catch (err) {
    setError(err instanceof Error ? err.message : '提交失敗')
  } finally {
    setIsLoading(false)
  }
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/expense/new/expense-form.tsx
git commit -m "feat: integrate expense form with workflow engine"
```

---

## Task 5: 建立流程狀態顯示元件

**Files:**
- Create: `src/components/workflow/workflow-status.tsx`

**Step 1: 建立流程狀態元件**

```typescript
'use client'

import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Clock, Circle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkflowStatusProps {
  requestType: string
  requestId: string
}

const statusConfig = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Circle },
  PENDING: { label: '待處理', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  IN_PROGRESS: { label: '簽核中', color: 'bg-blue-100 text-blue-700', icon: Clock },
  APPROVED: { label: '已核准', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '已駁回', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-700', icon: XCircle },
  WITHDRAWN: { label: '已撤回', color: 'bg-gray-100 text-gray-700', icon: XCircle },
}

const approvalStatusConfig = {
  WAITING: { label: '等待中', color: 'text-gray-400' },
  PENDING: { label: '待簽核', color: 'text-yellow-500' },
  APPROVED: { label: '已核准', color: 'text-green-500' },
  REJECTED: { label: '已駁回', color: 'text-red-500' },
  SKIPPED: { label: '已跳過', color: 'text-gray-400' },
}

export function WorkflowStatus({ requestType, requestId }: WorkflowStatusProps) {
  const { data: instance, isLoading } = trpc.workflow.getInstanceByRequest.useQuery({
    requestType,
    requestId,
  })

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">載入中...</div>
  }

  if (!instance) {
    return (
      <Badge variant="secondary">
        <Circle className="h-3 w-3 mr-1" />
        未送簽
      </Badge>
    )
  }

  const config = statusConfig[instance.status]
  const StatusIcon = config.icon

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">簽核狀態</CardTitle>
          <Badge className={config.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {instance.approvalRecords.map((record, index) => {
            const recordConfig = approvalStatusConfig[record.status]
            return (
              <div key={record.id} className="flex items-center gap-3">
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', recordConfig.color)}>
                  {record.status === 'APPROVED' && <CheckCircle className="h-4 w-4" />}
                  {record.status === 'REJECTED' && <XCircle className="h-4 w-4" />}
                  {record.status === 'PENDING' && <Clock className="h-4 w-4" />}
                  {record.status === 'WAITING' && <Circle className="h-4 w-4" />}
                  {record.status === 'SKIPPED' && <ArrowRight className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{record.node.name || '審批'}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.approver.name}
                    {record.actualSigner && record.actualSigner.id !== record.approver.id && (
                      <span> (由 {record.actualSigner.name} 代簽)</span>
                    )}
                  </p>
                </div>
                <Badge variant="outline" className={recordConfig.color}>
                  {recordConfig.label}
                </Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/workflow/workflow-status.tsx
git commit -m "feat: add workflow status display component"
```

---

## Task 6: 建立員工特殊路徑設定頁面

**Files:**
- Create: `src/app/dashboard/workflow/employee-paths/page.tsx`
- Create: `src/app/dashboard/workflow/employee-paths/employee-path-list.tsx`

**Step 1: 建立頁面路由**

```typescript
// src/app/dashboard/workflow/employee-paths/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { EmployeePathList } from './employee-path-list'

export default async function EmployeePathsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">員工特殊路徑</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  // 取得員工特殊路徑列表
  const employeePaths = await prisma.workflowDefinition.findMany({
    where: {
      scopeType: 'EMPLOYEE',
      companyId: currentCompany.id,
    },
    include: {
      employee: { select: { id: true, name: true, employeeNo: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { nodes: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // 取得員工列表（用於選擇）
  const employees = await prisma.employee.findMany({
    where: {
      assignments: {
        some: {
          companyId: currentCompany.id,
          status: 'ACTIVE',
        },
      },
    },
    select: { id: true, name: true, employeeNo: true },
    orderBy: { name: 'asc' },
  })

  return (
    <EmployeePathList
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      userId={session.user.id}
      employeePaths={employeePaths}
      employees={employees}
    />
  )
}
```

**Step 2: 建立列表元件**

```typescript
// src/app/dashboard/workflow/employee-paths/employee-path-list.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Plus, Pencil, Trash2, GitBranch, Calendar } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format } from 'date-fns'

interface EmployeePath {
  id: string
  name: string
  description: string | null
  isActive: boolean
  effectiveFrom: Date | null
  effectiveTo: Date | null
  employee: { id: string; name: string; employeeNo: string } | null
  createdBy: { id: string; name: string } | null
  _count: { nodes: number }
}

interface Employee {
  id: string
  name: string
  employeeNo: string
}

interface EmployeePathListProps {
  companyId: string
  companyName: string
  userId: string
  employeePaths: EmployeePath[]
  employees: Employee[]
}

export function EmployeePathList({
  companyId,
  companyName,
  userId,
  employeePaths,
  employees,
}: EmployeePathListProps) {
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createData, setCreateData] = useState({
    name: '',
    description: '',
    employeeId: '',
    effectiveFrom: '',
    effectiveTo: '',
  })

  const createWorkflow = trpc.workflow.create.useMutation({
    onSuccess: (data) => {
      setIsCreateOpen(false)
      setCreateData({ name: '', description: '', employeeId: '', effectiveFrom: '', effectiveTo: '' })
      router.push(`/dashboard/workflow/editor/${data.id}`)
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const deleteWorkflow = trpc.workflow.delete.useMutation({
    onSuccess: () => {
      router.refresh()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleCreate = () => {
    if (!createData.name.trim()) {
      alert('請輸入流程名稱')
      return
    }
    if (!createData.employeeId) {
      alert('請選擇員工')
      return
    }

    createWorkflow.mutate({
      name: createData.name,
      description: createData.description || undefined,
      scopeType: 'EMPLOYEE',
      companyId,
      employeeId: createData.employeeId,
      effectiveFrom: createData.effectiveFrom ? new Date(createData.effectiveFrom) : undefined,
      effectiveTo: createData.effectiveTo ? new Date(createData.effectiveTo) : undefined,
      createdById: userId,
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`確定要刪除「${name}」嗎？`)) {
      deleteWorkflow.mutate({ id })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">員工特殊路徑</h1>
          <p className="text-muted-foreground">{companyName} - 為特定員工設定專屬簽核路徑</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增特殊路徑
        </Button>
      </div>

      {employeePaths.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">尚無員工特殊路徑</p>
            <p className="text-sm text-muted-foreground mt-1">
              特殊路徑可為特定員工設定不同的簽核流程，優先權最高
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {employeePaths.map((path) => (
            <Card key={path.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-purple-500" />
                    <CardTitle className="text-lg">{path.name}</CardTitle>
                  </div>
                  {path.isActive ? (
                    <Badge variant="default">啟用</Badge>
                  ) : (
                    <Badge variant="secondary">停用</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {path.employee && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{path.employee.name} ({path.employee.employeeNo})</span>
                  </div>
                )}
                {(path.effectiveFrom || path.effectiveTo) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {path.effectiveFrom ? format(new Date(path.effectiveFrom), 'yyyy/MM/dd') : '無限期'}
                      {' - '}
                      {path.effectiveTo ? format(new Date(path.effectiveTo), 'yyyy/MM/dd') : '無限期'}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                  <span>{path._count.nodes} 節點</span>
                </div>
                <div className="flex gap-1 pt-2">
                  <Link href={`/dashboard/workflow/editor/${path.id}`} className="flex-1">
                    <Button size="sm" className="w-full">
                      <Pencil className="h-4 w-4 mr-1" />
                      編輯
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(path.id, path.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 新增對話框 */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增員工特殊路徑</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>選擇員工 *</Label>
              <Select
                value={createData.employeeId}
                onValueChange={(value) => setCreateData({ ...createData, employeeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇員工" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="path-name">名稱 *</Label>
              <Input
                id="path-name"
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                placeholder="例：王小明專屬審批路徑"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="path-desc">說明</Label>
              <Input
                id="path-desc"
                value={createData.description}
                onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                placeholder="選填"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effective-from">生效日期</Label>
                <Input
                  id="effective-from"
                  type="date"
                  value={createData.effectiveFrom}
                  onChange={(e) => setCreateData({ ...createData, effectiveFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="effective-to">失效日期</Label>
                <Input
                  id="effective-to"
                  type="date"
                  value={createData.effectiveTo}
                  onChange={(e) => setCreateData({ ...createData, effectiveTo: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createWorkflow.isPending}>
                {createWorkflow.isPending ? '建立中...' : '建立並編輯'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add "src/app/dashboard/workflow/employee-paths/page.tsx" "src/app/dashboard/workflow/employee-paths/employee-path-list.tsx"
git commit -m "feat: add employee special workflow paths management page"
```

---

## Task 7: 新增 Textarea UI 元件

**Files:**
- Create: `src/components/ui/textarea.tsx`

**Step 1: 建立 Textarea 元件**

```typescript
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
```

**Step 2: Commit**

```bash
git add src/components/ui/textarea.tsx
git commit -m "feat: add textarea UI component"
```

---

## Task 8: 最終驗證

**Step 1: 執行 TypeScript 類型檢查**

Run: `npx tsc --noEmit`

Expected: 無錯誤

**Step 2: 執行開發伺服器**

Run: `npm run dev`

Expected: 伺服器正常啟動

**Step 3: Commit 總結**

```bash
git add .
git commit -m "feat: complete Phase 4 - workflow execution engine

- Create workflow engine core with start/advance/process functions
- Add workflow instance operations to tRPC router
- Build approval center with pending approvals list
- Integrate expense form with workflow engine
- Add workflow status display component
- Create employee special paths management page
- Add textarea UI component"
```

---

## Summary

Phase 4 完成後，您將擁有：

| 功能 | 狀態 |
|------|------|
| 流程執行引擎核心 | ✅ |
| 流程啟動/推進/簽核處理 | ✅ |
| 條件判斷評估 | ✅ |
| 待簽核列表頁面 | ✅ |
| 費用報銷送簽整合 | ✅ |
| 流程狀態顯示元件 | ✅ |
| 員工特殊路徑管理 | ✅ |

下一階段（Phase 5）將實作：
- 代理人設定
- 加簽/轉簽功能
- 並行簽核完整處理
- 簽核歷程查詢
