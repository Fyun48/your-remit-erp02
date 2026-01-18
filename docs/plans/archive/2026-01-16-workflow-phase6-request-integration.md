# Phase 6: 其他申請單工作流程整合 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 整合用印、名片、文具申請的工作流程，使其使用統一的流程引擎

**Architecture:** 在各申請表單送出時啟動工作流程，詳情頁面加入 WorkflowStatus 元件顯示簽核狀態

**Tech Stack:** Prisma, tRPC, Next.js, React

---

## Task 1: 用印申請 - 表單整合工作流程

**Files:**
- Modify: `src/app/dashboard/admin/seal/new/seal-request-form.tsx`

**Step 1: 引入 workflow mutation**

在 imports 區塊後，tRPC hooks 區塊加入：
```typescript
const startWorkflow = trpc.workflow.startInstance.useMutation()
```

**Step 2: 修改 handleSubmit 函數**

將原本的 submit 改為先 create 再啟動 workflow：

```typescript
const handleSubmit = async () => {
  if (!validate()) return

  setIsSubmitting(true)

  create.mutate(
    {
      companyId,
      applicantId,
      sealType: formData.sealType as 'COMPANY_SEAL' | 'COMPANY_SMALL_SEAL' | 'CONTRACT_SEAL' | 'INVOICE_SEAL' | 'BOARD_SEAL' | 'BANK_SEAL',
      purpose: formData.purpose,
      documentName: formData.documentName || undefined,
      documentCount: formData.documentCount,
      isCarryOut: formData.isCarryOut,
      expectedReturn: formData.expectedReturn ? new Date(formData.expectedReturn) : undefined,
    },
    {
      onSuccess: async (data) => {
        // 嘗試啟動工作流程
        try {
          await startWorkflow.mutateAsync({
            requestType: 'SEAL',
            requestId: data.id,
            applicantId,
            companyId,
            requestData: {
              sealType: formData.sealType,
              documentCount: formData.documentCount,
              isCarryOut: formData.isCarryOut,
            },
          })
          router.push('/dashboard/admin/seal')
        } catch {
          // 無工作流程定義，使用傳統審批
          submit.mutate({ id: data.id })
        }
      },
    }
  )
}
```

**Step 3: Commit**

```bash
git add src/app/dashboard/admin/seal/new/seal-request-form.tsx
git commit -m "feat: integrate workflow engine for seal request form"
```

---

## Task 2: 用印申請 - 詳情頁加入 WorkflowStatus

**Files:**
- Modify: `src/app/dashboard/admin/seal/[id]/seal-request-detail.tsx`

**Step 1: 引入 WorkflowStatus**

```typescript
import { WorkflowStatus } from '@/components/workflow/workflow-status'
```

**Step 2: 在側邊欄加入 WorkflowStatus 元件**

在「時間資訊」Card 之後加入：

```typescript
          {/* 簽核狀態 */}
          <WorkflowStatus
            requestType="SEAL"
            requestId={request.id}
          />
```

**Step 3: Commit**

```bash
git add src/app/dashboard/admin/seal/[id]/seal-request-detail.tsx
git commit -m "feat: add WorkflowStatus to seal request detail page"
```

---

## Task 3: 名片申請 - 表單整合工作流程

**Files:**
- Modify: `src/app/dashboard/admin/card/new/card-request-form.tsx`

**Step 1: 引入 workflow mutation**

```typescript
const startWorkflow = trpc.workflow.startInstance.useMutation()
```

**Step 2: 修改 handleSubmit 函數**

與用印申請類似，先 create 再啟動 workflow：

```typescript
// 在 onSuccess 回調中
try {
  await startWorkflow.mutateAsync({
    requestType: 'CARD',
    requestId: data.id,
    applicantId,
    companyId,
    requestData: {
      quantity: formData.quantity,
      // 其他相關欄位
    },
  })
  router.push('/dashboard/admin/card')
} catch {
  // 無工作流程定義，使用傳統審批
  submit.mutate({ id: data.id })
}
```

**Step 3: Commit**

```bash
git add src/app/dashboard/admin/card/new/card-request-form.tsx
git commit -m "feat: integrate workflow engine for card request form"
```

---

## Task 4: 名片申請 - 詳情頁加入 WorkflowStatus

**Files:**
- Modify: `src/app/dashboard/admin/card/[id]/card-request-detail.tsx`

**Step 1: 引入 WorkflowStatus**

```typescript
import { WorkflowStatus } from '@/components/workflow/workflow-status'
```

**Step 2: 在側邊欄加入 WorkflowStatus 元件**

```typescript
          {/* 簽核狀態 */}
          <WorkflowStatus
            requestType="CARD"
            requestId={request.id}
          />
```

**Step 3: Commit**

```bash
git add src/app/dashboard/admin/card/[id]/card-request-detail.tsx
git commit -m "feat: add WorkflowStatus to card request detail page"
```

---

## Task 5: 文具申請 - 表單整合工作流程

**Files:**
- Modify: `src/app/dashboard/admin/stationery/new/stationery-request-form.tsx`

**Step 1: 引入 workflow mutation**

```typescript
const startWorkflow = trpc.workflow.startInstance.useMutation()
```

**Step 2: 修改 handleSubmit 函數**

```typescript
// 在 onSuccess 回調中
try {
  await startWorkflow.mutateAsync({
    requestType: 'STATIONERY',
    requestId: data.id,
    applicantId,
    companyId,
    requestData: {
      totalAmount: calculateTotalAmount(),
      itemCount: items.length,
    },
  })
  router.push('/dashboard/admin/stationery')
} catch {
  // 無工作流程定義，使用傳統審批
  submit.mutate({ id: data.id })
}
```

**Step 3: Commit**

```bash
git add src/app/dashboard/admin/stationery/new/stationery-request-form.tsx
git commit -m "feat: integrate workflow engine for stationery request form"
```

---

## Task 6: 文具申請 - 詳情頁加入 WorkflowStatus

**Files:**
- Modify: `src/app/dashboard/admin/stationery/[id]/stationery-request-detail.tsx`

**Step 1: 引入 WorkflowStatus**

```typescript
import { WorkflowStatus } from '@/components/workflow/workflow-status'
```

**Step 2: 在側邊欄加入 WorkflowStatus 元件**

```typescript
          {/* 簽核狀態 */}
          <WorkflowStatus
            requestType="STATIONERY"
            requestId={request.id}
          />
```

**Step 3: Commit**

```bash
git add src/app/dashboard/admin/stationery/[id]/stationery-request-detail.tsx
git commit -m "feat: add WorkflowStatus to stationery request detail page"
```

---

## Task 7: 最終驗證

**Step 1: 執行 TypeScript 類型檢查**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: 無錯誤

**Step 2: 執行建置**

Run: `npm run build`

Expected: 建置成功

**Step 3: 功能驗證清單**

- [ ] 用印申請送出時啟動工作流程
- [ ] 用印申請詳情顯示 WorkflowStatus
- [ ] 名片申請送出時啟動工作流程
- [ ] 名片申請詳情顯示 WorkflowStatus
- [ ] 文具申請送出時啟動工作流程
- [ ] 文具申請詳情顯示 WorkflowStatus

**Step 4: Commit 總結**

```bash
git add .
git commit -m "feat(workflow): 實作 Phase 6 - 其他申請單工作流程整合

- 用印申請整合工作流程引擎
- 名片申請整合工作流程引擎
- 文具申請整合工作流程引擎
- 各詳情頁加入 WorkflowStatus 元件
- 保留傳統審批作為 fallback"
```

---

## Summary

Phase 6 完成後，您將擁有：

| 功能 | 狀態 |
|------|------|
| 用印申請工作流程整合 | ✅ |
| 用印申請 WorkflowStatus | ✅ |
| 名片申請工作流程整合 | ✅ |
| 名片申請 WorkflowStatus | ✅ |
| 文具申請工作流程整合 | ✅ |
| 文具申請 WorkflowStatus | ✅ |

下一階段可考慮實作：
- 請假申請工作流程整合
- 審核中心整合所有申請類型
- 流程統計報表
