# ERP 系統強化設計文件

> **建立日期**: 2025-01-18
> **狀態**: 待實作
> **優先級**: Phase 1 - 上線必備

---

## 一、權限系統（混合模式）

### 1.1 控管分類

| 分類 | 模組 | 行為 |
|------|------|------|
| **嚴格控管** | finance.*, system.*, reports.*, settings.* | 無權限 = 隱藏選單 |
| **可見限制** | hr.*, workflow.*, admin.* | 顯示選單，無權限顯示提示 |
| **完全開放** | dashboard, attendance.clock, leave.apply, expense.apply, message.use, approval.view_own, org.view | 所有員工可用 |

### 1.2 實作檔案

- `src/components/layout/sidebar.tsx` - 選單過濾邏輯
- `src/hooks/use-permissions.ts` - 權限檢查 hook（新增）
- `src/components/ui/permission-guard.tsx` - 權限守衛元件（新增）
- 各頁面 `page.tsx` - 加入權限檢查

### 1.3 權限守衛元件

```tsx
// 用於頁面層級保護
<PermissionGuard
  permission="hr.view"
  fallback={<NoPermissionCard />}
>
  <HRContent />
</PermissionGuard>
```

---

## 二、財務報表系統

### 2.1 核心報表清單

| 報表 | 路徑 | 圖表支援 |
|------|------|----------|
| 試算表 | /finance/reports/trial-balance | 無 |
| 資產負債表 | /finance/reports/balance-sheet | 圓餅/長條 |
| 損益表 | /finance/reports/income-statement | 圓餅/長條 |
| 現金流量表 | /finance/reports/cash-flow | 瀑布/長條 |

### 2.2 稅務申報報表

| 報表 | 路徑 | 輸出格式 |
|------|------|----------|
| 401 銷售額與稅額申報書 | /finance/tax/vat-401 | PDF + 媒體檔 |
| 進銷項發票明細 | /finance/tax/invoice-detail | Excel/PDF |
| 扣繳憑單彙總 | /finance/tax/withholding | PDF + 媒體檔 |

### 2.3 報表共用功能

- 期間選擇器（月/季/年/自訂）
- 公司切換（多公司權限者）
- 歷年比較（並排 2-3 年）
- 圖表切換（圓餅/長條/瀑布）
- 列印功能（A4 格式）
- 匯出功能（PDF/Excel）

### 2.4 列印格式規範

```
┌─────────────────────────────────────────────┐
│  [公司名稱]                                 │
│  [報表名稱]                                 │
│  民國 XXX 年 XX 月 XX 日                    │
├─────────────────────────────────────────────┤
│  [報表內容]                                 │
├─────────────────────────────────────────────┤
│  製表人:______  覆核:______  主管:______    │
│  列印日期: YYYY/MM/DD                       │
└─────────────────────────────────────────────┘
```

### 2.5 401 報表結構

```
營業人銷售額與稅額申報書 (401)

一、銷項
  1. 應稅銷售額（稅率5%）
  2. 零稅率銷售額
  3. 免稅銷售額
  4. 銷項稅額合計

二、進項
  1. 進貨及費用（稅率5%）
  2. 固定資產（稅率5%）
  3. 進項稅額合計

三、稅額計算
  應納（溢付）稅額 = 銷項稅額 - 進項稅額
```

---

## 三、LINE 整合管理

### 3.1 系統設定頁面

路徑: `/dashboard/system/integrations/line`

**功能：**
- Channel ID 輸入
- Channel Secret 輸入（密碼遮罩）
- Callback URL 顯示（自動產生）
- 測試連線按鈕
- 設定說明折疊卡片

### 3.2 資料儲存

使用 `SystemSetting` 表儲存：
- `line.channel_id` - Channel ID
- `line.channel_secret` - Channel Secret（加密）
- `line.enabled` - 啟用狀態

### 3.3 修改 line.ts router

從 DB 讀取設定取代環境變數：
```typescript
const getLineConfig = async () => {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: 'line.' } }
  })
  return {
    channelId: settings.find(s => s.key === 'line.channel_id')?.value,
    channelSecret: decrypt(settings.find(s => s.key === 'line.channel_secret')?.value),
  }
}
```

---

## 四、用印申請列印功能

### 4.1 列印格式

- 紙張大小：A4 或中一刀（可選）
- 內容：申請單完整資訊 + 簽核流程
- 頁尾：列印日期、頁碼

### 4.2 列印按鈕位置

審核完成後的申請詳情頁，新增「列印」按鈕

### 4.3 列印內容

```
┌─────────────────────────────────────────────┐
│           用 印 申 請 單                    │
│                                             │
│  申請編號: SR-2025-0001                     │
│  申請日期: 2025/01/18                       │
│  申請人: 王小明 / 業務部                    │
├─────────────────────────────────────────────┤
│  印章類型: □公司章 ☑合約章 □發票章         │
│  用印事由: 合約用印                         │
│  文件名稱: 客戶合作協議書                   │
│  用印份數: 2 份                             │
├─────────────────────────────────────────────┤
│  簽核流程:                                  │
│  ☑ 部門主管 - 李經理 - 2025/01/18 核准     │
│  ☑ 總經理 - 張總 - 2025/01/18 核准         │
├─────────────────────────────────────────────┤
│  列印日期: 2025/01/18                       │
└─────────────────────────────────────────────┘
```

---

## 五、實作順序

### Phase 1A（權限 + 報表基礎）
1. 權限系統混合模式
2. usePermissions hook
3. PermissionGuard 元件
4. Sidebar 權限過濾

### Phase 1B（財務報表）
5. 試算表頁面
6. 資產負債表頁面（含圖表）
7. 損益表頁面（含圖表）
8. 現金流量表頁面
9. 報表列印/匯出功能

### Phase 1C（稅務報表）
10. 401 申報書頁面
11. 進銷項明細
12. 媒體申報檔產生

### Phase 1D（整合 + 列印）
13. LINE 整合設定 UI
14. 用印申請列印功能

---

## 六、驗收標準

- [ ] 一般員工登入只看到基本功能選單
- [ ] 財務人員可操作所有財務報表
- [ ] 報表可切換圓餅/長條圖
- [ ] 報表可匯出 PDF/Excel
- [ ] 401 報表可產生媒體申報檔
- [ ] LINE 設定 UI 可正常儲存並啟用
- [ ] 用印申請可列印 A4 格式
