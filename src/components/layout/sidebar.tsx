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
import { getMenuItemById } from '@/lib/sidebar-menu'
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
          // 儀表板只有完全匹配時才高亮，其他頁面支援子路徑匹配
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-sidebar-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                  isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-muted-foreground group-hover:text-sidebar-foreground'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* 底部按鈕區 */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 w-full px-2 py-2 text-sm text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-sidebar-foreground rounded-md transition-colors"
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
      <div className="hidden md:flex h-full w-64 flex-col bg-sidebar">
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-foreground">{groupName} ERP</h1>
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
          <div className="fixed inset-y-0 left-0 w-64 flex flex-col bg-sidebar">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
              <h1 className="text-xl font-bold text-sidebar-foreground">{groupName} ERP</h1>
              <button
                onClick={close}
                className="text-sidebar-muted-foreground hover:text-sidebar-foreground p-1 transition-colors"
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
