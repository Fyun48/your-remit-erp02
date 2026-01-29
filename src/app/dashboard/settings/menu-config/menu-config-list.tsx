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
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Lock,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  Wand2,
  MoveRight,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { getMenuItemById } from '@/lib/sidebar-menu'
import { toast } from 'sonner'

interface Company {
  id: string
  name: string
  code: string
}

interface MenuConfigListProps {
  companies: Company[]
}

interface MenuConfigItem {
  id: string
  menuId: string
  menuName: string
  sortOrder: number
  isLocked: boolean
  isActive: boolean
  subMenus: SubMenuConfigItem[]
}

interface SubMenuConfigItem {
  id: string
  subMenuId: string
  subMenuName: string
  href: string
  sortOrder: number
  isIndependent: boolean
  isSystem: boolean
  parentMenuId: string | null
}

// 可拖曳的主選單項目
function SortableMenuItem({
  item,
  isExpanded,
  onToggleExpand,
  onMoveSubMenu,
}: {
  item: MenuConfigItem
  isExpanded: boolean
  onToggleExpand: () => void
  onMoveSubMenu: (subMenu: SubMenuConfigItem) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: item.isLocked })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const menuDef = getMenuItemById(item.menuId)
  const Icon = menuDef?.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('rounded-lg border bg-card', isDragging && 'opacity-50 shadow-lg')}
    >
      {/* 主選單標題 */}
      <div
        className={cn(
          'flex items-center gap-3 p-3',
          item.subMenus.length > 0 && 'cursor-pointer'
        )}
        onClick={() => item.subMenus.length > 0 && onToggleExpand()}
      >
        {!item.isLocked ? (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        ) : (
          <Lock className="h-5 w-5 text-muted-foreground" />
        )}

        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}

        <span className="flex-1 font-medium">{item.menuName}</span>

        {item.isLocked && (
          <Badge variant="secondary" className="text-xs">
            鎖定
          </Badge>
        )}

        {item.subMenus.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {item.subMenus.length} 個子選單
            </span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* 子選單列表 */}
      {isExpanded && item.subMenus.length > 0 && (
        <div className="border-t bg-muted/30 p-3 space-y-2">
          {item.subMenus.map((subMenu) => {
            const subMenuDef = getMenuItemById(subMenu.subMenuId)
            const SubIcon = subMenuDef?.icon

            return (
              <div
                key={subMenu.id}
                className="flex items-center gap-3 p-2 bg-background rounded-md"
              >
                {SubIcon && <SubIcon className="h-4 w-4 text-muted-foreground" />}
                <span className="flex-1 text-sm">{subMenu.subMenuName}</span>
                {subMenu.isSystem && (
                  <Badge variant="outline" className="text-xs">
                    新功能
                  </Badge>
                )}
                {!item.isLocked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveSubMenu(subMenu)
                    }}
                  >
                    <MoveRight className="h-3.5 w-3.5 mr-1" />
                    移動
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MenuConfigList({ companies }: MenuConfigListProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [selectedSubMenu, setSelectedSubMenu] = useState<SubMenuConfigItem | null>(null)
  const [targetMenuId, setTargetMenuId] = useState<string>('')
  const [activeId, setActiveId] = useState<string | null>(null)

  const utils = trpc.useUtils()

  // 取得選單配置
  const { data: menuData, isLoading } = trpc.menuConfig.getByCompany.useQuery(
    { companyId: selectedCompanyId },
    { enabled: !!selectedCompanyId }
  )

  // Mutations
  const initializeMutation = trpc.menuConfig.initializeForCompany.useMutation({
    onSuccess: () => {
      utils.menuConfig.getByCompany.invalidate({ companyId: selectedCompanyId })
      toast.success('選單配置初始化完成')
    },
    onError: (error) => {
      toast.error('初始化失敗：' + error.message)
    },
  })

  const updateOrderMutation = trpc.menuConfig.updateMenuOrder.useMutation({
    onSuccess: () => {
      utils.menuConfig.getByCompany.invalidate({ companyId: selectedCompanyId })
    },
    onError: (error) => {
      toast.error('排序更新失敗：' + error.message)
    },
  })

  const moveSubMenuMutation = trpc.menuConfig.moveSubMenu.useMutation({
    onSuccess: () => {
      utils.menuConfig.getByCompany.invalidate({ companyId: selectedCompanyId })
      toast.success('子選單已移動')
      setShowMoveDialog(false)
      setSelectedSubMenu(null)
      setTargetMenuId('')
    },
    onError: (error) => {
      toast.error('移動失敗：' + error.message)
    },
  })

  const syncNewFeaturesMutation = trpc.menuConfig.syncNewFeatures.useMutation({
    onSuccess: (data) => {
      utils.menuConfig.getByCompany.invalidate({ companyId: selectedCompanyId })
      if (data.newCount > 0) {
        toast.success(`已偵測到 ${data.newCount} 個新功能`)
      } else {
        toast.info('沒有發現新功能')
      }
    },
    onError: (error) => {
      toast.error('同步失敗：' + error.message)
    },
  })

  const resetMutation = trpc.menuConfig.resetToDefault.useMutation({
    onSuccess: () => {
      utils.menuConfig.getByCompany.invalidate({ companyId: selectedCompanyId })
      toast.success('已重置為預設配置')
      setShowResetDialog(false)
    },
    onError: (error) => {
      toast.error('重置失敗：' + error.message)
    },
  })

  // 自動選擇第一間公司
  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id)
    }
  }, [companies, selectedCompanyId])

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id || !menuData) return

    const menuConfigs = menuData.menuConfigs
    const oldIndex = menuConfigs.findIndex((m) => m.id === active.id)
    const newIndex = menuConfigs.findIndex((m) => m.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // 檢查是否嘗試移動鎖定的選單
    if (menuConfigs[oldIndex].isLocked) {
      toast.error('無法移動鎖定的選單')
      return
    }

    const newOrder = arrayMove(menuConfigs, oldIndex, newIndex)
    const menuOrders = newOrder.map((m, index) => ({
      menuId: m.menuId,
      sortOrder: index,
    }))

    updateOrderMutation.mutate({
      companyId: selectedCompanyId,
      menuOrders,
    })
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

  const handleMoveSubMenu = (subMenu: SubMenuConfigItem) => {
    setSelectedSubMenu(subMenu)
    setTargetMenuId('')
    setShowMoveDialog(true)
  }

  const confirmMoveSubMenu = () => {
    if (!selectedSubMenu) return

    moveSubMenuMutation.mutate({
      subMenuConfigId: selectedSubMenu.id,
      targetParentMenuId: targetMenuId || null,
    })
  }

  const menuConfigs = menuData?.menuConfigs || []
  const hasConfig = menuConfigs.length > 0

  // 取得可移動的目標選單（排除鎖定的和當前所屬的）
  const availableTargetMenus = menuConfigs.filter(
    (m) => !m.isLocked && m.id !== selectedSubMenu?.parentMenuId
  )

  return (
    <div className="space-y-6">
      {/* 公司選擇 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">選擇公司</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="選擇公司" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name} ({company.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedCompanyId && !hasConfig && (
              <Button
                onClick={() => initializeMutation.mutate({ companyId: selectedCompanyId })}
                disabled={initializeMutation.isPending}
              >
                {initializeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                初始化選單
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 選單配置 */}
      {selectedCompanyId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">選單配置</CardTitle>
            {hasConfig && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncNewFeaturesMutation.mutate({ companyId: selectedCompanyId })}
                  disabled={syncNewFeaturesMutation.isPending}
                >
                  {syncNewFeaturesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  同步新功能
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetDialog(true)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  重置預設
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !hasConfig ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>此公司尚未初始化選單配置</p>
                <p className="text-sm mt-1">請點擊上方「初始化選單」按鈕</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  拖曳調整主選單排序，點擊展開查看或移動子選單。鎖定的選單無法調整。
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={menuConfigs.map((m) => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {menuConfigs.map((menu) => (
                        <SortableMenuItem
                          key={menu.id}
                          item={menu}
                          isExpanded={expandedMenus.has(menu.id)}
                          onToggleExpand={() => toggleExpand(menu.id)}
                          onMoveSubMenu={handleMoveSubMenu}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {activeId ? (
                      <div className="rounded-lg border bg-card p-3 shadow-lg opacity-90">
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">
                            {menuConfigs.find((m) => m.id === activeId)?.menuName}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 重置確認對話框 */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重置選單配置</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將選單配置重置為預設值嗎？此操作會刪除所有自訂設定，包括子選單的歸屬調整。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetMutation.mutate({ companyId: selectedCompanyId })}
              disabled={resetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetMutation.isPending ? '重置中...' : '確定重置'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 移動子選單對話框 */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移動子選單</DialogTitle>
            <DialogDescription>
              選擇要將「{selectedSubMenu?.subMenuName}」移動到哪個主選單下
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={targetMenuId} onValueChange={setTargetMenuId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇目標主選單" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__independent__">
                  設為獨立顯示（不歸屬任何主選單）
                </SelectItem>
                {availableTargetMenus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id}>
                    {menu.menuName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              取消
            </Button>
            <Button
              onClick={confirmMoveSubMenu}
              disabled={!targetMenuId || moveSubMenuMutation.isPending}
            >
              {moveSubMenuMutation.isPending ? '移動中...' : '確定移動'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
