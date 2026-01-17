# Phase 1: 側邊欄個人化 - 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 實作側邊欄功能項目的顯示/隱藏與拖曳排序功能，設定儲存於伺服器資料庫實現跨裝置同步。

**Architecture:** 新增 UserPreference 資料表儲存使用者個人化設定。建立 tRPC router 處理設定的 CRUD。重構 Sidebar 元件支援動態排序與顯示控制，使用 @dnd-kit 實現拖曳功能。

**Tech Stack:** Prisma, tRPC, React, @dnd-kit/core, @dnd-kit/sortable, Zustand

---

## Task 1: 安裝依賴套件

**Files:**
- Modify: `package.json`

**Step 1: 安裝 @dnd-kit 拖曳套件**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: 確認安裝成功**

Run: `npm ls @dnd-kit/core`
Expected: 顯示已安裝版本

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @dnd-kit for drag and drop"
```

---

## Task 2: 建立 UserPreference 資料模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 在 schema.prisma 末尾新增 UserPreference 模型**

在檔案末尾加入：

```prisma
// ==================== 使用者偏好設定 ====================

model UserPreference {
  id         String   @id @default(cuid())
  employeeId String   @unique
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  // 側邊欄設定 JSON: { menuOrder: string[], hiddenMenus: string[] }
  sidebarConfig Json?

  // 主題設定 JSON: { theme: string }
  themeConfig Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("user_preferences")
}
```

**Step 2: 更新 Employee 模型，加入 preference 關聯**

在 `model Employee` 區塊內加入：

```prisma
  preference UserPreference?
```

**Step 3: 執行 Prisma 推送**

Run: `npm run db:push`
Expected: "Your database is now in sync with your Prisma schema"

**Step 4: 產生 Prisma Client**

Run: `npm run db:generate`
Expected: "Generated Prisma Client"

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add UserPreference model for personalization"
```

---

## Task 3: 建立側邊欄選單定義檔

**Files:**
- Create: `src/lib/sidebar-menu.ts`

**Step 1: 建立選單定義檔**

```typescript
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  FileText,
  Settings,
  Receipt,
  BarChart3,
  BookOpen,
  Building2,
  Stamp,
  Network,
  Workflow,
  LucideIcon,
} from 'lucide-react'

export interface MenuItem {
  id: string
  name: string
  href: string
  icon: LucideIcon
  permission?: string // 對應權限代碼，undefined 表示所有人可見
}

// 預設選單順序
export const defaultMenuItems: MenuItem[] = [
  { id: 'dashboard', name: '儀表板', href: '/dashboard', icon: LayoutDashboard },
  { id: 'hr', name: '人事管理', href: '/dashboard/hr', icon: Users, permission: 'hr.view' },
  { id: 'organization', name: '組織圖', href: '/dashboard/organization', icon: Network, permission: 'org.view' },
  { id: 'workflow', name: '流程管理', href: '/dashboard/workflow', icon: Workflow, permission: 'workflow.view' },
  { id: 'attendance', name: '出勤管理', href: '/dashboard/attendance', icon: Clock },
  { id: 'leave', name: '請假管理', href: '/dashboard/leave', icon: Calendar },
  { id: 'expense', name: '費用報銷', href: '/dashboard/expense', icon: Receipt },
  { id: 'approval', name: '審核中心', href: '/dashboard/approval', icon: FileText },
  { id: 'finance', name: '財務會計', href: '/dashboard/finance', icon: BookOpen, permission: 'finance.view' },
  { id: 'admin', name: '行政管理', href: '/dashboard/admin', icon: Stamp, permission: 'admin.view' },
  { id: 'reports', name: '報表中心', href: '/dashboard/reports', icon: BarChart3, permission: 'reports.view' },
  { id: 'system', name: '系統管理', href: '/dashboard/system', icon: Building2, permission: 'system.admin' },
  { id: 'settings', name: '系統設定', href: '/dashboard/settings', icon: Settings, permission: 'settings.view' },
]

// 取得預設選單 ID 順序
export const getDefaultMenuOrder = (): string[] => {
  return defaultMenuItems.map((item) => item.id)
}

// 根據 ID 取得選單項目
export const getMenuItemById = (id: string): MenuItem | undefined => {
  return defaultMenuItems.find((item) => item.id === id)
}
```

**Step 2: Commit**

```bash
git add src/lib/sidebar-menu.ts
git commit -m "feat: add sidebar menu definition file"
```

---

## Task 4: 建立 userPreference tRPC Router

**Files:**
- Create: `src/server/routers/userPreference.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 userPreference router**

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { getDefaultMenuOrder } from '@/lib/sidebar-menu'

// 側邊欄設定 schema
const sidebarConfigSchema = z.object({
  menuOrder: z.array(z.string()),
  hiddenMenus: z.array(z.string()),
})

export const userPreferenceRouter = router({
  // 取得使用者偏好設定
  get: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const preference = await ctx.prisma.userPreference.findUnique({
        where: { employeeId: input.employeeId },
      })

      // 如果沒有設定，回傳預設值
      if (!preference) {
        return {
          sidebarConfig: {
            menuOrder: getDefaultMenuOrder(),
            hiddenMenus: [],
          },
          themeConfig: {
            theme: 'classic',
          },
        }
      }

      return {
        sidebarConfig: preference.sidebarConfig as {
          menuOrder: string[]
          hiddenMenus: string[]
        } || {
          menuOrder: getDefaultMenuOrder(),
          hiddenMenus: [],
        },
        themeConfig: preference.themeConfig as { theme: string } || {
          theme: 'classic',
        },
      }
    }),

  // 更新側邊欄設定
  updateSidebar: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      sidebarConfig: sidebarConfigSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userPreference.upsert({
        where: { employeeId: input.employeeId },
        update: {
          sidebarConfig: input.sidebarConfig,
        },
        create: {
          employeeId: input.employeeId,
          sidebarConfig: input.sidebarConfig,
        },
      })
    }),

  // 還原側邊欄預設設定
  resetSidebar: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const defaultConfig = {
        menuOrder: getDefaultMenuOrder(),
        hiddenMenus: [],
      }

      return ctx.prisma.userPreference.upsert({
        where: { employeeId: input.employeeId },
        update: {
          sidebarConfig: defaultConfig,
        },
        create: {
          employeeId: input.employeeId,
          sidebarConfig: defaultConfig,
        },
      })
    }),
})
```

**Step 2: 註冊 router 到 _app.ts**

在 `src/server/routers/_app.ts` 加入：

import 區塊加入：
```typescript
import { userPreferenceRouter } from './userPreference'
```

router 區塊加入：
```typescript
  userPreference: userPreferenceRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/userPreference.ts src/server/routers/_app.ts
git commit -m "feat(api): add userPreference router for sidebar settings"
```

---

## Task 5: 建立側邊欄設定 Store

**Files:**
- Create: `src/stores/use-sidebar-store.ts`

**Step 1: 建立 Zustand store**

```typescript
import { create } from 'zustand'
import { getDefaultMenuOrder } from '@/lib/sidebar-menu'

interface SidebarConfig {
  menuOrder: string[]
  hiddenMenus: string[]
}

interface SidebarStore {
  // 設定狀態
  config: SidebarConfig
  isLoaded: boolean

  // 操作
  setConfig: (config: SidebarConfig) => void
  updateMenuOrder: (menuOrder: string[]) => void
  toggleMenuVisibility: (menuId: string) => void
  resetToDefault: () => void
  setLoaded: (loaded: boolean) => void
}

const defaultConfig: SidebarConfig = {
  menuOrder: getDefaultMenuOrder(),
  hiddenMenus: [],
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  config: defaultConfig,
  isLoaded: false,

  setConfig: (config) => set({ config, isLoaded: true }),

  updateMenuOrder: (menuOrder) =>
    set((state) => ({
      config: { ...state.config, menuOrder },
    })),

  toggleMenuVisibility: (menuId) =>
    set((state) => {
      const hiddenMenus = state.config.hiddenMenus.includes(menuId)
        ? state.config.hiddenMenus.filter((id) => id !== menuId)
        : [...state.config.hiddenMenus, menuId]
      return {
        config: { ...state.config, hiddenMenus },
      }
    }),

  resetToDefault: () => set({ config: defaultConfig }),

  setLoaded: (loaded) => set({ isLoaded: loaded }),
}))
```

**Step 2: Commit**

```bash
git add src/stores/use-sidebar-store.ts
git commit -m "feat: add sidebar zustand store for state management"
```

---

## Task 6: 建立側邊欄設定面板元件

**Files:**
- Create: `src/components/personalization/sidebar-settings.tsx`

**Step 1: 建立設定面板元件**

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { defaultMenuItems, getMenuItemById } from '@/lib/sidebar-menu'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { cn } from '@/lib/utils'

interface SortableItemProps {
  id: string
  isHidden: boolean
  onToggle: () => void
}

function SortableItem({ id, isHidden, onToggle }: SortableItemProps) {
  const menuItem = getMenuItemById(id)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (!menuItem) return null

  const Icon = menuItem.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-white border rounded-lg',
        isDragging && 'opacity-50 shadow-lg',
        isHidden && 'opacity-60'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <Icon className={cn('h-5 w-5', isHidden ? 'text-gray-400' : 'text-gray-600')} />
      <span className={cn('flex-1 text-sm font-medium', isHidden && 'text-gray-400')}>
        {menuItem.name}
      </span>
      <button
        onClick={onToggle}
        className={cn(
          'p-1.5 rounded-md transition-colors',
          isHidden
            ? 'text-gray-400 hover:bg-gray-100'
            : 'text-blue-600 hover:bg-blue-50'
        )}
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

interface SidebarSettingsProps {
  onSave: () => void
  onCancel: () => void
  isSaving?: boolean
}

export function SidebarSettings({ onSave, onCancel, isSaving }: SidebarSettingsProps) {
  const { config, updateMenuOrder, toggleMenuVisibility, resetToDefault } = useSidebarStore()
  const [localOrder, setLocalOrder] = useState<string[]>(config.menuOrder)

  useEffect(() => {
    setLocalOrder(config.menuOrder)
  }, [config.menuOrder])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = localOrder.indexOf(active.id as string)
      const newIndex = localOrder.indexOf(over.id as string)
      const newOrder = arrayMove(localOrder, oldIndex, newIndex)
      setLocalOrder(newOrder)
      updateMenuOrder(newOrder)
    }
  }

  const handleReset = () => {
    resetToDefault()
    setLocalOrder(defaultMenuItems.map((item) => item.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">側邊欄設定</h3>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          還原預設
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        拖曳調整順序，點擊眼睛圖示顯示/隱藏功能
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {localOrder.map((id) => (
              <SortableItem
                key={id}
                id={id}
                isHidden={config.hiddenMenus.includes(id)}
                onToggle={() => toggleMenuVisibility(id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? '儲存中...' : '儲存'}
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/personalization/sidebar-settings.tsx
git commit -m "feat(ui): add sidebar settings panel with drag and drop"
```

---

## Task 7: 建立個人化設定彈窗

**Files:**
- Create: `src/components/personalization/personalization-modal.tsx`

**Step 1: 建立彈窗元件**

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SidebarSettings } from './sidebar-settings'
import { LayoutList, Palette } from 'lucide-react'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { trpc } from '@/lib/trpc'

interface PersonalizationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
}

export function PersonalizationModal({
  open,
  onOpenChange,
  employeeId,
}: PersonalizationModalProps) {
  const [activeTab, setActiveTab] = useState('sidebar')
  const { config } = useSidebarStore()

  const updateSidebar = trpc.userPreference.updateSidebar.useMutation({
    onSuccess: () => {
      onOpenChange(false)
    },
  })

  const handleSaveSidebar = () => {
    updateSidebar.mutate({
      employeeId,
      sidebarConfig: config,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>個人化設定</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sidebar" className="flex items-center gap-2">
              <LayoutList className="h-4 w-4" />
              側邊欄
            </TabsTrigger>
            <TabsTrigger value="theme" className="flex items-center gap-2" disabled>
              <Palette className="h-4 w-4" />
              佈景主題
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sidebar" className="mt-4">
            <SidebarSettings
              onSave={handleSaveSidebar}
              onCancel={() => onOpenChange(false)}
              isSaving={updateSidebar.isPending}
            />
          </TabsContent>

          <TabsContent value="theme" className="mt-4">
            <p className="text-muted-foreground text-center py-8">
              佈景主題功能即將推出
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: 建立 index 匯出檔**

建立 `src/components/personalization/index.ts`：

```typescript
export { SidebarSettings } from './sidebar-settings'
export { PersonalizationModal } from './personalization-modal'
```

**Step 3: Commit**

```bash
git add src/components/personalization/
git commit -m "feat(ui): add personalization modal with tabs"
```

---

## Task 8: 重構 Sidebar 元件

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: 更新 Sidebar 使用新的選單系統**

完整替換 `src/components/layout/sidebar.tsx`：

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Settings2, X } from 'lucide-react'
import { PWAInstallPrompt } from '@/components/pwa/pwa-install-prompt'
import { useMobileSidebar } from './mobile-sidebar-context'
import { PersonalizationModal } from '@/components/personalization'
import { defaultMenuItems, getMenuItemById } from '@/lib/sidebar-menu'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { trpc } from '@/lib/trpc'

interface SidebarProps {
  groupName?: string
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { config, isLoaded, setConfig, setLoaded } = useSidebarStore()
  const [showSettings, setShowSettings] = useState(false)

  const employeeId = (session?.user as { id?: string })?.id || ''

  // 載入使用者偏好設定
  const { data: preference } = trpc.userPreference.get.useQuery(
    { employeeId },
    { enabled: !!employeeId }
  )

  useEffect(() => {
    if (preference && !isLoaded) {
      setConfig(preference.sidebarConfig)
      setLoaded(true)
    }
  }, [preference, isLoaded, setConfig, setLoaded])

  // 根據設定過濾並排序選單
  const visibleMenuItems = config.menuOrder
    .filter((id) => !config.hiddenMenus.includes(id))
    .map((id) => getMenuItemById(id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined)

  return (
    <>
      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center rounded-md px-2 py-2 text-sm font-medium',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* 底部按鈕區 */}
      <div className="border-t border-gray-800 p-4 space-y-2">
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors"
        >
          <Settings2 className="h-5 w-5" />
          個人化設定
        </button>
        <PWAInstallPrompt />
      </div>

      {/* 個人化設定彈窗 */}
      <PersonalizationModal
        open={showSettings}
        onOpenChange={setShowSettings}
        employeeId={employeeId}
      />
    </>
  )
}

export function Sidebar({ groupName = '集團' }: SidebarProps) {
  const { isOpen, close } = useMobileSidebar()

  return (
    <>
      {/* 桌面版側邊欄 - 固定顯示 */}
      <div className="hidden md:flex h-full w-64 flex-col bg-gray-900">
        <div className="flex h-16 items-center justify-center border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">{groupName} ERP</h1>
        </div>
        <SidebarContent />
      </div>

      {/* 手機版側邊欄 - 覆蓋層 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={close}
          />
          {/* 側邊欄 */}
          <div className="fixed inset-y-0 left-0 w-64 flex flex-col bg-gray-900">
            <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
              <h1 className="text-xl font-bold text-white">{groupName} ERP</h1>
              <button
                onClick={close}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <SidebarContent onNavigate={close} />
          </div>
        </div>
      )}
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(ui): integrate personalization into sidebar"
```

---

## Task 9: 建置測試與驗證

**Step 1: 執行 TypeScript 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 2: 執行 ESLint**

Run: `npm run lint`
Expected: 無錯誤或僅有警告

**Step 3: 執行建置**

Run: `npm run build`
Expected: 建置成功

**Step 4: 啟動開發伺服器測試**

Run: `npm run dev`

手動測試項目：
1. 登入系統後，側邊欄正常顯示
2. 點擊「個人化設定」按鈕，彈窗正常開啟
3. 拖曳選單項目，順序即時改變
4. 點擊眼睛圖示，項目顯示/隱藏
5. 點擊「還原預設」，恢復預設順序
6. 點擊「儲存」，設定儲存成功
7. 重新整理頁面，設定保持

**Step 5: 最終 Commit**

```bash
git add .
git commit -m "feat: complete Phase 1 sidebar personalization"
```

---

## 完成檢查清單

- [ ] @dnd-kit 套件安裝完成
- [ ] UserPreference 資料模型建立完成
- [ ] userPreference tRPC router 建立完成
- [ ] sidebar-menu.ts 選單定義檔建立完成
- [ ] use-sidebar-store.ts Zustand store 建立完成
- [ ] SidebarSettings 拖曳元件建立完成
- [ ] PersonalizationModal 彈窗元件建立完成
- [ ] Sidebar 元件重構完成
- [ ] TypeScript 型別檢查通過
- [ ] ESLint 檢查通過
- [ ] 建置成功
- [ ] 手動功能測試通過
