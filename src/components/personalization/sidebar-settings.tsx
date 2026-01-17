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
