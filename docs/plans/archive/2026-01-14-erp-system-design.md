# 集團 ERP 系統設計文件

> 建立日期：2026-01-14
> 狀態：設計完成，待實作

## 1. 專案概述

### 1.1 目標
建立一套符合台灣法規的集團 ERP 系統，類似鼎新 COSMOS ERP，提供完整的人事、出勤、請假、審核流程及財務會計功能。

### 1.2 適用情境
- **集團類型**：中型集團（5-15 間公司，50-300 名員工）
- **員工關係**：員工可同時任職於多間公司
- **法規遵循**：台灣勞基法、商業會計法、IFRS 會計準則

### 1.3 核心功能模組
1. 人事資料與權限管理
2. 出勤打卡系統
3. 請假管理系統
4. 審核流程引擎
5. 財務會計系統

---

## 2. 系統架構

### 2.1 技術棧

```
┌─────────────────────────────────────────────────────────────────┐
│                        集團 ERP 系統                              │
├─────────────────────────────────────────────────────────────────┤
│  前端層                                                          │
│  ├── Next.js 14 Web App (管理後台 + 員工入口)                     │
│  │   └── React + TailwindCSS + shadcn/ui                        │
│  └── React Native App (iOS / Android)                           │
│      └── 共用 tRPC Client + 相同商業邏輯                          │
├─────────────────────────────────────────────────────────────────┤
│  API 層                                                          │
│  └── Next.js API Routes + tRPC                                  │
│      ├── 型別安全：前後端共享 TypeScript 型別                      │
│      ├── 驗證：Zod schema validation                             │
│      └── 認證：NextAuth.js + JWT                                 │
├─────────────────────────────────────────────────────────────────┤
│  資料層                                                          │
│  ├── PostgreSQL (主資料庫) + Prisma ORM                          │
│  ├── Redis (Session + 快取 + 即時通知佇列)                        │
│  └── Audit Log (所有異動自動記錄，含操作者、時間、變更內容)          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 關鍵設計決策

| 技術選擇 | 理由 |
|---------|------|
| tRPC | 確保 API 型別安全，Web 和 React Native 共用相同的 API client |
| Prisma | 型別安全的資料庫操作，支援 migration 和 schema 版本控制 |
| Redis | 處理 session 管理、快取熱資料（如：權限清單）、審核通知佇列 |
| Audit Log | 所有資料異動自動記錄，符合企業稽核需求 |

### 2.3 行動 App 功能範圍
- 幾乎所有功能都能在手機操作
- 僅系統管理設定限 Web 操作

---

## 3. 組織架構與權限模型

### 3.1 集團架構

```
Group (集團)
└── Company (公司) ─────────────────┐
    ├── Department (部門)            │
    │   └── Position (職位)          │  員工可同時任職
    └── Employee (員工) ◄────────────┘  多間公司
```

### 3.2 核心資料模型

#### Employee (員工主檔)
```
Employee
├── 基本資料：姓名、身分證、生日、性別
├── 聯絡資訊：Email、個人 Email、電話
├── 地址資訊：居住地地址、戶籍地址
├── 緊急聯絡：緊急聯絡人、緊急聯絡電話
├── 到職資訊：到職日、離職日、員工編號
└── 帳號資訊：登入帳號、密碼 hash、啟用狀態
```

#### EmployeeAssignment (任職關係)
```
EmployeeAssignment ── 多對多關聯
├── employee_id → 員工
├── company_id → 公司
├── department_id → 部門
├── position_id → 職位
├── supervisor_id → 直屬主管 (同公司內)
├── is_primary → 是否為主要任職公司
├── start_date / end_date → 任職期間
└── status → 在職/留停/離職
```

### 3.3 混合式權限模型

**權限計算公式：**
```
權限 = 角色權限 + 個人特殊權限 - 個人移除權限
```

#### Role (角色)
| 角色 | 說明 |
|-----|------|
| SUPER_ADMIN | 集團最高管理員 |
| COMPANY_ADMIN | 公司管理員 |
| MANAGER | 主管（可審核下屬） |
| EMPLOYEE | 一般員工 |

#### Permission (權限項目)
```
Permission
├── 功能權限：attendance.clock, leave.apply, expense.submit
├── 資料權限：view_department_data, view_company_data
└── 特殊權限：can_consult (照會), can_approve_seal (用印審核), attendance.exempt (免打卡)
```

#### EmployeePermission (個人權限調整)
```
EmployeePermission
├── employee_id + company_id + permission_id
├── grant_type: GRANT (授予) / REVOKE (移除)
└── granted_by + granted_at (誰授權、何時)
```

#### 權限檢查邏輯
```typescript
function hasPermission(employee, company, permission): boolean {
  // 1. 檢查個人是否被移除此權限
  if (hasRevoked(employee, company, permission)) return false

  // 2. 檢查個人是否被授予此權限
  if (hasGranted(employee, company, permission)) return true

  // 3. 檢查角色是否有此權限
  return roleHasPermission(employee.role, permission)
}
```

---

## 4. 出勤打卡模組

### 4.1 系統架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        出勤系統架構                               │
├─────────────────────────────────────────────────────────────────┤
│  班別設定                        打卡方式                         │
│  ├── 固定班：09:00-18:00        ├── GPS 定位打卡                 │
│  ├── 晚班：13:00-22:00          ├── IP 位址限制                  │
│  ├── 彈性班：核心 10:00-15:00    ├── 人臉辨識                     │
│  └── 自訂班別...                 └── Web/App 直接打卡             │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 班別設定模型

```
WorkShift (班別)
├── company_id → 所屬公司
├── name → 班別名稱（早班、晚班、彈性班）
├── shift_type → FIXED (固定) / FLEXIBLE (彈性)
│
├── 工作時間：
│   ├── work_start_time → 上班時間 09:00
│   └── work_end_time → 下班時間 18:00
│
├── 休息時段（可設定多段）：
│   └── breaks: [
│       {
│         name: "午休",
│         start_time: "12:00",
│         end_time: "13:30",
│         is_paid: false,        ← 是否計入工時
│         is_required: true      ← 是否強制休息
│       }
│     ]
│
├── 彈性班設定：
│   ├── core_start_time → 核心開始 10:00
│   ├── core_end_time → 核心結束 15:00
│   ├── flex_start_range → 最早可上班 07:00
│   ├── flex_end_range → 最晚可下班 20:00
│   └── required_hours → 每日應工作時數
│
├── 規則設定：
│   ├── late_grace_minutes → 遲到寬限（分鐘）
│   ├── early_leave_grace → 早退寬限（分鐘）
│   └── overtime_threshold → 加班起算門檻（分鐘）
│
└── work_days → 工作日 [1,2,3,4,5] (週一至週五)
```

#### ShiftBreak (班別休息時段)
```
ShiftBreak
├── shift_id → 所屬班別
├── name → 休息名稱（午休、下午茶、晚餐等）
├── start_time → 開始時間
├── end_time → 結束時間
├── is_paid → 是否計薪（是否算入工時）
├── is_required → 是否強制（強制時該時段不計遲到早退）
└── sort_order → 排序
```

#### ShiftAssignment (班別指派)
```
ShiftAssignment
├── employee_id + company_id
├── shift_id → 指派的班別
├── effective_date → 生效日
└── 可排班或長期指派
```

### 4.3 打卡紀錄模型

```
AttendanceRecord (打卡紀錄)
├── employee_id + company_id
├── date → 打卡日期
│
├── 上班打卡：
│   ├── clock_in_time → 實際打卡時間
│   ├── clock_in_method → GPS / IP / FACE / MANUAL
│   ├── clock_in_location → 打卡座標 (GPS 時記錄)
│   └── clock_in_ip → 打卡 IP (IP 限制時記錄)
│
├── 下班打卡：
│   ├── clock_out_time
│   ├── clock_out_method
│   ├── clock_out_location
│   └── clock_out_ip
│
├── 系統計算：
│   ├── status → NORMAL / LATE / EARLY_LEAVE / ABSENT / LEAVE / EXEMPT
│   ├── late_minutes → 遲到分鐘數
│   ├── early_leave_minutes → 早退分鐘數
│   ├── overtime_minutes → 加班分鐘數
│   └── work_hours → 實際工作時數
│
└── 補打卡：
    ├── is_amended → 是否為補打卡
    ├── amend_reason → 補打卡原因
    └── approved_by → 補打卡核准人
```

### 4.4 打卡驗證規則

```
ClockInRule (打卡規則)
├── company_id
├── rule_type → GPS / IP / FACE / TIME_RANGE
│
├── GPS 規則：
│   ├── allowed_locations → [{lat, lng, radius_meters}]
│   └── accuracy_threshold → 定位精確度要求
│
├── IP 規則：
│   └── allowed_ip_ranges → ["192.168.1.0/24", ...]
│
└── 時間規則：
    ├── earliest_clock_in → 最早可打上班卡時間
    └── latest_clock_out → 最晚可打下班卡時間
```

### 4.5 免打卡機制

擁有 `attendance.exempt` 權限的員工不需要打卡：

```typescript
function requiresClockIn(employee, company): boolean {
  if (hasPermission(employee, company, "attendance.exempt")) {
    return false
  }
  return true
}

function getDailyAttendanceStatus(employee, company, date): Status {
  if (hasPermission(employee, company, "attendance.exempt")) {
    return "EXEMPT"  // 免打卡
  }
  return calculateFromClockRecords(employee, company, date)
}
```

### 4.6 出勤狀態

| 狀態 | 說明 |
|-----|------|
| NORMAL | 正常出勤 |
| LATE | 遲到 |
| EARLY_LEAVE | 早退 |
| ABSENT | 曠職 |
| LEAVE | 請假 |
| EXEMPT | 免打卡 |

---

## 5. 請假模組

### 5.1 系統架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        請假系統架構                               │
├─────────────────────────────────────────────────────────────────┤
│  假別管理                        請假規則                         │
│  ├── 法定假別（勞基法）           ├── 需填事由 / 免填事由           │
│  ├── 公司自訂假                  ├── 需附證明 / 免附證明            │
│  └── 特殊假別                    └── 可折現 / 不可折現              │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 假別設定模型

```
LeaveType (假別)
├── company_id → 所屬公司 (NULL = 集團共用法定假別)
├── code → 假別代碼 (ANNUAL, SICK, PERSONAL, ...)
├── name → 假別名稱
├── category → STATUTORY (法定) / COMPANY (公司自訂)
│
├── 請假規則：
│   ├── requires_reason → 是否需填事由
│   │   (特休、生日假 = false；事假、病假 = true)
│   ├── requires_attachment → 是否需附件
│   ├── attachment_after_days → 超過幾天需附證明
│   │   (例：病假超過3天需醫生證明)
│   └── min_unit → 最小請假單位 (HOUR / HALF_DAY / DAY)
│
├── 額度規則：
│   ├── quota_type → FIXED (固定) / SENIORITY (年資) / UNLIMITED
│   ├── annual_quota → 年度額度（天或小時）
│   ├── quota_calculation → 年資計算公式 (特休用)
│   ├── can_carry_over → 可否遞延至下年度
│   ├── carry_over_limit → 遞延上限
│   ├── can_cash_out → 可否折現
│   └── cash_out_rate → 折現費率
│
├── 使用限制：
│   ├── advance_days_required → 需提前幾天申請
│   ├── max_consecutive_days → 連續請假上限
│   ├── gender_restriction → 性別限制 (產假、陪產假)
│   └── applicable_after_days → 到職滿幾天可請
│
└── is_active → 是否啟用
```

### 5.3 台灣法定假別預設值

| 假別 | 額度 | 需事由 | 需證明 | 最小單位 | 備註 |
|-----|------|--------|--------|---------|------|
| 特休 | 依年資 3-30天 | ✗ | ✗ | 小時 | 可折現 |
| 事假 | 14天/年 | ✓ | ✗ | 小時 | 不計薪 |
| 病假 | 30天/年 | ✓ | 超過3天 | 小時 | 半薪 |
| 生理假 | 12天/年 | ✗ | ✗ | 天 | 女性 |
| 婚假 | 8天 | ✓ | 結婚證書 | 天 | 一次性 |
| 喪假 | 3-8天依親等 | ✓ | 訃聞 | 天 | 一次性 |
| 產假 | 8週 | ✓ | 醫生證明 | 天 | 女性 |
| 陪產假 | 7天 | ✓ | 出生證明 | 天 | 男性 |
| 公傷假 | 依實際需要 | ✓ | 醫生證明 | 天 | 全薪 |
| 公假 | 依實際需要 | ✓ | 證明文件 | 天 | 全薪 |

### 5.4 特休年資計算（勞基法）

```typescript
function calculateAnnualLeave(seniorityMonths: number): number {
  if (seniorityMonths < 6) return 0
  if (seniorityMonths < 12) return 3
  if (seniorityMonths < 24) return 7
  if (seniorityMonths < 36) return 10
  if (seniorityMonths < 60) return 14
  if (seniorityMonths < 120) return 15
  // 滿10年後每年加1天，最多30天
  const extraYears = Math.floor((seniorityMonths - 120) / 12)
  return Math.min(15 + extraYears, 30)
}
```

### 5.5 請假申請模型

```
LeaveRequest (請假申請)
├── employee_id + company_id
├── leave_type_id → 假別
├── date_range:
│   ├── start_date → 開始日期
│   ├── start_period → FULL_DAY / AM / PM / HOUR
│   ├── end_date → 結束日期
│   ├── end_period → FULL_DAY / AM / PM / HOUR
│   └── total_hours → 總請假時數（系統計算）
│
├── 申請內容：
│   ├── reason → 請假事由（依假別可能為必填或選填）
│   ├── attachments → 附件（診斷證明、結婚證書等）
│   └── proxy_employee_id → 職務代理人
│
├── 狀態：
│   ├── status → DRAFT / PENDING / APPROVED / REJECTED / CANCELLED
│   ├── submitted_at → 送出時間
│   └── processed_at → 處理完成時間
│
└── 銷假紀錄（若提前返回）：
    ├── actual_end_date
    └── cancelled_hours
```

### 5.6 假別餘額模型

```
LeaveBalance (假別餘額)
├── employee_id + company_id
├── leave_type_id → 假別
├── year → 年度
│
├── 額度：
│   ├── entitled_hours → 本年度應有額度
│   ├── carried_hours → 上年度遞延額度
│   ├── adjusted_hours → 人工調整（正負皆可）
│   └── total_available → 總可用額度
│
├── 使用：
│   ├── used_hours → 已使用時數
│   ├── pending_hours → 審核中時數
│   └── remaining_hours → 剩餘可用
│
└── 折現（年底）：
    ├── cashed_out_hours → 已折現時數
    └── cash_out_amount → 折現金額
```

---

## 6. 審核流程模組

### 6.1 系統架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        審核流程引擎                               │
├─────────────────────────────────────────────────────────────────┤
│  申請類型              審核鏈                    照會機制          │
│  ├── 請假申請          ├── 層級簽核              ├── 會簽確認      │
│  ├── 支出申請          ├── 特定關卡              └── 不影響結果    │
│  ├── 用印/證件申請     └── 混合模式                               │
│  └── 文具/名片申請                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 審核流程設定模型

```
ApprovalFlow (審核流程定義)
├── company_id → 所屬公司
├── flow_type → 申請類型
│   ├── LEAVE → 請假
│   ├── EXPENSE → 支出申請
│   ├── SEAL → 用印/證件申請
│   └── SUPPLIES → 文具/名片申請
│
├── name → 流程名稱
├── description → 流程說明
│
├── 觸發條件（可選）：
│   ├── amount_threshold → 金額門檻（支出申請用）
│   ├── leave_type_ids → 適用假別（請假用）
│   └── condition_expression → 自訂條件表達式
│
└── is_active → 是否啟用
```

#### ApprovalFlowStep (審核關卡)
```
ApprovalFlowStep
├── flow_id → 所屬流程
├── step_order → 關卡順序 (1, 2, 3...)
├── name → 關卡名稱（直屬主管、部門經理、財務審核）
│
├── 審核者設定：
│   ├── approver_type → 審核者類型
│   │   ├── SUPERVISOR → 直屬主管
│   │   ├── DEPARTMENT_HEAD → 部門主管
│   │   ├── SPECIFIC_ROLE → 特定角色
│   │   ├── SPECIFIC_EMPLOYEE → 指定員工
│   │   └── PERMISSION_HOLDER → 擁有特定權限者
│   │
│   ├── approver_role → 指定角色（當 type = SPECIFIC_ROLE）
│   ├── approver_employee_id → 指定員工
│   └── required_permission → 需要的權限（當 type = PERMISSION_HOLDER）
│
├── 規則：
│   ├── can_skip_if_same → 若與上一關同人可跳過
│   ├── auto_approve_after_days → 超過幾天自動核准（0=不自動）
│   └── is_required → 是否必要關卡
│
└── sort_order → 排序
```

### 6.3 預設審核流程範例

**請假申請流程：**
```
Step 1: 直屬主管 (SUPERVISOR)
→ 核准後完成
```

**支出申請流程（金額 < 10,000）：**
```
Step 1: 直屬主管 (SUPERVISOR)
Step 2: 財務審核 (PERMISSION_HOLDER: expense.finance_review)
→ 核准後完成
```

**支出申請流程（金額 >= 10,000）：**
```
Step 1: 直屬主管 (SUPERVISOR)
Step 2: 部門主管 (DEPARTMENT_HEAD)
Step 3: 財務審核 (PERMISSION_HOLDER: expense.finance_review)
Step 4: 總經理 (SPECIFIC_ROLE: GENERAL_MANAGER)
→ 核准後完成
```

**用印/證件申請流程：**
```
Step 1: 直屬主管 (SUPERVISOR)
Step 2: 管理部/法務 (PERMISSION_HOLDER: seal.admin_review)
→ 核准後完成
```

### 6.4 申請單模型

#### ApprovalRequest (申請單通用)
```
ApprovalRequest
├── request_no → 申請單號（自動產生）
├── request_type → 申請類型 (EXPENSE / SEAL / SUPPLIES)
├── employee_id → 申請人
├── company_id → 申請公司（必選）
│
├── 狀態：
│   ├── status → DRAFT / PENDING / APPROVED / REJECTED / RETURNED
│   ├── current_step → 目前關卡
│   └── submitted_at → 送出時間
│
└── 時間戳記：
    ├── created_at
    └── updated_at
```

#### ExpenseRequest (支出申請)
```
ExpenseRequest
├── request_id → 關聯申請單
├── expense_type → 支出類型（交通、餐費、住宿、其他）
├── amount → 金額
├── currency → 幣別 (TWD)
├── expense_date → 支出日期
├── description → 說明
├── attachments → 收據/發票附件
└── payment_method → 付款方式（請款/代墊）
```

#### SealRequest (用印/證件申請)
```
SealRequest
├── request_id → 關聯申請單
├── seal_type → 類型
│   ├── COMPANY_SEAL → 公司大章
│   ├── INVOICE_SEAL → 發票章
│   └── DOCUMENT → 證件（公司登記、營業執照等）
│
├── purpose → 用途說明
├── document_description → 文件說明
├── quantity → 份數
├── expected_date → 預計使用日期
│
├── 攜出設定：
│   ├── requires_carry_out → 是否需攜出印章
│   ├── carry_out_reason → 攜出原因
│   └── expected_return_date → 預計歸還日期
│
├── 發放紀錄：
│   ├── issued_by → 發放人員
│   ├── issued_at → 發放時間
│   └── issue_remarks → 發放備註
│
└── 歸還狀態：
    ├── return_status → NOT_REQUIRED / PENDING / RETURNED
    ├── applicant_returned_at → 申請人按下「已歸還」時間
    ├── applicant_return_remarks → 申請人備註
    ├── issuer_confirmed_at → 發放者確認歸還時間
    ├── issuer_confirmed_by → 確認人員
    ├── issuer_confirm_remarks → 確認備註
    └── actual_returned_at → 最終歸還時間（系統自動記錄）
```

#### SuppliesRequest (文具/名片申請)
```
SuppliesRequest
├── request_id → 關聯申請單
├── supplies_type → STATIONERY (文具) / BUSINESS_CARD (名片)
│
├── 文具申請：
│   └── items: [{item_name, quantity, specification}]
│
├── 名片申請：
│   ├── name_on_card → 名片姓名
│   ├── title_on_card → 名片職稱
│   ├── phone → 電話
│   ├── email → Email
│   ├── quantity → 盒數
│   └── design_template → 設計樣式
│
└── remarks → 備註
```

### 6.5 審核紀錄模型

```
ApprovalRecord (審核紀錄)
├── request_id → 申請單
├── step_id → 審核關卡
├── approver_id → 審核者
│
├── 審核結果：
│   ├── action → APPROVE / REJECT / RETURN
│   │   ├── APPROVE → 核准（進入下一關或完成）
│   │   ├── REJECT → 拒絕（結案，不需事由）
│   │   └── RETURN → 退回（要求更正，必須填事由）
│   │
│   ├── comment → 審核意見
│   │   └── RETURN 時為必填，APPROVE/REJECT 為選填
│   └── acted_at → 審核時間
│
└── attachments → 審核附件（如有）
```

### 6.6 照會機制

```
ApprovalConsultation (照會)
├── request_id → 申請單
├── initiated_by → 發起照會者（需有 can_consult 權限）
├── consulted_employee_id → 被照會者（可照會該公司任一員工）
│
├── 照會內容：
│   ├── message → 照會訊息
│   └── requested_at → 發起時間
│
├── 回覆：
│   ├── response → 回覆內容
│   ├── responded_at → 回覆時間
│   └── status → PENDING / RESPONDED
│
└── 備註：照會不影響審核結果，僅供參考
```

### 6.7 審核流程狀態機

```
                ┌─────────────┐
                │   DRAFT     │ 草稿
                └──────┬──────┘
                       │ 送出申請
                       ▼
                ┌─────────────┐
      ┌────────│   PENDING   │←──────┐
      │        └──────┬──────┘       │
      │               │              │
REJECT│        APPROVE│        RETURN│ (需填事由)
      │               │              │
      ▼               ▼              │
┌─────────────┐ ┌─────────────┐      │
│  REJECTED   │ │ 下一關卡？   │──────┘
└─────────────┘ └──────┬──────┘ 還有 → 繼續 PENDING
                       │ 沒有了
                       ▼
               ┌─────────────┐
               │  APPROVED   │ 核准完成
               └─────────────┘
```

### 6.8 印章歸還流程

```
印章攜出申請核准後：

┌─────────────────────────────────────────────────────────────────┐
│                        歸還流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌─────────────┐                                              │
│    │   PENDING   │ 待歸還（印章已發放攜出）                        │
│    └──────┬──────┘                                              │
│           │                                                     │
│     ┌─────┴─────┐                                               │
│     │           │                                               │
│     ▼           ▼                                               │
│  申請人        發放者                                             │
│  按「已歸還」   按「已歸還」                                        │
│     │           │                                               │
│     ▼           │                                               │
│  通知發放者     │                                                │
│  確認歸還       │                                                │
│     │           │                                               │
│     ▼           ▼                                               │
│  發放者確認 ───→ 系統自動記錄時間                                  │
│     │           │                                               │
│     └─────┬─────┘                                               │
│           ▼                                                     │
│    ┌─────────────┐                                              │
│    │  RETURNED   │ 已歸還（記錄完成時間）                          │
│    └─────────────┘                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**情境 A：申請人主動回報**
1. 申請人按「已歸還」→ 記錄 applicant_returned_at
2. 系統通知發放者
3. 發放者按「確認歸還」→ 記錄 issuer_confirmed_at
4. 狀態變更為 RETURNED，actual_returned_at = issuer_confirmed_at

**情境 B：發放者主動確認**
1. 發放者收到印章後直接按「已歸還」
2. 記錄 issuer_confirmed_at
3. 狀態直接變更為 RETURNED，actual_returned_at = issuer_confirmed_at
4. 申請人無需再操作

---

## 7. 財務會計模組

### 7.1 系統架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        財務會計系統                               │
├─────────────────────────────────────────────────────────────────┤
│  會計基礎                        財務報表                         │
│  ├── 會計科目表 (IFRS)           ├── 資產負債表                   │
│  ├── 傳票管理                    ├── 損益表                       │
│  ├── 分錄記錄                    ├── 現金流量表                   │
│  └── 期末結帳                    └── 科目餘額表 / 試算表           │
├─────────────────────────────────────────────────────────────────┤
│  日常作業                        稅務相關                         │
│  ├── 應收帳款                    ├── 營業稅申報                   │
│  ├── 應付帳款                    ├── 扣繳憑單                     │
│  └── 費用報支                    └── 發票管理                     │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 會計科目表模型（符合 IFRS）

```
AccountChart (會計科目表)
├── company_id → 所屬公司
├── code → 科目代碼（如：1101、2101、4101）
├── name → 科目名稱
│
├── 科目分類：
│   ├── category → 類別
│   │   ├── ASSET → 資產 (1xxx)
│   │   ├── LIABILITY → 負債 (2xxx)
│   │   ├── EQUITY → 權益 (3xxx)
│   │   ├── REVENUE → 收入 (4xxx)
│   │   ├── EXPENSE → 費用 (5xxx)
│   │   └── OTHER → 其他 (6xxx)
│   │
│   ├── account_type → 科目性質
│   │   ├── DEBIT → 借方科目
│   │   └── CREDIT → 貸方科目
│   │
│   └── level → 科目層級（1=大類, 2=中類, 3=明細）
│
├── 階層關係：
│   ├── parent_id → 上層科目
│   └── is_detail → 是否為明細科目（僅明細可過帳）
│
├── 控制設定：
│   ├── is_active → 是否啟用
│   ├── is_system → 是否系統科目（不可刪除）
│   └── requires_aux → 是否需要輔助核算（客戶/供應商）
│
└── 期初設定：
    └── opening_balance → 期初餘額
```

### 7.3 預設科目表結構（部分）

| 代碼 | 名稱 | 類別 | 性質 | 層級 |
|-----|------|------|------|-----|
| 1 | 資產 | ASSET | DEBIT | 1 |
| 11 | 流動資產 | ASSET | DEBIT | 2 |
| 1101 | 現金及約當現金 | ASSET | DEBIT | 3 |
| 1102 | 銀行存款 | ASSET | DEBIT | 3 |
| 1103 | 應收帳款 | ASSET | DEBIT | 3 |
| 1104 | 預付款項 | ASSET | DEBIT | 3 |
| 2 | 負債 | LIABILITY | CREDIT | 1 |
| 21 | 流動負債 | LIABILITY | CREDIT | 2 |
| 2101 | 應付帳款 | LIABILITY | CREDIT | 3 |
| 2102 | 應付薪資 | LIABILITY | CREDIT | 3 |
| 2103 | 應付稅捐 | LIABILITY | CREDIT | 3 |
| 3 | 權益 | EQUITY | CREDIT | 1 |
| 31 | 股本 | EQUITY | CREDIT | 2 |
| 32 | 保留盈餘 | EQUITY | CREDIT | 2 |
| 4 | 收入 | REVENUE | CREDIT | 1 |
| 41 | 營業收入 | REVENUE | CREDIT | 2 |
| 4101 | 銷貨收入 | REVENUE | CREDIT | 3 |
| 4102 | 服務收入 | REVENUE | CREDIT | 3 |
| 5 | 費用 | EXPENSE | DEBIT | 1 |
| 51 | 營業成本 | EXPENSE | DEBIT | 2 |
| 52 | 營業費用 | EXPENSE | DEBIT | 2 |
| 5201 | 薪資支出 | EXPENSE | DEBIT | 3 |
| 5202 | 租金支出 | EXPENSE | DEBIT | 3 |
| 5203 | 交通費 | EXPENSE | DEBIT | 3 |
| 5204 | 文具用品 | EXPENSE | DEBIT | 3 |

### 7.4 傳票模型

```
Voucher (傳票)
├── company_id → 所屬公司
├── voucher_no → 傳票號碼（自動編號）
├── voucher_date → 傳票日期
│
├── 傳票類型：
│   ├── voucher_type →
│   │   ├── RECEIPT → 收款傳票
│   │   ├── PAYMENT → 付款傳票
│   │   └── TRANSFER → 轉帳傳票
│   │
│   └── source_type → 來源類型
│       ├── MANUAL → 人工輸入
│       ├── EXPENSE → 費用報支（自動產生）
│       ├── AR → 應收帳款
│       ├── AP → 應付帳款
│       └── PAYROLL → 薪資（未來擴充）
│
├── 傳票狀態：
│   ├── status → DRAFT / PENDING / POSTED / VOID
│   │   ├── DRAFT → 草稿
│   │   ├── PENDING → 待審核
│   │   ├── POSTED → 已過帳
│   │   └── VOID → 作廢
│   │
│   └── posted_at → 過帳時間
│
├── 內容：
│   ├── description → 摘要說明
│   ├── total_debit → 借方合計
│   ├── total_credit → 貸方合計
│   └── attachments → 附件（原始單據）
│
├── 關聯：
│   ├── source_id → 來源單據 ID（如：費用報支單）
│   └── period_id → 所屬會計期間
│
└── 稽核：
    ├── created_by → 製單人
    ├── approved_by → 審核人
    └── posted_by → 過帳人
```

#### VoucherLine (傳票分錄)
```
VoucherLine
├── voucher_id → 所屬傳票
├── line_no → 行號
├── account_id → 會計科目
│
├── 金額：
│   ├── debit_amount → 借方金額
│   └── credit_amount → 貸方金額
│   （每行只能有借方或貸方，不可同時有值）
│
├── 說明：
│   └── description → 分錄說明
│
└── 輔助核算（選填）：
    ├── customer_id → 客戶（應收類科目）
    ├── vendor_id → 供應商（應付類科目）
    └── department_id → 部門（費用類科目）
```

### 7.5 會計期間模型

```
AccountingPeriod (會計期間)
├── company_id → 所屬公司
├── year → 會計年度
├── period → 期間（1-12 月）
├── start_date → 開始日期
├── end_date → 結束日期
│
├── 狀態：
│   ├── status → OPEN / CLOSED / LOCKED
│   │   ├── OPEN → 開放（可過帳）
│   │   ├── CLOSED → 已結帳（可重開）
│   │   └── LOCKED → 已鎖定（不可變更）
│   │
│   └── closed_at → 結帳時間
│
└── 結帳檢查：
    └── closing_balance → 結帳餘額快照
```

### 7.6 應收帳款模型

```
Customer (客戶主檔)
├── company_id → 所屬公司
├── code → 客戶編號
├── name → 客戶名稱
├── tax_id → 統一編號
├── contact_info → 聯絡資訊
├── payment_terms → 付款條件（天數）
└── credit_limit → 信用額度

AccountReceivable (應收帳款)
├── company_id → 所屬公司
├── customer_id → 客戶
├── ar_no → 應收單號
├── ar_date → 應收日期
├── due_date → 到期日
│
├── 金額：
│   ├── amount → 應收金額
│   ├── paid_amount → 已收金額
│   └── balance → 未收餘額
│
├── 狀態：
│   └── status → OPEN / PARTIAL / PAID / VOID
│
├── 發票資訊：
│   ├── invoice_no → 發票號碼
│   └── invoice_date → 發票日期
│
└── voucher_id → 關聯傳票
```

### 7.7 應付帳款模型

```
Vendor (供應商主檔)
├── company_id → 所屬公司
├── code → 供應商編號
├── name → 供應商名稱
├── tax_id → 統一編號
├── contact_info → 聯絡資訊
├── payment_terms → 付款條件
└── bank_info → 銀行帳戶資訊（付款用）

AccountPayable (應付帳款)
├── company_id → 所屬公司
├── vendor_id → 供應商
├── ap_no → 應付單號
├── ap_date → 應付日期
├── due_date → 到期日
│
├── 金額：
│   ├── amount → 應付金額
│   ├── paid_amount → 已付金額
│   └── balance → 未付餘額
│
├── 狀態：
│   └── status → OPEN / PARTIAL / PAID / VOID
│
├── 發票資訊：
│   ├── invoice_no → 進項發票號碼
│   └── invoice_date → 發票日期
│
└── voucher_id → 關聯傳票
```

### 7.8 費用報支整合

費用報支核准後自動產生：
1. 應付帳款（若為請款）
2. 傳票分錄：
   - 借：交通費 / 餐費 / 其他費用（依類型）
   - 貸：應付帳款 / 現金（依付款方式）

### 7.9 財務報表產出

```
FinancialReport (財務報表)
├── 資產負債表 (Balance Sheet)
│   ├── 資產總計
│   ├── 負債總計
│   └── 權益總計（資產 - 負債）
│
├── 損益表 (Income Statement)
│   ├── 營業收入
│   ├── 營業成本
│   ├── 營業毛利
│   ├── 營業費用
│   ├── 營業利益
│   ├── 營業外收支
│   └── 本期淨利
│
├── 試算表 (Trial Balance)
│   ├── 各科目借方餘額
│   ├── 各科目貸方餘額
│   └── 借貸平衡檢查
│
└── 科目餘額表 (Account Balance)
    ├── 期初餘額
    ├── 本期借方發生額
    ├── 本期貸方發生額
    └── 期末餘額
```

### 7.10 稅務相關

```
TaxRecord (稅務紀錄)
├── company_id → 所屬公司
├── tax_type → 稅別
│   ├── SALES_TAX → 營業稅
│   ├── WITHHOLDING → 扣繳稅款
│   └── INCOME_TAX → 營所稅
│
├── period → 申報期間
├── amount → 稅額
├── status → PENDING / FILED / PAID
└── filed_at → 申報時間

Invoice (發票管理)
├── company_id → 所屬公司
├── invoice_type → OUTPUT (銷項) / INPUT (進項)
├── invoice_no → 發票號碼
├── invoice_date → 發票日期
│
├── 金額：
│   ├── amount → 未稅金額
│   ├── tax_amount → 稅額
│   └── total_amount → 含稅金額
│
├── 對象：
│   ├── customer_id → 客戶（銷項）
│   └── vendor_id → 供應商（進項）
│
└── 申報：
    ├── tax_period → 申報期間
    └── is_reported → 是否已申報
```

---

## 8. 通知系統

### 8.1 通知類型

| 類型 | 觸發時機 |
|-----|---------|
| 審核通知 | 有新的待審核申請 |
| 核准通知 | 申請被核准 |
| 拒絕通知 | 申請被拒絕 |
| 退回通知 | 申請被退回要求更正 |
| 照會通知 | 被他人照會 |
| 印章歸還通知 | 申請人回報已歸還，通知發放者確認 |
| 出勤異常通知 | 遲到超過設定門檻 |

### 8.2 通知管道

- App 推播通知
- 系統內通知（Web + App）
- Email（可選配置）

---

## 9. 稽核日誌

### 9.1 記錄內容

所有資料異動自動記錄：
- 操作者（employee_id）
- 操作時間（timestamp）
- 操作類型（CREATE / UPDATE / DELETE）
- 變更前資料（old_value）
- 變更後資料（new_value）
- 來源 IP
- 來源裝置（Web / iOS / Android）

### 9.2 資料模型

```
AuditLog
├── table_name → 異動的資料表
├── record_id → 異動的記錄 ID
├── action → CREATE / UPDATE / DELETE
├── old_value → JSON（變更前）
├── new_value → JSON（變更後）
├── employee_id → 操作者
├── ip_address → 來源 IP
├── user_agent → 裝置資訊
└── created_at → 操作時間
```

---

## 10. 設計彈性

### 10.1 設定層面（不需改程式碼）
- 審核流程關卡可隨時新增、調整、停用
- 假別規則可修改（天數、是否需事由等）
- 班別設定可調整
- 權限可隨時授予或移除

### 10.2 資料模型層面（需改程式碼，但影響小）
- 新增欄位
- 調整流程
- Prisma migration 可追蹤所有資料庫變更

### 10.3 功能模組層面（較大改動）
- 新增申請類型
- 新增整合功能
- 模組化設計讓擴充相對容易

### 10.4 設計原則
```
核心邏輯 → 寫在程式碼
業務規則 → 存在資料庫（可後台調整）
```

---

## 11. 未來擴充（暫不實作）

以下功能在初版不實作，但架構已預留擴充空間：

- 銀行串接（薪資轉帳、費用撥款）
- 政府申報整合（勞健保、所得稅、營業稅）
- 電子發票串接（財政部平台）
- 打卡硬體整合（門禁系統）
- 薪資計算模組

---

## 12. 附錄

### 12.1 名詞對照

| 中文 | 英文 | 說明 |
|-----|------|------|
| 集團 | Group | 最上層組織 |
| 公司 | Company | 集團下的子公司 |
| 部門 | Department | 公司內的部門 |
| 職位 | Position | 職稱 |
| 任職關係 | EmployeeAssignment | 員工與公司的多對多關聯 |
| 班別 | WorkShift | 上下班時間設定 |
| 照會 | Consultation | 審核過程中的會簽確認 |
| 傳票 | Voucher | 會計憑證 |
| 分錄 | Journal Entry | 借貸記錄 |

### 12.2 狀態碼對照

**申請單狀態：**
| 狀態 | 說明 |
|-----|------|
| DRAFT | 草稿 |
| PENDING | 審核中 |
| APPROVED | 已核准 |
| REJECTED | 已拒絕 |
| RETURNED | 已退回 |
| CANCELLED | 已取消 |

**出勤狀態：**
| 狀態 | 說明 |
|-----|------|
| NORMAL | 正常 |
| LATE | 遲到 |
| EARLY_LEAVE | 早退 |
| ABSENT | 曠職 |
| LEAVE | 請假 |
| EXEMPT | 免打卡 |

**傳票狀態：**
| 狀態 | 說明 |
|-----|------|
| DRAFT | 草稿 |
| PENDING | 待審核 |
| POSTED | 已過帳 |
| VOID | 作廢 |
