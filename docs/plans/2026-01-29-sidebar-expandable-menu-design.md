# 側邊欄可展開選單設計

## 概述

將側邊欄從單層扁平式設計改為可展開的兩層選單結構，並新增選單設定管理功能，讓管理員可以配置選單歸屬，員工可以自訂個人專區。

## 需求

### 核心功能
1. 點擊主選單展開/收合子選單，點擊子項目才導航
2. 記住展開狀態，儲存到使用者偏好設定
3. 手風琴模式：同一時間只能展開一個主選單
4. 點擊側邊欄頂部「xxxx集團」回到個人專區首頁

### 選單設定管理（系統設定 > 選單設定）
1. 可設定主選單下要擁有哪些子選單
2. 自動納入未來新增的功能（新選單名稱）
3. 鎖定選單：報表中心、系統管理、系統設定的子選單不可透過介面變更
4. 子選單可勾選獨立顯示在側邊欄

### 個人化設定改進
1. 以樹狀結構展開顯示使用者有權限的選單
2. 可選擇子選單加入個人專區
3. 個人專區可展開顯示自選的子選單
4. 個人專區主頁自動顯示對應的功能卡片

## 選單架構

### 主選單與預設子選單配置

| 主選單 | 子選單 | 可調整 |
|--------|--------|--------|
| 個人專區 | （使用者自選） | 個人化 |
| 人事管理 | 員工管理、部門管理、職位管理、班別管理、假別設定、假別餘額、員工異動、離職/復職、職務代理、薪資管理、組織圖、出勤管理、請假管理、費用核銷 | 是 |
| 協作管理 | 內部訊息、專案管理 | 是 |
| 行銷企劃 | （暫無） | 是 |
| 行政管理 | 用印申請、名片申請、文具管理、流程管理、審核中心 | 是 |
| 財務會計 | 會計科目表、會計期間、傳票管理、客戶管理、供應商管理 | 是 |
| 報表中心 | （由程式定義） | **鎖定** |
| 系統管理 | （由程式定義） | **鎖定** |
| 系統設定 | （由程式定義）+ 選單設定 | **鎖定** |

## 資料庫結構

### MenuConfig（選單配置）
```prisma
model MenuConfig {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  menuId    String   // 主選單 ID
  menuName  String   // 顯示名稱
  sortOrder Int      @default(0)
  isLocked  Boolean  @default(false)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  subMenus SubMenuConfig[]

  @@unique([companyId, menuId])
  @@map("menu_configs")
}
```

### SubMenuConfig（子選單配置）
```prisma
model SubMenuConfig {
  id            String      @id @default(cuid())
  companyId     String
  company       Company     @relation(fields: [companyId], references: [id])
  parentMenuId  String?
  parentMenu    MenuConfig? @relation(fields: [parentMenuId], references: [id])
  subMenuId     String      // 子選單 ID
  subMenuName   String      // 顯示名稱
  href          String      // 連結路徑
  sortOrder     Int         @default(0)
  isIndependent Boolean     @default(false) // 獨立顯示在側邊欄
  isSystem      Boolean     @default(false) // 系統自動偵測新增
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([companyId, subMenuId])
  @@map("sub_menu_configs")
}
```

### UserPreference 擴充
```prisma
// 新增欄位
personalMenuItems  Json?  // 個人專區的子選單 ID 陣列
personalMenuOrder  Json?  // 個人專區子選單排序
expandedMenuId     String? // 記住展開的主選單 ID
```

## 實作階段

### 第一階段：基礎展開選單
1. 修改 `sidebar-menu.ts` 資料結構支援子選單
2. 修改 `Sidebar` 元件實現展開/收合功能
3. 實現手風琴模式
4. 點擊集團名稱回首頁
5. 展開狀態記憶

### 第二階段：選單設定管理
1. 建立資料庫表
2. 建立「選單設定」管理頁面
3. 實現拖曳排序、歸屬調整功能
4. 鎖定選單機制

### 第三階段：個人化專區
1. 擴充 UserPreference 資料結構
2. 改進「個人化設定」介面
3. 改造「個人專區」主頁功能卡片
4. 個人專區子選單展開功能

### 第四階段：自動偵測新功能
1. 建立頁面掃描機制
2. 新功能自動加入子選單池

## 手機版與 PWA 體驗

- 手風琴模式確保選單長度可控
- 子選單縮排 16px，使用較小字體區分層級
- 選單項目高度 40px 以上確保觸控友好
- 展開時平滑動畫過渡
- 展開子選單時自動滾動確保內容可見

## 建立日期
2026-01-29
