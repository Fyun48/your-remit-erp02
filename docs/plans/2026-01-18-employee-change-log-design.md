# 員工異動紀錄與相關功能設計

> **建立日期:** 2026-01-18
> **狀態:** 已確認，待實作

---

## 概述

本設計涵蓋以下功能：
1. 員工列表顯示離職員工的篩選功能
2. 員工復職功能
3. 員工異動紀錄系統（事件導向）
4. 異動紀錄總表（含排序、刪除權限）
5. SUPER_ADMIN 超級管理員權限
6. Audit 篩選介面與設定開關
7. 佈景主題閃爍修復

---

## 第 1 部分：資料模型

### 1.1 新增 EmployeeChangeLog 表格

```prisma
model EmployeeChangeLog {
  id           String   @id @default(cuid())
  employeeId   String
  employee     Employee @relation(fields: [employeeId], references: [id])

  changeType   ChangeType  // 異動類型
  changeDate   DateTime    // 異動生效日期

  // 異動前後的資料（nullable，因為入職時沒有「前」）
  fromCompanyId    String?
  fromDepartmentId String?
  fromPositionId   String?
  toCompanyId      String?
  toDepartmentId   String?
  toPositionId     String?

  reason       String?     // 異動原因
  note         String?     // 備註

  createdById  String      // 建立者（操作人）
  createdBy    Employee    @relation("ChangeLogCreator", fields: [createdById], references: [id])
  createdAt    DateTime    @default(now())

  @@index([employeeId, changeDate])
  @@index([changeType])
  @@index([createdAt])
  @@map("employee_change_logs")
}

enum ChangeType {
  ONBOARD           // 入職
  OFFBOARD          // 離職
  REINSTATE         // 復職
  TRANSFER          // 調動
  ON_LEAVE          // 留停
  RETURN_FROM_LEAVE // 留停復職
}
```

### 1.2 新增 SUPER_ADMIN 權限

在 `GroupPermissionType` enum 中新增：
```prisma
enum GroupPermissionType {
  GROUP_ADMIN
  SUPER_ADMIN  // 新增：超級管理員
}
```

顯示名稱對照：
- `SUPER_ADMIN` → 「超級管理員」
- `GROUP_ADMIN` → 「集團管理員」

### 1.3 新增特殊權限類型

在 `EmployeePermission` 可授予的權限中新增：
- `DELETE_CHANGE_LOG` → 「刪除異動紀錄」

---

## 第 2 部分：員工列表與復職功能

### 2.1 員工列表改進

**預設行為變更：**
- `page.tsx` 查詢時根據 `showResigned` 參數決定是否包含離職員工
- 預設只查詢 `status: 'ACTIVE'` 和 `status: 'ON_LEAVE'`

**UI 新增：**
- 篩選區右上角加入 Checkbox：「顯示已離職員工」
- 勾選狀態透過 URL query 參數傳遞（支援分享連結）
- 員工導航（上/下一位、總數）跟隨此設定

**修改檔案：**
- `src/app/dashboard/hr/employees/page.tsx`
- `src/app/dashboard/hr/employees/employee-list.tsx`
- `src/app/dashboard/hr/employees/[id]/page.tsx`

### 2.2 復職功能

**入口：**
- 離職員工詳情頁顯示「復職」按鈕

**復職 Dialog 欄位：**
- 復職日期（必填）
- 公司（預設：離職前公司）
- 部門（預設：離職前部門）
- 職位（預設：離職前職位）
- 直屬主管（可選）
- 備註（可選）

**後端處理流程：**
1. 建立新的 `EmployeeAssignment`（status: ACTIVE, isPrimary: true）
2. 更新 `Employee.isActive = true`
3. 清除 `Employee.resignDate`（或保留歷史，另議）
4. 新增 `EmployeeChangeLog`（changeType: REINSTATE）

**修改檔案：**
- `src/app/dashboard/hr/employees/[id]/employee-detail.tsx`
- `src/server/routers/hr.ts`

---

## 第 3 部分：異動紀錄總表

### 3.1 頁面設計

**路徑：** `/dashboard/hr/change-logs`

**權限：** GROUP_ADMIN 以上

**欄位：**
| 欄位 | 說明 | 可排序 |
|------|------|--------|
| 員工編號 | employee.employeeNo | ✓ |
| 員工姓名 | employee.name | ✓ |
| 異動類型 | changeType（中文顯示） | ✓ |
| 異動日期 | changeDate | ✓ |
| 原部門 | fromDepartment.name | - |
| 新部門 | toDepartment.name | - |
| 原職位 | fromPosition.name | - |
| 新職位 | toPosition.name | - |
| 原因 | reason | - |
| 操作人 | createdBy.name | ✓ |
| 建立時間 | createdAt | ✓ |
| 操作 | 刪除按鈕（權限控制） | - |

**篩選功能：**
- 異動類型（多選）
- 日期範圍
- 員工搜尋

**排序功能：**
- 點擊欄位標題切換升/降序
- 預設按建立時間降序

### 3.2 刪除權限

**可刪除者：**
- 擁有 `SUPER_ADMIN` 集團權限者
- 被授予 `DELETE_CHANGE_LOG` 特殊權限者

**刪除行為：**
- 硬刪除（從資料庫移除）
- 不記錄到 Audit Log

**修改檔案：**
- 新增 `src/app/dashboard/hr/change-logs/page.tsx`
- 新增 `src/app/dashboard/hr/change-logs/change-log-list.tsx`
- 新增 `src/server/routers/changeLog.ts`

---

## 第 4 部分：Audit 功能改進

### 4.1 Audit 篩選介面

**改進現有頁面：** `/dashboard/system/audit`

**新增篩選條件：**
- 操作類型：CREATE / UPDATE / DELETE（多選）
- 模組：員工、請假、報銷、用印、財務等（多選）
- 日期範圍：起始日 ~ 結束日
- 操作人：下拉選擇或搜尋

### 4.2 Audit 設定開關

**路徑：** `/dashboard/settings/audit`

**權限：** 僅 SUPER_ADMIN

**功能：**
- 列出所有可被 Audit 的操作類型
- 每個操作類型有開關（啟用/停用）
- 設定儲存至資料庫（新增 AuditSetting model 或使用 SystemSetting）

**建議預設值：**
- 查看類操作：預設關閉
- 新增/修改/刪除類操作：預設開啟

---

## 第 5 部分：佈景主題閃爍修復

### 5.1 問題分析

目前流程：
1. Server 渲染 `data-theme="classic"`
2. Client 載入後，ThemeProvider 從 API 取得用戶偏好
3. 套用用戶主題 → 造成閃爍

### 5.2 Cookie 方案

**修改點：**

1. **選擇主題時寫入 Cookie**
   - 檔案：`src/components/personalization/personalization-modal.tsx`
   - 選擇主題後：`document.cookie = \`theme=${theme}; path=/; max-age=31536000\``

2. **Server 端讀取 Cookie**
   - 檔案：`src/app/layout.tsx`
   - 使用 `cookies()` from `next/headers` 讀取 theme cookie
   - 動態設定 `<html data-theme={theme}>`

3. **ThemeProvider 同步**
   - 保留現有邏輯作為備援
   - 用戶變更主題時同時更新 cookie

**修改檔案：**
- `src/app/layout.tsx`
- `src/components/personalization/personalization-modal.tsx`
- `src/components/providers/theme-provider.tsx`

---

## 實作順序建議

1. **Phase 0：主題閃爍修復**（獨立，可先做）
2. **Phase 1：資料模型更新**
   - 新增 ChangeType enum
   - 新增 EmployeeChangeLog model
   - 新增 SUPER_ADMIN 權限
   - 執行 db:push
3. **Phase 2：員工列表篩選**
   - 修改查詢邏輯
   - 新增「顯示已離職員工」checkbox
4. **Phase 3：復職功能**
   - 新增復職 API
   - 新增復職 Dialog UI
5. **Phase 4：異動紀錄整合**
   - 在現有操作（入職、離職、調動、留停）中加入 ChangeLog 記錄
6. **Phase 5：異動紀錄總表**
   - 新增頁面與 API
   - 實作排序、篩選、刪除
7. **Phase 6：Audit 功能改進**
   - 篩選介面
   - 設定開關

---

## 驗證方式

1. `npm run build` 確保無編譯錯誤
2. 測試員工列表篩選離職員工
3. 測試復職流程
4. 測試異動紀錄是否正確產生
5. 測試異動紀錄總表排序、刪除
6. 測試主題切換無閃爍
