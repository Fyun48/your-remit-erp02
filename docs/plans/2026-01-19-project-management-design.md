# 專案管理模組設計

> 建立日期：2026-01-19
> 狀態：設計完成，待實作

## 概述

為集團 ERP 系統新增專案管理模組，支援內部專案與客戶專案管理，提供階層式任務追蹤、團隊協作工具，並整合部門 KPI 計算。

## 功能需求

### 核心功能

| 功能 | 說明 |
|------|------|
| 專案管理 | 建立、編輯、追蹤內部與客戶專案 |
| 階層式任務 | 專案 → 階段/里程碑 → 任務 → 子任務 |
| 進階協作 | 評論討論、@提及、檔案附件、即時通知、活動動態牆 |
| 彈性權限 | 私有/部門/公司/自訂可見性，三種角色（經理/成員/觀察者） |
| 專案範本 | 預設階段與任務結構，快速建立新專案 |
| KPI 整合 | 完成率 + 準時率 + 品質評分，權重可調整 |
| 完整稽核 | 所有操作紀錄，變更前後資料快照，不可刪除修改 |
| 客戶關聯 | 連結 ERP 現有客戶/廠商資料 |

### 專案類型

- **內部專案**：公司內部改善計畫、系統導入、流程優化
- **客戶專案**：對外客戶委託案、專案服務

## 資料架構

### 核心模型

#### Project（專案）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| name | String | 專案名稱 |
| description | String? | 專案描述 |
| type | ProjectType | 類型：INTERNAL / CLIENT |
| status | ProjectStatus | 狀態：PLANNING / IN_PROGRESS / COMPLETED / CANCELLED |
| visibility | ProjectVisibility | 可見性：PRIVATE / DEPARTMENT / COMPANY / CUSTOM |
| plannedStartDate | DateTime? | 預計開始日 |
| plannedEndDate | DateTime? | 預計結束日 |
| actualStartDate | DateTime? | 實際開始日 |
| actualEndDate | DateTime? | 實際結束日 |
| companyId | String | 所屬公司 |
| departmentId | String | 負責部門 |
| managerId | String | 專案經理 |
| customerId | String? | 關聯客戶（客戶專案用） |
| templateId | String? | 套用的範本 |
| qualityScore | Int? | 結案品質評分（1-5） |

#### ProjectPhase（專案階段/里程碑）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| projectId | String | 所屬專案 |
| name | String | 階段名稱 |
| description | String? | 描述 |
| sortOrder | Int | 排序 |
| status | PhaseStatus | 狀態：PENDING / IN_PROGRESS / COMPLETED |
| plannedEndDate | DateTime? | 預計完成日 |
| actualEndDate | DateTime? | 實際完成日 |

#### ProjectTask（任務）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| phaseId | String | 所屬階段 |
| parentId | String? | 父任務（支援子任務） |
| name | String | 任務名稱 |
| description | String? | 描述 |
| priority | TaskPriority | 優先級：HIGH / MEDIUM / LOW |
| status | TaskStatus | 狀態：TODO / IN_PROGRESS / COMPLETED |
| assigneeId | String? | 指派人 |
| estimatedHours | Float? | 預計工時 |
| actualHours | Float? | 實際工時 |
| startDate | DateTime? | 開始日 |
| dueDate | DateTime? | 截止日 |
| completedAt | DateTime? | 完成時間 |

#### ProjectMember（專案成員）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| projectId | String | 所屬專案 |
| employeeId | String | 員工 |
| role | ProjectRole | 角色：MANAGER / MEMBER / OBSERVER |
| joinedAt | DateTime | 加入時間 |
| leftAt | DateTime? | 離開時間（保留歷史紀錄） |

### 協作模型

#### ProjectComment（評論）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| projectId | String? | 專案層級評論 |
| phaseId | String? | 階段層級評論 |
| taskId | String? | 任務層級評論 |
| authorId | String | 作者 |
| content | String | 內容（支援 Markdown） |

#### ProjectCommentMention（@提及）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| commentId | String | 評論 |
| employeeId | String | 被提及的員工 |

#### ProjectAttachment（附件）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| projectId | String? | 專案層級附件 |
| phaseId | String? | 階段層級附件 |
| taskId | String? | 任務層級附件 |
| commentId | String? | 評論附件 |
| fileName | String | 檔名 |
| fileUrl | String | 檔案路徑 |
| fileSize | Int | 檔案大小 |
| mimeType | String | MIME 類型 |
| uploaderId | String | 上傳者 |

#### ProjectActivity（活動動態）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| projectId | String | 所屬專案 |
| actorId | String | 執行者 |
| action | String | 動作類型 |
| targetType | String | 目標類型 |
| targetId | String | 目標 ID |
| summary | String | 動態摘要 |

#### ProjectAuditLog（稽核紀錄）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| projectId | String | 所屬專案 |
| actorId | String | 執行者 |
| action | String | 動作：CREATE / UPDATE / DELETE / STATUS_CHANGE |
| targetType | String | 目標類型 |
| targetId | String | 目標 ID |
| beforeData | Json? | 變更前資料 |
| afterData | Json? | 變更後資料 |
| ipAddress | String? | IP 位址 |
| userAgent | String? | 瀏覽器資訊 |

> 注意：稽核紀錄不可刪除、不可修改，無 updatedAt 欄位

### 範本模型

#### ProjectTemplate（專案範本）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| name | String | 範本名稱 |
| description | String? | 描述 |
| type | ProjectType? | 適用類型（null 表示通用） |
| companyId | String? | 所屬公司（null 表示集團共用） |
| isActive | Boolean | 是否啟用 |
| createdById | String | 建立者 |

#### ProjectTemplatePhase（範本階段）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| templateId | String | 所屬範本 |
| name | String | 階段名稱 |
| description | String? | 描述 |
| sortOrder | Int | 排序 |
| daysOffset | Int | 從專案開始日算起的天數 |

#### ProjectTemplateTask（範本任務）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| phaseId | String | 所屬階段 |
| parentId | String? | 父任務 |
| name | String | 任務名稱 |
| description | String? | 描述 |
| priority | TaskPriority | 優先級 |
| estimatedHours | Float? | 預計工時 |
| daysOffset | Int | 從階段開始日算起的天數 |
| duration | Int | 任務預設天數 |

### KPI 模型

#### ProjectKpiSetting（KPI 權重設定）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| companyId | String | 公司（唯一） |
| completionWeight | Float | 完成率權重（預設 0.4） |
| onTimeWeight | Float | 準時率權重（預設 0.35） |
| qualityWeight | Float | 品質分權重（預設 0.25） |

#### ProjectKpiSummary（部門 KPI 月度彙整）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | String | 主鍵 |
| companyId | String | 公司 |
| departmentId | String | 部門 |
| year | Int | 年度 |
| month | Int | 月份 |
| projectCount | Int | 專案數 |
| completedCount | Int | 完成數 |
| avgCompletion | Float | 平均完成率 |
| avgOnTime | Float | 平均準時率 |
| avgQuality | Float | 平均品質分 |
| overallScore | Float | 綜合績效分數 |
| targetScore | Float? | 目標分數 |

## KPI 計算邏輯

### 專案績效指標

1. **完成率**（預設權重 40%）
   - 計算：已完成任務數 / 總任務數 × 100%
   - 子任務完成會反映到父任務進度

2. **準時率**（預設權重 35%）
   - 計算：準時完成任務數 / 已完成任務數 × 100%
   - 準時定義：在截止日（含）之前完成

3. **品質評分**（預設權重 25%）
   - 專案結案時由專案經理或評審人評分（1-5 分）
   - 轉換為百分比：評分 × 20%

### 綜合分數

```
專案績效 = (完成率 × 完成率權重) + (準時率 × 準時率權重) + (品質分數 × 品質權重)
```

權重可在系統設定中調整。

## 權限設計

### 專案可見性

| 層級 | 誰可以看到 | 適用情境 |
|------|-----------|---------|
| PRIVATE | 僅專案成員 | 機密專案、人事相關 |
| DEPARTMENT | 負責部門全員 | 部門內部專案 |
| COMPANY | 同公司全員 | 一般公開專案 |
| CUSTOM | 指定的員工清單 | 跨部門協作專案 |

### 專案角色

| 角色 | 權限 |
|------|------|
| MANAGER | 編輯專案、管理成員、設定權限、填寫結案評分 |
| MEMBER | 建立/編輯任務、上傳附件、發表評論、更新自己的任務狀態 |
| OBSERVER | 僅能檢視、可發表評論 |

### 系統權限

- **專案管理員**：管理所有專案範本、查看全公司專案
- **稽核人員**：查看任何專案的完整稽核紀錄

## 通知機制

整合現有通知系統，在以下情況發送通知：

- 被指派新任務
- 任務截止日前提醒（可設定 1/3/7 天前）
- 被 @提及
- 負責的任務有新評論
- 專案狀態變更
- 里程碑即將到期

## 頁面結構

### 新增頁面

| 路徑 | 說明 |
|------|------|
| `/dashboard/projects` | 專案列表 |
| `/dashboard/projects/new` | 新增專案 |
| `/dashboard/projects/[id]` | 專案詳情（含標籤頁） |
| `/dashboard/settings/project-templates` | 範本管理 |
| `/dashboard/reports/project-kpi` | KPI 儀表板 |

### 專案詳情頁標籤

- **總覽**：基本資訊、進度環圖、近期動態
- **階段與任務**：階層式任務清單，可展開/收合
- **成員**：成員列表、角色管理
- **附件**：所有檔案集中檢視
- **動態**：活動動態牆
- **設定**：權限、可見性設定（僅經理可見）

## Prisma Schema

```prisma
// ==================== 專案管理 ====================

model Project {
  id              String            @id @default(cuid())
  name            String
  description     String?
  type            ProjectType
  status          ProjectStatus     @default(PLANNING)
  visibility      ProjectVisibility @default(DEPARTMENT)

  plannedStartDate  DateTime?
  plannedEndDate    DateTime?
  actualStartDate   DateTime?
  actualEndDate     DateTime?

  companyId       String
  departmentId    String
  managerId       String
  customerId      String?
  templateId      String?

  qualityScore    Int?

  company         Company           @relation(fields: [companyId], references: [id])
  department      Department        @relation(fields: [departmentId], references: [id])
  manager         Employee          @relation("ProjectManager", fields: [managerId], references: [id])
  customer        Customer?         @relation(fields: [customerId], references: [id])

  phases          ProjectPhase[]
  members         ProjectMember[]
  visibleMembers  ProjectVisibleMember[]
  comments        ProjectComment[]
  attachments     ProjectAttachment[]
  activities      ProjectActivity[]
  auditLogs       ProjectAuditLog[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([companyId])
  @@index([departmentId])
  @@index([managerId])
  @@index([status])
}

model ProjectPhase {
  id              String      @id @default(cuid())
  projectId       String
  name            String
  description     String?
  sortOrder       Int
  status          PhaseStatus @default(PENDING)
  plannedEndDate  DateTime?
  actualEndDate   DateTime?

  project         Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks           ProjectTask[]
  comments        ProjectComment[]
  attachments     ProjectAttachment[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([projectId])
}

model ProjectTask {
  id              String       @id @default(cuid())
  phaseId         String
  parentId        String?
  name            String
  description     String?
  priority        TaskPriority @default(MEDIUM)
  status          TaskStatus   @default(TODO)

  assigneeId      String?
  estimatedHours  Float?
  actualHours     Float?
  startDate       DateTime?
  dueDate         DateTime?
  completedAt     DateTime?

  phase           ProjectPhase @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  parent          ProjectTask? @relation("SubTasks", fields: [parentId], references: [id])
  children        ProjectTask[] @relation("SubTasks")
  assignee        Employee?    @relation(fields: [assigneeId], references: [id])
  comments        ProjectComment[]
  attachments     ProjectAttachment[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([phaseId])
  @@index([parentId])
  @@index([assigneeId])
  @@index([status])
}

model ProjectMember {
  id          String      @id @default(cuid())
  projectId   String
  employeeId  String
  role        ProjectRole @default(MEMBER)
  joinedAt    DateTime    @default(now())
  leftAt      DateTime?

  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  employee    Employee    @relation(fields: [employeeId], references: [id])

  @@unique([projectId, employeeId])
  @@index([projectId])
  @@index([employeeId])
}

model ProjectVisibleMember {
  id          String   @id @default(cuid())
  projectId   String
  employeeId  String

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  employee    Employee @relation(fields: [employeeId], references: [id])

  @@unique([projectId, employeeId])
}

model ProjectComment {
  id          String    @id @default(cuid())
  projectId   String?
  phaseId     String?
  taskId      String?
  authorId    String
  content     String

  project     Project?       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  phase       ProjectPhase?  @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  task        ProjectTask?   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author      Employee       @relation(fields: [authorId], references: [id])
  attachments ProjectAttachment[]
  mentions    ProjectCommentMention[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectId])
  @@index([phaseId])
  @@index([taskId])
  @@index([authorId])
}

model ProjectCommentMention {
  id          String         @id @default(cuid())
  commentId   String
  employeeId  String

  comment     ProjectComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  employee    Employee       @relation(fields: [employeeId], references: [id])

  @@unique([commentId, employeeId])
}

model ProjectAttachment {
  id          String    @id @default(cuid())
  projectId   String?
  phaseId     String?
  taskId      String?
  commentId   String?

  fileName    String
  fileUrl     String
  fileSize    Int
  mimeType    String
  uploaderId  String

  project     Project?       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  phase       ProjectPhase?  @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  task        ProjectTask?   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  comment     ProjectComment? @relation(fields: [commentId], references: [id], onDelete: Cascade)
  uploader    Employee       @relation(fields: [uploaderId], references: [id])

  createdAt   DateTime @default(now())

  @@index([projectId])
  @@index([taskId])
  @@index([uploaderId])
}

model ProjectActivity {
  id          String   @id @default(cuid())
  projectId   String
  actorId     String
  action      String
  targetType  String
  targetId    String
  summary     String

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  actor       Employee @relation(fields: [actorId], references: [id])

  createdAt   DateTime @default(now())

  @@index([projectId])
  @@index([actorId])
  @@index([createdAt])
}

model ProjectAuditLog {
  id          String   @id @default(cuid())
  projectId   String
  actorId     String
  action      String
  targetType  String
  targetId    String
  beforeData  Json?
  afterData   Json?
  ipAddress   String?
  userAgent   String?

  createdAt   DateTime @default(now())

  @@index([projectId])
  @@index([actorId])
  @@index([createdAt])
}

// ==================== 專案範本 ====================

model ProjectTemplate {
  id          String       @id @default(cuid())
  name        String
  description String?
  type        ProjectType?
  companyId   String?
  isActive    Boolean      @default(true)
  createdById String

  company     Company?     @relation(fields: [companyId], references: [id])
  createdBy   Employee     @relation(fields: [createdById], references: [id])
  phases      ProjectTemplatePhase[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([companyId])
  @@index([isActive])
}

model ProjectTemplatePhase {
  id          String          @id @default(cuid())
  templateId  String
  name        String
  description String?
  sortOrder   Int
  daysOffset  Int             @default(0)

  template    ProjectTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  tasks       ProjectTemplateTask[]

  @@index([templateId])
}

model ProjectTemplateTask {
  id              String               @id @default(cuid())
  phaseId         String
  parentId        String?
  name            String
  description     String?
  priority        TaskPriority         @default(MEDIUM)
  estimatedHours  Float?
  daysOffset      Int                  @default(0)
  duration        Int                  @default(1)

  phase           ProjectTemplatePhase @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  parent          ProjectTemplateTask? @relation("TemplateSubTasks", fields: [parentId], references: [id])
  children        ProjectTemplateTask[] @relation("TemplateSubTasks")

  @@index([phaseId])
  @@index([parentId])
}

// ==================== KPI 設定 ====================

model ProjectKpiSetting {
  id                  String   @id @default(cuid())
  companyId           String   @unique
  completionWeight    Float    @default(0.4)
  onTimeWeight        Float    @default(0.35)
  qualityWeight       Float    @default(0.25)

  company             Company  @relation(fields: [companyId], references: [id])

  updatedAt           DateTime @updatedAt
}

model ProjectKpiSummary {
  id              String     @id @default(cuid())
  companyId       String
  departmentId    String
  year            Int
  month           Int

  projectCount    Int        @default(0)
  completedCount  Int        @default(0)
  avgCompletion   Float      @default(0)
  avgOnTime       Float      @default(0)
  avgQuality      Float      @default(0)
  overallScore    Float      @default(0)

  targetScore     Float?

  company         Company    @relation(fields: [companyId], references: [id])
  department      Department @relation(fields: [departmentId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([companyId, departmentId, year, month])
  @@index([companyId])
  @@index([departmentId])
  @@index([year, month])
}

// ==================== 列舉類型 ====================

enum ProjectType {
  INTERNAL
  CLIENT
}

enum ProjectStatus {
  PLANNING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum ProjectVisibility {
  PRIVATE
  DEPARTMENT
  COMPANY
  CUSTOM
}

enum ProjectRole {
  MANAGER
  MEMBER
  OBSERVER
}

enum PhaseStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  COMPLETED
}

enum TaskPriority {
  HIGH
  MEDIUM
  LOW
}
```

## 實作優先順序

### Phase 1：基礎架構
1. Prisma Schema 更新
2. 專案 CRUD API（tRPC router）
3. 專案列表頁與詳情頁
4. 階段與任務管理

### Phase 2：協作功能
5. 評論系統與 @提及
6. 附件上傳
7. 活動動態牆
8. 通知整合

### Phase 3：進階功能
9. 專案範本管理
10. 彈性權限設定
11. 稽核紀錄

### Phase 4：KPI 整合
12. KPI 設定頁面
13. KPI 計算邏輯
14. KPI 儀表板與報表
