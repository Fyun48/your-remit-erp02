# 流程管理與職務代理系統重新設計

> 建立日期：2026-01-20
> 狀態：已確認，開始實作

## 概述

重新設計流程管理系統，包含審核流程編輯器、職務代理功能，以及選單結構重整。

## 設計決策

| 項目 | 決策 |
|------|------|
| 流程適用範圍 | 所有審核類申請（請假、費用核銷、用印、名片等） |
| 流程設定層級 | 依公司 + 申請類型 |
| 審核人指定方式 | 混合模式（直屬主管 / 職位 / 指定人員） |
| 流程編輯介面 | 混合介面（左側清單編輯 + 右側流程圖預覽） |
| 審核層級上限 | 最多 4 層（不含申請人） |
| 職務代理權限 | 可配置式（選擇要代理哪些功能） |
| 代理接受機制 | 強制通知 + 必須接受 |

## 資料庫 Schema

### 流程範本

```prisma
model WorkflowTemplate {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])

  moduleType    WorkflowModuleType
  name          String
  description   String?

  isActive      Boolean  @default(true)
  version       Int      @default(1)

  steps         WorkflowStep[]
  instances     WorkflowInstance[]

  createdById   String
  createdBy     Employee @relation(fields: [createdById], references: [id])
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([companyId, moduleType])
  @@map("workflow_templates")
}

model WorkflowStep {
  id            String   @id @default(cuid())
  templateId    String
  template      WorkflowTemplate @relation(fields: [templateId], references: [id])

  stepOrder     Int
  name          String

  assigneeType  AssigneeType
  positionId    String?
  specificEmployeeId String?

  isRequired    Boolean  @default(true)

  @@unique([templateId, stepOrder])
  @@map("workflow_steps")
}

enum AssigneeType {
  DIRECT_SUPERVISOR
  POSITION
  SPECIFIC_PERSON
}
```

### 流程實例

```prisma
model WorkflowInstance {
  id            String   @id @default(cuid())
  templateId    String
  template      WorkflowTemplate @relation(fields: [templateId], references: [id])

  moduleType    WorkflowModuleType
  referenceId   String

  applicantId   String
  applicant     Employee @relation("WorkflowApplicant", fields: [applicantId], references: [id])

  currentStep   Int      @default(1)
  status        WorkflowStatus @default(PENDING)

  completedAt   DateTime?

  approvals     WorkflowApproval[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([moduleType, referenceId])
  @@index([applicantId, status])
  @@map("workflow_instances")
}

model WorkflowApproval {
  id            String   @id @default(cuid())
  instanceId    String
  instance      WorkflowInstance @relation(fields: [instanceId], references: [id])

  stepOrder     Int
  stepName      String

  assigneeId    String
  assignee      Employee @relation("WorkflowAssignee", fields: [assigneeId], references: [id])

  actualApproverId  String?
  actualApprover    Employee? @relation("WorkflowActualApprover", fields: [actualApproverId], references: [id])

  proxyDelegationId String?

  decision      ApprovalDecision?
  comment       String?
  decidedAt     DateTime?

  createdAt     DateTime @default(now())

  @@unique([instanceId, stepOrder])
  @@map("workflow_approvals")
}

enum WorkflowStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum ApprovalDecision {
  APPROVED
  REJECTED
}
```

### 職務代理

```prisma
model Delegation {
  id              String   @id @default(cuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])

  delegatorId     String
  delegator       Employee @relation("DelegationDelegator", fields: [delegatorId], references: [id])

  delegateId      String
  delegate        Employee @relation("DelegationDelegate", fields: [delegateId], references: [id])

  permissions     DelegationPermission[]

  startDate       DateTime
  endDate         DateTime?

  status          DelegationStatus @default(PENDING)

  respondedAt     DateTime?
  rejectReason    String?

  cancelledAt     DateTime?
  cancelledById   String?
  cancelledBy     Employee? @relation("DelegationCanceller", fields: [cancelledById], references: [id])
  cancelReason    String?

  createdById     String
  createdBy       Employee @relation("DelegationCreator", fields: [createdById], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([delegatorId, status])
  @@index([delegateId, status])
  @@map("delegations")
}

model DelegationPermission {
  id              String   @id @default(cuid())
  delegationId    String
  delegation      Delegation @relation(fields: [delegationId], references: [id], onDelete: Cascade)

  permissionType  DelegationPermissionType

  @@unique([delegationId, permissionType])
  @@map("delegation_permissions")
}

enum DelegationStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
  CANCELLED
}

enum DelegationPermissionType {
  APPROVE_LEAVE
  APPROVE_EXPENSE
  APPROVE_SEAL
  APPROVE_CARD
  APPROVE_STATIONERY
  APPLY_LEAVE
  APPLY_EXPENSE
  VIEW_REPORTS
}
```

## 選單重整

```
個人專區
├── 我的資料
├── 審核中心（從原本獨立位置移入）
└── 我的通知

人事管理
├── 員工管理
├── 職務代理（新功能）
├── 班別設定（從系統設定移入）
├── 角色權限（從系統設定移入）
└── ...

流程管理（重新設計）
├── 審核流程設定（從系統設定移入）
└── 流程範本總覽

費用核銷（原「費用報銷」改名）
├── 我的核銷
├── 費用類別（從系統設定移入）
└── ...
```

## 職務代理業務規則

1. 已完全離職者無法被指定為代理人
2. 任職兩間公司以上，只要有一間在職即可擔任代理人
3. 取消代理原因至少 10 個字
4. 代理邀請需對方接受才生效
5. 代理生效時，Header 顯示提示 Banner

## 實作階段

- Phase 1：資料庫與基礎建設
- Phase 2：選單重整與改名
- Phase 3：職務代理功能
- Phase 4：流程編輯器
- Phase 5：審核流程引擎整合
- Phase 6：測試與收尾
