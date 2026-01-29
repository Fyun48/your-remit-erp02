'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Settings2, X, ChevronDown } from 'lucide-react'
import { PWAInstallPrompt } from '@/components/pwa/pwa-install-prompt'
import { useMobileSidebar } from './mobile-sidebar-context'
import { PersonalizationModal } from '@/components/personalization'
import { getMenuItemById, findParentMenuByHref, MenuItem, defaultMenuItems, SubMenuItem } from '@/lib/sidebar-menu'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { trpc } from '@/lib/trpc'
import { checkMenuVisibility } from '@/hooks/use-permissions'

interface SidebarProps {
  groupName?: string
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { config, isLoaded, setConfig, setLoaded, setExpandedMenuId } = useSidebarStore()
  const [showSettings, setShowSettings] = useState(false)

  // 使用 store 中的 expandedMenuId
  const expandedMenuId = config.expandedMenuId

  const employeeId = (session?.user as { id?: string })?.id || ''

  // 載入使用者偏好設定
  const { data: preference } = trpc.userPreference.get.useQuery(
    { employeeId },
    { enabled: !!employeeId }
  )

  // 取得使用者主要公司
  const { data: assignments } = trpc.employee.getAssignments.useQuery(
    { employeeId },
    { enabled: !!employeeId }
  )
  const primaryCompanyId = assignments?.find(a => a.isPrimary)?.companyId

  // 取得使用者權限
  const { data: permissionData } = trpc.permission.getEmployeePermissions.useQuery(
    { employeeId, companyId: primaryCompanyId! },
    { enabled: !!employeeId && !!primaryCompanyId }
  )

  // 更新展開選單狀態的 mutation
  const updateExpandedMenuMutation = trpc.userPreference.updateExpandedMenu.useMutation()

  // 防抖計時器 ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 防抖保存展開狀態
  const saveExpandedMenu = useCallback((menuId: string | null) => {
    if (!employeeId) return

    // 清除之前的計時器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 設定新的計時器（500ms 後保存）
    debounceTimerRef.current = setTimeout(() => {
      updateExpandedMenuMutation.mutate({
        employeeId,
        expandedMenuId: menuId,
      })
    }, 500)
  }, [employeeId, updateExpandedMenuMutation])

  // 清理計時器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (preference && !isLoaded) {
      setConfig(preference.sidebarConfig)
      setLoaded(true)
    }
  }, [preference, isLoaded, setConfig, setLoaded])

  // 根據當前路徑自動展開對應的選單（僅在首次載入或路徑變更時）
  const hasInitializedRef = useRef(false)
  useEffect(() => {
    // 如果已載入偏好設定且有保存的展開狀態，優先使用保存的狀態
    if (isLoaded && config.expandedMenuId && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      return
    }

    // 否則根據當前路徑自動展開
    const parentMenuId = findParentMenuByHref(pathname)
    if (parentMenuId && parentMenuId !== expandedMenuId) {
      setExpandedMenuId(parentMenuId)
      // 如果是根據路徑自動展開，也要保存
      if (isLoaded) {
        saveExpandedMenu(parentMenuId)
      }
    }
  }, [pathname, isLoaded])

  // 根據設定和權限過濾並排序選單
  const visibleMenuItems = useMemo(() => {
    const userPermissions = permissionData?.permissions || []
    const isAdmin = permissionData?.isGroupAdmin || permissionData?.isCompanyManager || false

    return config.menuOrder
      .filter((id) => !config.hiddenMenus.includes(id))
      .map((id) => getMenuItemById(id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
      .filter((item) => {
        // 檢查權限可見性
        const { visible } = checkMenuVisibility(item.permission, userPermissions, isAdmin)
        return visible
      })
  }, [config.menuOrder, config.hiddenMenus, permissionData])

  // 手風琴模式：點擊展開/收合
  const handleMenuClick = (item: MenuItem, e: React.MouseEvent) => {
    if (item.children && item.children.length > 0) {
      e.preventDefault()
      // 手風琴模式：如果已展開則收合，否則展開並收合其他
      const newExpandedId = expandedMenuId === item.id ? null : item.id
      setExpandedMenuId(newExpandedId)
      // 保存到使用者偏好
      saveExpandedMenu(newExpandedId)
    }
  }

  // 取得個人專區的子選單（從 personalMenuItems）
  const getPersonalMenuChildren = useMemo((): SubMenuItem[] => {
    const personalItems = config.personalMenuItems || []
    if (personalItems.length === 0) return []

    const children: SubMenuItem[] = []
    for (const itemId of personalItems) {
      // 在所有主選單的 children 中尋找
      for (const menu of defaultMenuItems) {
        const child = menu.children?.find((c) => c.id === itemId)
        if (child) {
          children.push(child)
          break
        }
      }
    }
    return children
  }, [config.personalMenuItems])

  // 檢查選單是否有可見的子選單
  const hasVisibleChildren = (item: MenuItem) => {
    // 個人專區特殊處理：使用 personalMenuItems
    if (item.id === 'dashboard') {
      return getPersonalMenuChildren.length > 0
    }

    if (!item.children || item.children.length === 0) return false
    const userPermissions = permissionData?.permissions || []
    const isAdmin = permissionData?.isGroupAdmin || permissionData?.isCompanyManager || false

    return item.children.some(child => {
      if (!child.permission) return true
      const { visible } = checkMenuVisibility(child.permission, userPermissions, isAdmin)
      return visible
    })
  }

  // 過濾可見的子選單
  const getVisibleChildren = (item: MenuItem): SubMenuItem[] => {
    // 個人專區特殊處理：使用 personalMenuItems
    if (item.id === 'dashboard') {
      return getPersonalMenuChildren
    }

    if (!item.children) return []
    const userPermissions = permissionData?.permissions || []
    const isAdmin = permissionData?.isGroupAdmin || permissionData?.isCompanyManager || false

    return item.children.filter(child => {
      if (!child.permission) return true
      const { visible } = checkMenuVisibility(child.permission, userPermissions, isAdmin)
      return visible
    })
  }

  return (
    <>
      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const hasChildren = hasVisibleChildren(item)
          const isExpanded = expandedMenuId === item.id
          const visibleChildren = getVisibleChildren(item)

          // 判斷是否為當前選中的主選單
          const isParentActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/')

          // 如果有子選單，也要檢查子選單是否匹配
          const isChildActive = visibleChildren.some(
            child => pathname === child.href || pathname.startsWith(child.href + '/')
          )

          const isActive = isParentActive || isChildActive

          return (
            <div key={item.id}>
              {/* 主選單項目 */}
              {hasChildren ? (
                <button
                  onClick={(e) => handleMenuClick(item, e)}
                  className={cn(
                    'group flex items-center justify-between w-full rounded-md px-2 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-sidebar-foreground'
                  )}
                >
                  <div className="flex items-center">
                    <item.icon
                      className={cn(
                        'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                        isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-muted-foreground group-hover:text-sidebar-foreground'
                      )}
                    />
                    {item.name}
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      isExpanded ? 'rotate-180' : ''
                    )}
                  />
                </button>
              ) : (
                <Link
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
              )}

              {/* 子選單 */}
              {hasChildren && (
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200 ease-in-out',
                    isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                    {visibleChildren.map((child) => {
                      const isChildItemActive = pathname === child.href || pathname.startsWith(child.href + '/')
                      const ChildIcon = child.icon

                      return (
                        <Link
                          key={child.id}
                          href={child.href}
                          onClick={onNavigate}
                          className={cn(
                            'group flex items-center rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                            isChildItemActive
                              ? 'bg-sidebar-accent/70 text-sidebar-accent-foreground'
                              : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-sidebar-foreground'
                          )}
                        >
                          {ChildIcon && (
                            <ChildIcon
                              className={cn(
                                'mr-2 h-4 w-4 flex-shrink-0 transition-colors',
                                isChildItemActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-muted-foreground group-hover:text-sidebar-foreground'
                              )}
                            />
                          )}
                          {child.name}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
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
  const router = useRouter()

  const handleLogoClick = () => {
    router.push('/dashboard')
  }

  return (
    <>
      {/* 桌面版側邊欄 - 固定顯示 */}
      <div className="hidden md:flex h-full w-52 flex-col bg-sidebar">
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
          <button
            onClick={handleLogoClick}
            className="text-lg font-bold text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
          >
            {groupName}
          </button>
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
          <div className="fixed inset-y-0 left-0 w-56 flex flex-col bg-sidebar">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
              <button
                onClick={() => {
                  handleLogoClick()
                  close()
                }}
                className="text-lg font-bold text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
              >
                {groupName}
              </button>
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
