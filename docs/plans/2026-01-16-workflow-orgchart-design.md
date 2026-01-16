# 工作流程系統與組織圖設計文件

**建立日期：** 2026-01-16
**狀態：** 已核准
**版本：** 1.0

---

## 一、概述

本文件定義 ERP 系統的工作流程引擎、組織圖管理、員工特殊簽核路徑等功能的設計規格。

### 1.1 功能範圍

1. **費用報銷公司選擇** - 報銷時可選擇公司，使用該公司進行報銷
2. **特殊自訂義員工簽核路徑** - 為特定員工設定專屬簽核流程
3. **組織圖管理** - 集團/公司可自行設立可視化組織圖

### 1.2 設計目標

- 完整彈性的流程設計（條件分支 + 並行簽核）
- 可視化拖曳式編輯器
- 支援多種簽核人指定方式
- 組織圖與簽核流程整合

---

## 二、整體架構

### 2.1 三大核心模組

```
┌─────────────────────────────────────────────────────────────┐
│                      ERP 工作流程系統                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│   組織圖模組     │   流程引擎模組   │     申請單模組           │
│                 │                 │                         │
│ • 集團組織圖     │ • 流程定義      │ • 費用報銷              │
│ • 公司組織圖     │ • 條件分支      │ • 請假申請              │
│ • 實線/虛線關係  │ • 並行簽核      │ • 用印申請              │
│ • 矩陣式結構     │ • 員工特殊路徑  │ • 其他申請...           │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### 2.2 簽核優先權順序（高到低）

| 優先權 | 類型 | 說明 |
|--------|------|------|
| 1 | 員工個人特殊路徑 | 為「特定員工」設定的專屬簽核流程 |
| 2 | 申請類型自訂流程 | 針對「特定申請類型」設定的流程 |
| 3 | 組織圖預設流程 | 依據組織圖的上下級關係自動產生 |

### 2.3 權限設定

**可設定員工簽核路徑的角色：**
- 集團管理員：可設定任何員工
- 部門主管：可設定其部屬

---

## 三、組織圖模組

### 3.1 組織圖類型

| 類型 | 層級 | 用途 |
|------|------|------|
| 集團組織圖 | Group | 定義集團下各公司的關係、集團層級的管理架構 |
| 公司組織圖 | Company | 定義公司內部的部門、職位、人員階層關係 |

### 3.2 組織關係類型

```
┌─────────────────────────────────────────────────────────┐
│                     總經理                              │
│                       │                                │
│          ┌────────────┼────────────┐                   │
│          │            │            │                   │
│        實線         實線         實線                   │
│          ▼            ▼            ▼                   │
│      研發部主管    業務部主管    財務部主管              │
│          │            │                                │
│          │         ┌──┴──┐                             │
│        實線       實線  虛線 ─ ─ ─ ┐                    │
│          ▼         ▼              ▼                    │
│       工程師A    業務員B      (專案支援)                │
│                     │                                  │
│                   實線                                  │
│                     ▼                                  │
│                 業務助理C                               │
└─────────────────────────────────────────────────────────┘
```

**關係類型定義：**

| 類型 | 代碼 | 說明 | 簽核用途 |
|------|------|------|----------|
| 實線 | SOLID | 正式彙報關係 | 用於預設簽核路徑 |
| 虛線 | DOTTED | 功能性/專案彙報 | 可選擇性納入簽核 |
| 矩陣 | MATRIX | 多重隸屬 | 員工同時屬於多個單位 |

### 3.3 可視化編輯器功能

- **拖曳節點** - 新增/移動員工、部門、職位
- **連線關係** - 拖曳連線建立上下級關係
- **關係屬性** - 點擊連線設定：實線/虛線/矩陣
- **縮放/平移** - 支援大型組織瀏覽
- **匯出/列印** - 輸出組織圖為 PDF/PNG

### 3.4 資料模型

```prisma
// 組織圖類型
enum OrgChartType {
  GROUP
  COMPANY
}

// 組織節點類型
enum OrgNodeType {
  DEPARTMENT
  POSITION
  EMPLOYEE
}

// 組織關係類型
enum RelationType {
  SOLID
  DOTTED
  MATRIX
}

// 組織圖
model OrgChart {
  id          String       @id @default(cuid())
  type        OrgChartType
  groupId     String?
  group       Group?       @relation(fields: [groupId], references: [id])
  companyId   String?
  company     Company?     @relation(fields: [companyId], references: [id])
  name        String
  description String?
  isActive    Boolean      @default(true)

  nodes       OrgNode[]
  relations   OrgRelation[]

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([groupId])
  @@index([companyId])
}

// 組織節點
model OrgNode {
  id           String      @id @default(cuid())
  chartId      String
  chart        OrgChart    @relation(fields: [chartId], references: [id], onDelete: Cascade)

  nodeType     OrgNodeType
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])
  positionId   String?
  position     Position?   @relation(fields: [positionId], references: [id])
  employeeId   String?
  employee     Employee?   @relation(fields: [employeeId], references: [id])

  // 視覺化位置
  posX         Float       @default(0)
  posY         Float       @default(0)

  // 節點標籤（自訂顯示名稱）
  label        String?

  fromRelations OrgRelation[] @relation("FromNode")
  toRelations   OrgRelation[] @relation("ToNode")

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([chartId])
  @@index([employeeId])
}

// 組織關係
model OrgRelation {
  id              String       @id @default(cuid())
  chartId         String
  chart           OrgChart     @relation(fields: [chartId], references: [id], onDelete: Cascade)

  fromNodeId      String
  fromNode        OrgNode      @relation("FromNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNodeId        String
  toNode          OrgNode      @relation("ToNode", fields: [toNodeId], references: [id], onDelete: Cascade)

  relationType    RelationType

  // 簽核相關設定
  includeInApproval Boolean    @default(true)
  approvalOrder     Int?

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([chartId, fromNodeId, toNodeId])
  @@index([chartId])
}
```

---

## 四、流程引擎模組

### 4.1 流程節點類型

| 節點類型 | 代碼 | 說明 | 圖示 |
|----------|------|------|------|
| 開始節點 | START | 流程起點，申請人提交 | ⚪ |
| 簽核節點 | APPROVAL | 需要審核的關卡 | ▢ |
| 條件節點 | CONDITION | 分支判斷點 | ◇ |
| 並行開始 | PARALLEL_START | 同時發送多人簽核 | ═══ |
| 並行匯合 | PARALLEL_JOIN | 等待並行簽核完成 | ═══ |
| 結束節點 | END | 流程結束（通過/拒絕） | ⬤ |

### 4.2 流程範例

```
                        ⚪ 開始（員工提交）
                        │
                        ▼
                   ◇ 金額判斷
                  ╱         ╲
         < 5,000           ≥ 5,000
              │                 │
              ▼                 ▼
         ▢ 直屬主管         ═══ 並行開始
              │              ╱        ╲
              │         ▢ 部門主管  ▢ 財務審核
              │              ╲        ╱
              │              ═══ 並行匯合
              │                   │
              │                   ▼
              │              ◇ 金額 ≥ 50,000?
              │                ╱     ╲
              │             否        是
              │              │         │
              │              │    ▢ 總經理
              │              │         │
              └──────────────┴─────────┘
                             │
                             ▼
                        ⬤ 結束（核准）
```

### 4.3 簽核人指定方式

| 類型 | 代碼 | 說明 | 範例 |
|------|------|------|------|
| 特定員工 | SPECIFIC_EMPLOYEE | 直接指定某員工 | 「王小明」負責簽核 |
| 職位 | POSITION | 指定職位的人 | 「財務經理」這個職位的人 |
| 角色 | ROLE | 擁有特定角色的人 | 擁有「財務審核」角色的人 |
| 組織關係 | ORG_RELATION | 依據組織圖動態決定 | 申請人的直屬主管 |
| 部門主管 | DEPARTMENT_HEAD | 申請人部門的主管 | 部門最高主管 |
| 自訂欄位 | CUSTOM_FIELD | 表單中指定的審核人 | 表單填寫的「專案負責人」 |

### 4.4 組織關係選項

| 選項 | 代碼 | 說明 |
|------|------|------|
| 直屬主管 | DIRECT_SUPERVISOR | 實線主管 |
| 虛線主管 | DOTTED_SUPERVISOR | 虛線回報對象 |
| 往上 N 層 | N_LEVEL_UP | 往上第 N 層主管（可設定 N） |
| 部門最高主管 | DEPARTMENT_MANAGER | 部門的最高主管 |
| 公司負責人 | COMPANY_HEAD | 公司層級負責人 |

### 4.5 條件判斷

**支援欄位類型：**

| 類型 | 欄位 | 說明 |
|------|------|------|
| 金額 | AMOUNT | 申請金額 |
| 申請類型 | REQUEST_TYPE | 申請單類型（請假/報銷/用印...） |
| 子類型 | SUB_TYPE | 子類型（特休/病假/事假...） |
| 申請人部門 | APPLICANT_DEPARTMENT | 申請人所屬部門 |
| 申請人職位 | APPLICANT_POSITION | 申請人職位 |
| 申請人職級 | APPLICANT_LEVEL | 申請人職級 |
| 自訂欄位 | CUSTOM_FIELD | 表單自訂欄位值 |

**支援運算子：**

| 運算子 | 代碼 | 說明 |
|--------|------|------|
| 等於 | EQUALS | = |
| 不等於 | NOT_EQUALS | ≠ |
| 大於 | GREATER_THAN | > |
| 小於 | LESS_THAN | < |
| 大於等於 | GREATER_OR_EQUAL | ≥ |
| 小於等於 | LESS_OR_EQUAL | ≤ |
| 包含 | CONTAINS | 字串包含 |
| 在列表中 | IN | 值在指定列表中 |
| 不在列表中 | NOT_IN | 值不在指定列表中 |

### 4.6 並行簽核模式

| 模式 | 代碼 | 說明 |
|------|------|------|
| 全部通過 | ALL | 所有並行簽核人都核准才繼續 |
| 任一通過 | ANY | 任一簽核人核准即可繼續 |
| 多數通過 | MAJORITY | 過半簽核人核准即可繼續 |

### 4.7 資料模型

```prisma
// 流程範圍類型
enum WorkflowScope {
  EMPLOYEE      // 員工特殊路徑
  REQUEST_TYPE  // 申請類型流程
  DEFAULT       // 預設流程
}

// 流程節點類型
enum NodeType {
  START
  APPROVAL
  CONDITION
  PARALLEL_START
  PARALLEL_JOIN
  END
}

// 簽核人指定類型
enum ApproverType {
  SPECIFIC_EMPLOYEE
  POSITION
  ROLE
  ORG_RELATION
  DEPARTMENT_HEAD
  CUSTOM_FIELD
}

// 組織關係類型（用於動態簽核人）
enum OrgRelationApprover {
  DIRECT_SUPERVISOR
  DOTTED_SUPERVISOR
  N_LEVEL_UP
  DEPARTMENT_MANAGER
  COMPANY_HEAD
}

// 並行模式
enum ParallelMode {
  ALL
  ANY
  MAJORITY
}

// 條件運算子
enum ConditionOperator {
  EQUALS
  NOT_EQUALS
  GREATER_THAN
  LESS_THAN
  GREATER_OR_EQUAL
  LESS_OR_EQUAL
  CONTAINS
  IN
  NOT_IN
}

// 流程定義
model WorkflowDefinition {
  id            String          @id @default(cuid())
  name          String
  description   String?

  // 適用範圍
  scopeType     WorkflowScope
  groupId       String?
  group         Group?          @relation(fields: [groupId], references: [id])
  companyId     String?
  company       Company?        @relation(fields: [companyId], references: [id])

  // 員工特殊路徑（scopeType=EMPLOYEE）
  employeeId    String?
  employee      Employee?       @relation(fields: [employeeId], references: [id])

  // 申請類型（scopeType=REQUEST_TYPE）
  requestType   String?

  // 生效期間
  effectiveFrom DateTime?
  effectiveTo   DateTime?
  isActive      Boolean         @default(true)

  // 設定者
  createdById   String
  createdBy     Employee        @relation("WorkflowCreator", fields: [createdById], references: [id])

  nodes         WorkflowNode[]
  edges         WorkflowEdge[]
  instances     WorkflowInstance[]

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([companyId])
  @@index([employeeId])
  @@index([requestType])
}

// 流程節點
model WorkflowNode {
  id              String                @id @default(cuid())
  definitionId    String
  definition      WorkflowDefinition    @relation(fields: [definitionId], references: [id], onDelete: Cascade)

  nodeType        NodeType
  name            String?

  // 簽核人設定（nodeType=APPROVAL）
  approverType    ApproverType?
  approverId      String?               // 特定員工/職位/角色 ID
  orgRelation     OrgRelationApprover?
  orgLevelUp      Int?                  // 往上幾層
  customFieldName String?               // 自訂欄位名稱

  // 並行設定（nodeType=PARALLEL_JOIN）
  parallelMode    ParallelMode?

  // 視覺化位置
  posX            Float                 @default(0)
  posY            Float                 @default(0)

  fromEdges       WorkflowEdge[]        @relation("FromNode")
  toEdges         WorkflowEdge[]        @relation("ToNode")
  approvalRecords ApprovalRecord[]

  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  @@index([definitionId])
}

// 節點連線（含條件）
model WorkflowEdge {
  id                String            @id @default(cuid())
  definitionId      String
  definition        WorkflowDefinition @relation(fields: [definitionId], references: [id], onDelete: Cascade)

  fromNodeId        String
  fromNode          WorkflowNode      @relation("FromNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNodeId          String
  toNode            WorkflowNode      @relation("ToNode", fields: [toNodeId], references: [id], onDelete: Cascade)

  // 條件設定（從條件節點出發時）
  conditionField    String?
  conditionOperator ConditionOperator?
  conditionValue    String?
  isDefault         Boolean           @default(false)

  // 排序（同一來源多條邊時）
  sortOrder         Int               @default(0)

  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([definitionId])
  @@index([fromNodeId])
}
```

---

## 五、流程執行與簽核紀錄

### 5.1 流程實例狀態

```
   DRAFT ──▶ PENDING ──▶ IN_PROGRESS ──┬──▶ APPROVED
   (草稿)    (待送審)     (簽核中)      │     (已核准)
                │                      │
                │                      ├──▶ REJECTED
                │                      │     (已拒絕)
                │                      │
                ▼                      └──▶ CANCELLED
            WITHDRAWN                        (已取消)
            (已撤回)
```

### 5.2 簽核關卡狀態

| 狀態 | 代碼 | 說明 |
|------|------|------|
| 等待中 | WAITING | 前一關卡尚未完成 |
| 待簽核 | PENDING | 輪到此關卡 |
| 已核准 | APPROVED | 此關卡已核准 |
| 已拒絕 | REJECTED | 此關卡已拒絕 |
| 已跳過 | SKIPPED | 條件不符或被取消 |

### 5.3 簽核動作

| 動作 | 代碼 | 說明 |
|------|------|------|
| 核准 | APPROVE | 同意，進入下一關卡 |
| 拒絕 | REJECT | 不同意，流程終止 |
| 退回 | RETURN | 退回給前一關或申請人修改 |
| 加簽 | ADD_SIGNER | 臨時加入其他簽核人 |
| 轉簽 | TRANSFER | 轉給他人代為簽核 |

### 5.4 資料模型

```prisma
// 流程實例狀態
enum InstanceStatus {
  DRAFT
  PENDING
  IN_PROGRESS
  APPROVED
  REJECTED
  CANCELLED
  WITHDRAWN
}

// 簽核狀態
enum ApprovalStatus {
  WAITING
  PENDING
  APPROVED
  REJECTED
  SKIPPED
}

// 簽核動作
enum ApprovalAction {
  APPROVE
  REJECT
  RETURN
  ADD_SIGNER
  TRANSFER
}

// 流程實例
model WorkflowInstance {
  id              String              @id @default(cuid())
  definitionId    String
  definition      WorkflowDefinition  @relation(fields: [definitionId], references: [id])

  // 關聯的申請單
  requestType     String
  requestId       String

  // 申請人
  applicantId     String
  applicant       Employee            @relation(fields: [applicantId], references: [id])
  companyId       String
  company         Company             @relation(fields: [companyId], references: [id])

  // 狀態
  status          InstanceStatus      @default(DRAFT)
  currentNodeId   String?

  // 時間戳
  submittedAt     DateTime?
  completedAt     DateTime?

  approvalRecords ApprovalRecord[]

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([requestType, requestId])
  @@index([applicantId])
  @@index([status])
}

// 簽核紀錄
model ApprovalRecord {
  id              String            @id @default(cuid())
  instanceId      String
  instance        WorkflowInstance  @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  nodeId          String
  node            WorkflowNode      @relation(fields: [nodeId], references: [id])

  // 簽核人
  approverId      String
  approver        Employee          @relation("Approver", fields: [approverId], references: [id])
  actualSignerId  String?
  actualSigner    Employee?         @relation("ActualSigner", fields: [actualSignerId], references: [id])

  // 簽核結果
  status          ApprovalStatus    @default(WAITING)
  action          ApprovalAction?
  comment         String?

  // 時間
  assignedAt      DateTime          @default(now())
  actionAt        DateTime?

  // 加簽/轉簽/退回資訊
  addedSignerIds  String[]
  transferredToId String?
  returnToNodeId  String?

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([instanceId])
  @@index([approverId])
  @@index([status])
}

// 職務代理設定
model ApprovalDelegate {
  id              String      @id @default(cuid())
  principalId     String
  principal       Employee    @relation("Principal", fields: [principalId], references: [id])
  delegateId      String
  delegate        Employee    @relation("Delegate", fields: [delegateId], references: [id])

  startDate       DateTime
  endDate         DateTime

  // 代理範圍（空陣列 = 全部）
  requestTypes    String[]
  companyIds      String[]

  isActive        Boolean     @default(true)

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([principalId])
  @@index([delegateId])
  @@index([startDate, endDate])
}
```

---

## 六、可視化流程編輯器

### 6.1 技術選型

使用 **React Flow** 作為流程圖編輯器基礎。

| 項目 | 選擇 | 理由 |
|------|------|------|
| 流程圖引擎 | React Flow | 成熟穩定、文件完整、MIT 授權 |
| 狀態管理 | Zustand | 輕量、與 React Flow 整合良好 |
| 拖曳功能 | React DnD | React Flow 內建支援 |

### 6.2 編輯器介面

```
┌─────────────────────────────────────────────────────────────────┐
│  流程設計器 - 費用報銷流程                          [儲存] [預覽] │
├──────────┬──────────────────────────────────────────────────────┤
│ 節點工具  │                                                      │
│          │                     畫布區域                          │
│ ⚪ 開始   │                                                      │
│ ▢ 簽核   │      ⚪ ──▶ ◇ ──┬──▶ ▢ ──▶ ⬤                        │
│ ◇ 條件   │                 │                                    │
│ ═ 並行   │                 └──▶ ▢ ──▶ ▢ ──▶ ⬤                  │
│ ⬤ 結束   │                                                      │
│          │                                                      │
├──────────┤  ┌─────────────────────────────────────────────────┐ │
│ 人員選擇  │  │ 節點屬性                                        │ │
│          │  │                                                 │ │
│ 🔍 搜尋   │  │ 名稱：[部門主管審核]                             │ │
│          │  │ 簽核人類型：◉ 組織關係 ○ 特定員工 ○ 職位        │ │
│ ▸ 研發部  │  │ 關係：[直屬主管 ▼]                              │ │
│ ▸ 業務部  │  │                                                 │ │
│ ▸ 職位   │  └─────────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────────┘
```

### 6.3 編輯器功能清單

**基礎操作：**
- 拖曳節點到畫布
- 連接節點（拖曳連線）
- 選取/刪除節點
- 縮放/平移畫布
- 復原/重做（Ctrl+Z / Ctrl+Y）
- 複製/貼上節點

**節點設定：**
- 點擊節點開啟屬性面板
- 設定簽核人（各種指定方式）
- 設定並行模式
- 設定條件判斷

**驗證功能：**
- 檢查流程完整性（有開始和結束）
- 檢查孤立節點
- 檢查條件分支是否有預設路徑
- 預覽模擬執行

### 6.4 前端元件結構

```
src/components/workflow-editor/
├── WorkflowEditor.tsx          # 主編輯器元件
├── nodes/
│   ├── StartNode.tsx           # 開始節點
│   ├── ApprovalNode.tsx        # 簽核節點
│   ├── ConditionNode.tsx       # 條件節點
│   ├── ParallelNode.tsx        # 並行節點
│   └── EndNode.tsx             # 結束節點
├── panels/
│   ├── NodeToolbox.tsx         # 左側節點工具列
│   ├── EmployeeSelector.tsx    # 人員選擇器
│   ├── PropertyPanel.tsx       # 右側屬性面板
│   └── ConditionEditor.tsx     # 條件編輯器
├── hooks/
│   ├── useWorkflowStore.ts     # 流程狀態管理
│   └── useWorkflowValidation.ts # 流程驗證
└── utils/
    ├── workflowSerializer.ts   # 序列化/反序列化
    └── workflowExecutor.ts     # 流程執行邏輯
```

---

## 七、費用報銷公司選擇

### 7.1 功能說明

允許使用者在提交費用報銷時選擇報銷公司：
- 集團管理員可選擇任何公司
- 多公司任職者可選擇有任職的公司
- 一般員工使用當前選擇的公司

### 7.2 介面修改

費用報銷表單新增「報銷公司」下拉選單：

```
┌─────────────────────────────────────────────────────────────┐
│  費用報銷申請                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  報銷公司：[ 非凡影視股份有限公司 ▼ ]  ← 新增欄位            │
│                                                             │
│  報銷期間：[2026-01-01] 至 [2026-01-31]                     │
│  報銷標題：[                           ]                    │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 邏輯說明

- 報銷單的 `companyId` 使用選擇的公司
- 簽核流程依據選擇的公司來決定
- 報表統計歸屬於選擇的公司
- 會計傳票產生時使用選擇的公司

---

## 八、實作計畫

### Phase 1：基礎架構
- [ ] 資料庫 Schema 更新
- [ ] 基礎 CRUD API

### Phase 2：組織圖模組
- [ ] 組織圖可視化編輯器（React Flow）
- [ ] 節點/關係管理 API
- [ ] 組織圖查詢與展示

### Phase 3：流程引擎核心
- [ ] 流程定義編輯器
- [ ] 條件判斷引擎
- [ ] 流程執行引擎

### Phase 4：員工特殊路徑
- [ ] 員工特殊路徑設定介面
- [ ] 優先權判斷邏輯
- [ ] 管理員/主管設定權限

### Phase 5：費用報銷整合
- [ ] 公司選擇功能
- [ ] 與流程引擎整合

### Phase 6：其他申請單整合
- [ ] 請假申請整合
- [ ] 用印申請整合
- [ ] 名片申請整合
- [ ] 文具申請整合

---

## 九、檔案結構

```
src/
├── app/dashboard/
│   ├── workflow/                    # 流程管理
│   │   ├── page.tsx                 # 流程列表
│   │   ├── definitions/             # 流程定義
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── editor/                  # 流程編輯器
│   │   │   └── [id]/page.tsx
│   │   ├── employee-paths/          # 員工特殊路徑
│   │   │   ├── page.tsx
│   │   │   └── [employeeId]/page.tsx
│   │   └── delegates/               # 職務代理
│   │       └── page.tsx
│   └── organization/                # 組織圖管理
│       ├── page.tsx                 # 組織圖列表
│       ├── chart/                   # 組織圖編輯器
│       │   └── [id]/page.tsx
│       └── view/                    # 組織圖檢視
│           └── [id]/page.tsx
├── components/
│   ├── workflow-editor/             # 流程編輯器元件
│   │   ├── WorkflowEditor.tsx
│   │   ├── nodes/
│   │   ├── panels/
│   │   ├── hooks/
│   │   └── utils/
│   └── org-chart-editor/            # 組織圖編輯器元件
│       ├── OrgChartEditor.tsx
│       ├── nodes/
│       ├── panels/
│       └── hooks/
├── server/routers/
│   ├── workflow.ts                  # 流程定義 API
│   ├── workflowInstance.ts          # 流程實例 API
│   ├── orgChart.ts                  # 組織圖 API
│   └── approval.ts                  # 簽核 API
└── lib/
    └── workflow-engine/             # 流程引擎核心
        ├── executor.ts              # 流程執行
        ├── resolver.ts              # 簽核人解析
        ├── condition.ts             # 條件判斷
        └── priority.ts              # 優先權判斷
```

---

## 十、附錄

### A. 相依套件

```json
{
  "dependencies": {
    "reactflow": "^11.x",
    "@reactflow/core": "^11.x",
    "@reactflow/controls": "^11.x",
    "@reactflow/minimap": "^11.x",
    "zustand": "^4.x"
  }
}
```

### B. 參考資源

- React Flow 官方文件：https://reactflow.dev/
- Zustand 官方文件：https://zustand-demo.pmnd.rs/

---

**文件結束**
