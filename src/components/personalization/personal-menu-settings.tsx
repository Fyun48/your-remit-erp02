'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronDown, ChevronRight, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { defaultMenuItems, getMenuItemById } from '@/lib/sidebar-menu'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { cn } from '@/lib/utils'

interface PersonalMenuSettingsProps {
  onSave: () => void
  onCancel: () => void
  isSaving?: boolean
  userPermissions?: string[]
  isAdmin?: boolean
}

export function PersonalMenuSettings({
  onSave,
  onCancel,
  isSaving,
  userPermissions = [],
  isAdmin = false,
}: PersonalMenuSettingsProps) {
  const { config, setPersonalMenuItems } = useSidebarStore()
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())
  const [localSelectedItems, setLocalSelectedItems] = useState<string[]>(
    config.personalMenuItems || []
  )

  // 同步 store 更新
  useEffect(() => {
    setLocalSelectedItems(config.personalMenuItems || [])
  }, [config.personalMenuItems])

  // 檢查權限可見性
  const checkPermission = (permission?: string): boolean => {
    if (!permission) return true
    if (isAdmin) return true
    return userPermissions.includes(permission)
  }

  // 過濾可見的主選單
  const visibleMenuItems = defaultMenuItems.filter((item) => {
    // 個人專區本身不顯示
    if (item.id === 'dashboard') return false
    return checkPermission(item.permission)
  })

  // 過濾可見的子選單
  const getVisibleChildren = (menuId: string) => {
    const menu = getMenuItemById(menuId)
    if (!menu?.children) return []
    return menu.children.filter((child) => checkPermission(child.permission))
  }

  const toggleExpand = (menuId: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev)
      if (next.has(menuId)) {
        next.delete(menuId)
      } else {
        next.add(menuId)
      }
      return next
    })
  }

  const toggleSelect = (subMenuId: string) => {
    setLocalSelectedItems((prev) => {
      if (prev.includes(subMenuId)) {
        return prev.filter((id) => id !== subMenuId)
      } else {
        return [...prev, subMenuId]
      }
    })
  }

  const handleSave = () => {
    setPersonalMenuItems(localSelectedItems)
    onSave()
  }

  const selectedCount = localSelectedItems.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">個人專區設定</h3>
        <span className="text-sm text-muted-foreground">
          已選擇 {selectedCount} 個功能
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        選擇要加入個人專區的功能，這些功能會顯示在個人專區的子選單和首頁快捷卡片中
      </p>

      <ScrollArea className="h-[350px] rounded-md border p-3">
        <div className="space-y-1">
          {visibleMenuItems.map((menu) => {
            const children = getVisibleChildren(menu.id)
            const hasChildren = children.length > 0
            const isExpanded = expandedMenus.has(menu.id)
            const Icon = menu.icon

            // 計算此主選單下已選數量
            const selectedInMenu = children.filter((c) =>
              localSelectedItems.includes(c.id)
            ).length

            return (
              <div key={menu.id}>
                {/* 主選單標題 */}
                <button
                  onClick={() => hasChildren && toggleExpand(menu.id)}
                  className={cn(
                    'flex items-center gap-2 w-full p-2 rounded-md text-left transition-colors',
                    hasChildren
                      ? 'hover:bg-muted cursor-pointer'
                      : 'cursor-default opacity-60'
                  )}
                  disabled={!hasChildren}
                >
                  {hasChildren ? (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )
                  ) : (
                    <span className="w-4" />
                  )}
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 font-medium text-sm">{menu.name}</span>
                  {selectedInMenu > 0 && (
                    <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {selectedInMenu}
                    </span>
                  )}
                </button>

                {/* 子選單列表 */}
                {hasChildren && isExpanded && (
                  <div className="ml-6 pl-2 border-l space-y-1 mt-1">
                    {children.map((child) => {
                      const isSelected = localSelectedItems.includes(child.id)
                      const ChildIcon = child.icon

                      return (
                        <button
                          key={child.id}
                          onClick={() => toggleSelect(child.id)}
                          className={cn(
                            'flex items-center gap-2 w-full p-2 rounded-md text-left transition-colors',
                            isSelected
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          )}
                        >
                          <div
                            className={cn(
                              'flex items-center justify-center w-4 h-4 rounded border',
                              isSelected
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground/30'
                            )}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          {ChildIcon && (
                            <ChildIcon
                              className={cn(
                                'h-4 w-4',
                                isSelected
                                  ? 'text-primary'
                                  : 'text-muted-foreground'
                              )}
                            />
                          )}
                          <span className="flex-1 text-sm">{child.name}</span>
                          {isSelected && (
                            <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? '儲存中...' : '儲存'}
        </Button>
      </div>
    </div>
  )
}
