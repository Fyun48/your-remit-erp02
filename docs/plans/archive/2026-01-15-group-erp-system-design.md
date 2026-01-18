# 集團企業 ERP 系統設計文件

## 專案概述

建構支援多分公司的集團企業 ERP 系統，包含：
- 公司/分公司管理
- 用印/公司證件申請
- 名片/文具申請
- 集團級權限控制
- 稽核日誌追蹤

## 一、系統架構

### 1.1 組織層級結構

```
集團 (Group)
├── 分公司 A (Company)
│   ├── 部門 (Department)
│   │   └── 員工任職 (EmployeeAssignment)
│   └── 職位 (Position)
├── 分公司 B (Company)
│   └── ...
└── 集團級員工 (Group Admin)
    └── 可管理所有分公司
```

### 1.2 資料庫架構新增

```prisma
// 稽核日誌
model AuditLog {
  id          String   @id @default(cuid())
  entityType  String   // Employee, Department, Voucher, SealRequest...
  entityId    String   // 資料主鍵
  action      String   // CREATE, UPDATE, DELETE
  path        String   // 修改欄位路徑
  oldValue    Json?    // 修改前
  newValue    Json?    // 修改後
  operatorId  String
  operator    Employee @relation(fields: [operatorId], references: [id])
  companyId   String?
  company     Company? @relation(fields: [companyId], references: [id])
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@index([entityType, entityId])
  @@index([operatorId])
  @@index([companyId])
  @@index([createdAt])
}

// 用印申請
model SealRequest {
  id              String   @id @default(cuid())
  requestNo       String   @unique  // SR202601150001
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  applicantId     String
  applicant       Employee @relation("SealApplicant", fields: [applicantId], references: [id])
  sealType        SealType // COMPANY_SEAL, CONTRACT_SEAL, INVOICE_SEAL...
  purpose         String   // 用途說明
  documentName    String?  // 文件名稱
  documentCount   Int      @default(1)  // 用印份數
  isCarryOut      Boolean  @default(false)  // 是否攜出
  expectedReturn  DateTime? // 預計歸還時間
  actualReturn    DateTime? // 實際歸還時間
  returnNote      String?  // 歸還備註
  status          RequestStatus @default(PENDING)
  approvalFlowId  String?
  approvalFlow    ApprovalFlow? @relation(fields: [approvalFlowId], references: [id])
  attachments     Json?    // 附件清單
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum SealType {
  COMPANY_SEAL        // 公司大章
  COMPANY_SMALL_SEAL  // 公司小章
  CONTRACT_SEAL       // 合約用印
  INVOICE_SEAL        // 發票章
  BOARD_SEAL          // 董事會印鑑
  BANK_SEAL           // 銀行印鑑
  CARRY_OUT           // 攜出印章
}

// 公司證件借用
model DocumentBorrow {
  id              String   @id @default(cuid())
  requestNo       String   @unique  // DB202601150001
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  applicantId     String
  applicant       Employee @relation("DocBorrowApplicant", fields: [applicantId], references: [id])
  documentType    DocumentType
  purpose         String
  borrowDate      DateTime
  expectedReturn  DateTime
  actualReturn    DateTime?
  returnNote      String?
  status          RequestStatus @default(PENDING)
  approvalFlowId  String?
  attachments     Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum DocumentType {
  BUSINESS_LICENSE    // 營業執照
  TAX_REGISTRATION    // 稅務登記證
  ORGANIZATION_CODE   // 組織機構代碼證
  BANK_PERMIT         // 開戶許可證
  COMPANY_CHARTER     // 公司章程
  SHAREHOLDER_LIST    // 股東名冊
}

// 名片申請
model BusinessCardRequest {
  id              String   @id @default(cuid())
  requestNo       String   @unique  // BC202601150001
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  applicantId     String
  applicant       Employee @relation("CardApplicant", fields: [applicantId], references: [id])
  templateId      String?  // 使用的名片模板
  quantity        Int      // 申請數量 (盒)
  cardName        String   // 名片上的姓名
  cardTitle       String   // 名片上的職稱
  cardPhone       String?  // 名片上的電話
  cardMobile      String?  // 名片上的手機
  cardEmail       String?  // 名片上的信箱
  cardAddress     String?  // 名片上的地址
  customDesign    String?  // 自訂設計檔案路徑
  note            String?  // 備註
  status          RequestStatus @default(PENDING)
  approvalFlowId  String?
  printedAt       DateTime? // 印刷完成時間
  deliveredAt     DateTime? // 交付時間
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// 文具/設備申請
model StationeryRequest {
  id              String   @id @default(cuid())
  requestNo       String   @unique  // ST202601150001
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  applicantId     String
  applicant       Employee @relation("StationeryApplicant", fields: [applicantId], references: [id])
  requestType     StationeryType
  items           Json     // [{name, quantity, spec, note}]
  totalAmount     Decimal? @db.Decimal(12,2)  // 預估金額
  purpose         String?  // 用途說明
  urgency         Urgency  @default(NORMAL)
  status          RequestStatus @default(PENDING)
  approvalFlowId  String?
  purchasedAt     DateTime? // 採購完成時間
  deliveredAt     DateTime? // 交付時間
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum StationeryType {
  BUSINESS_CARD   // 名片
  STATIONERY      // 文具
  EQUIPMENT       // 辦公設備
  CONSUMABLE      // 耗材
}

enum Urgency {
  LOW       // 低
  NORMAL    // 一般
  HIGH      // 急件
  URGENT    // 特急
}

enum RequestStatus {
  DRAFT       // 草稿
  PENDING     // 待審核
  APPROVED    // 已核准
  REJECTED    // 已駁回
  PROCESSING  // 處理中
  COMPLETED   // 已完成
  CANCELLED   // 已取消
  RETURNED    // 已歸還 (用於借用類)
  OVERDUE     // 逾期 (用於借用類)
}

// 集團級權限
model GroupPermission {
  id          String   @id @default(cuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  permission  GroupPermissionType
  grantedBy   String   // 授權人
  grantedAt   DateTime @default(now())
  expiresAt   DateTime? // 權限到期時間
  isActive    Boolean  @default(true)
  note        String?

  @@unique([employeeId, permission])
}

enum GroupPermissionType {
  GROUP_ADMIN           // 集團超級管理員
  CROSS_COMPANY_VIEW    // 跨公司檢視
  CROSS_COMPANY_EDIT    // 跨公司編輯
  AUDIT_LOG_VIEW        // 稽核日誌檢視
  COMPANY_MANAGEMENT    // 公司管理 (創建/停用)
}
```

## 二、預設資料

### 2.1 預設部門 (10個)

| 代碼 | 名稱 | 排序 |
|------|------|------|
| D001 | 管理部 | 1 |
| D002 | 業務部 | 2 |
| D003 | 行銷部 | 3 |
| D004 | 產品部 | 4 |
| D005 | 財會部 | 5 |
| D006 | 人資部 | 6 |
| D007 | 總務部 | 7 |
| D008 | 客服部 | 8 |
| D009 | 法務部 | 9 |
| D010 | 資訊部 | 10 |

### 2.2 預設職位 (13個)

| 代碼 | 名稱 | 職等 | 說明 |
|------|------|------|------|
| P001 | 董事長 | 10 | 最高決策 |
| P002 | 執行長 | 9 | CEO |
| P003 | 總經理 | 9 | GM |
| P004 | 營運長 | 8 | COO |
| P005 | 財務長 | 8 | CFO |
| P006 | 副總經理 | 7 | VP |
| P007 | 協理 | 6 | AVP |
| P008 | 經理 | 5 | Manager |
| P009 | 副理 | 4 | Assistant Manager |
| P010 | 主任 | 3 | Supervisor |
| P011 | 組長 | 2 | Team Lead |
| P012 | 專員 | 1 | Specialist |
| P013 | 助理 | 0 | Assistant |

## 三、功能模組

### 3.1 公司管理模組

**功能：**
- 創建新公司/分公司
- 編輯公司資訊
- 停用/啟用公司
- 複製既有公司設定

**創建公司流程：**
1. 填寫基本資訊 (名稱、統編、地址...)
2. 選擇是否使用預設部門/職位
3. 選擇是否複製既有公司設定
4. 指定公司管理員
5. 確認創建

**API 路由：**
- `POST /api/trpc/company.create` - 創建公司
- `PUT /api/trpc/company.update` - 更新公司
- `POST /api/trpc/company.deactivate` - 停用公司
- `POST /api/trpc/company.copySettings` - 複製設定

### 3.2 用印申請模組

**用印類型：**
1. 公司大章 - 重要合約、官方文件
2. 公司小章 - 一般文件
3. 合約用印 - 合約簽署
4. 發票章 - 發票開立
5. 董事會印鑑 - 董事會決議
6. 銀行印鑑 - 銀行往來
7. 攜出印章 - 需攜出使用

**攜出追蹤流程：**
```
申請 → 審批 → 領取 → 攜出 → 歸還確認
                     ↓
                  逾期提醒 (每日檢查)
```

**API 路由：**
- `POST /api/trpc/seal.create` - 提交申請
- `GET /api/trpc/seal.list` - 查詢列表
- `POST /api/trpc/seal.return` - 確認歸還
- `GET /api/trpc/seal.overdue` - 逾期清單

### 3.3 公司證件借用模組

**證件類型：**
1. 營業執照
2. 稅務登記證
3. 組織機構代碼證
4. 開戶許可證
5. 公司章程
6. 股東名冊

**借用追蹤：**
- 借出時間
- 預計歸還時間
- 實際歸還時間
- 逾期自動提醒

### 3.4 名片申請模組

**功能：**
- 選擇名片模板
- 自動帶入員工資訊
- 自訂設計上傳
- 申請數量
- 歷史紀錄查詢

**名片資訊自動帶入：**
- 姓名 ← Employee.name
- 職稱 ← Position.name
- 電話 ← Company.phone
- 手機 ← Employee.mobile
- 信箱 ← Employee.email
- 地址 ← Company.address

### 3.5 文具/設備申請模組

**申請類型：**
1. 文具申請 - 筆、紙、文件夾等
2. 辦公設備申請 - 電腦、印表機等
3. 耗材申請 - 墨水、碳粉等

**申請流程：**
1. 選擇申請類型
2. 填寫品項明細
3. 選擇急迫程度
4. 提交審批
5. 採購處理
6. 交付確認

### 3.6 稽核日誌模組

**記錄範圍：**
- 所有資料的 CREATE / UPDATE / DELETE 操作
- 自動記錄：操作人、時間、IP、變更內容

**功能：**
- 依時間範圍查詢
- 依操作人查詢
- 依資料類型查詢
- 依公司查詢
- 匯出報表

**權限控制：**
- 需要 `AUDIT_LOG_VIEW` 權限才能檢視
- 稽核日誌本身不可編輯/刪除

## 四、權限設計

### 4.1 權限層級

```
Level 0: 集團級權限 (GroupPermission)
    ├── GROUP_ADMIN - 完整管理權
    ├── CROSS_COMPANY_VIEW - 跨公司檢視
    ├── CROSS_COMPANY_EDIT - 跨公司編輯
    ├── AUDIT_LOG_VIEW - 稽核日誌
    └── COMPANY_MANAGEMENT - 公司管理

Level 1: 模組級權限 (Module)
    ├── HR_MODULE - 人事模組
    ├── FINANCE_MODULE - 財務模組
    ├── SEAL_MODULE - 用印模組
    └── STATIONERY_MODULE - 文具模組

Level 2: 功能級權限 (Function)
    ├── SEAL_CREATE - 用印申請
    ├── SEAL_APPROVE - 用印審批
    ├── SEAL_MANAGE - 用印管理
    └── ...
```

### 4.2 權限檢查流程

```typescript
async function checkPermission(
  userId: string,
  action: string,
  targetCompanyId?: string
) {
  // 1. 檢查集團級權限
  const groupPerm = await checkGroupPermission(userId)
  if (groupPerm.includes('GROUP_ADMIN')) return true

  // 2. 檢查跨公司權限
  if (targetCompanyId && targetCompanyId !== userCompanyId) {
    if (!groupPerm.includes('CROSS_COMPANY_EDIT')) {
      throw new Error('無跨公司操作權限')
    }
  }

  // 3. 檢查模組權限
  const moduleEnabled = await checkModulePermission(userId, action)
  if (!moduleEnabled) throw new Error('無此模組權限')

  // 4. 檢查功能權限
  const functionEnabled = await checkFunctionPermission(userId, action)
  if (!functionEnabled) throw new Error('無此功能權限')

  return true
}
```

## 五、審批流程整合

### 5.1 審批流程類型

```typescript
enum ApprovalFlowCategory {
  SEAL_REQUEST        // 用印申請
  DOCUMENT_BORROW     // 證件借用
  BUSINESS_CARD       // 名片申請
  STATIONERY          // 文具申請
  EQUIPMENT           // 設備申請
}
```

### 5.2 與既有 ApprovalFlow 整合

沿用現有的 ApprovalFlow 系統：
- ApprovalFlow - 定義審批流程
- ApprovalStep - 定義審批步驟
- ApprovalRecord - 記錄審批紀錄

每個公司可自訂各類型申請的審批流程。

## 六、實施階段

### Phase 1: 公司管理 + 權限系統 (基礎)
- [ ] 更新 Prisma Schema
- [ ] 公司 CRUD API
- [ ] 集團級權限 API
- [ ] 稽核日誌中間件
- [ ] 公司管理頁面
- [ ] 權限管理頁面

### Phase 2: 用印/證件申請
- [ ] 用印申請 API
- [ ] 證件借用 API
- [ ] 攜出追蹤功能
- [ ] 逾期提醒排程
- [ ] 用印申請頁面
- [ ] 證件借用頁面

### Phase 3: 名片/文具申請
- [ ] 名片申請 API
- [ ] 文具申請 API
- [ ] 名片模板管理
- [ ] 名片申請頁面
- [ ] 文具申請頁面

### Phase 4: 稽核與報表
- [ ] 稽核日誌查詢 API
- [ ] 稽核日誌頁面
- [ ] 各類申請報表
- [ ] 統計儀表板

## 七、UI/UX 設計

### 7.1 導航結構

```
Dashboard
├── 人事管理 (HR)
│   ├── 員工管理
│   ├── 部門管理
│   └── 職位管理
├── 財務管理 (Finance)
│   ├── 會計作業
│   └── 傳票管理
├── 行政管理 (Admin) [新增]
│   ├── 用印申請
│   ├── 證件借用
│   ├── 名片申請
│   └── 文具申請
├── 系統管理 (System) [新增]
│   ├── 公司管理 (需集團權限)
│   ├── 權限管理
│   ├── 審批流程設定
│   └── 稽核日誌 (需特殊權限)
└── 個人中心
    ├── 我的申請
    └── 待我審批
```

### 7.2 申請流程 UI

```
[申請列表] → [新增申請] → [填寫表單] → [提交] → [審批中]
                                              ↓
[已完成] ← [處理中] ← [核准] ←─────────────────┘
```

## 八、技術實現重點

### 8.1 稽核日誌自動記錄

使用 Prisma Middleware 自動記錄：

```typescript
// lib/prisma.ts
prisma.$use(async (params, next) => {
  const result = await next(params)

  if (['create', 'update', 'delete'].includes(params.action)) {
    await createAuditLog({
      entityType: params.model,
      entityId: result.id,
      action: params.action.toUpperCase(),
      // ... 其他欄位
    })
  }

  return result
})
```

### 8.2 逾期檢查排程

使用 cron job 每日檢查逾期項目：

```typescript
// 每天早上 9:00 檢查
// 發送通知給：申請人、管理員
```

---

**文件版本:** 1.0
**建立日期:** 2026-01-15
**作者:** Claude Code
