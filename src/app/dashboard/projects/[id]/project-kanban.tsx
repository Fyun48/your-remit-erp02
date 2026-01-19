'use client'

import { useMemo } from 'react'
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
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  User,
  Calendar,
  GripVertical,
  Plus,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW'

interface Task {
  id: string
  name: string
  description?: string | null
  status: string
  priority: string
  dueDate?: Date | null
  estimatedHours?: number | null
  assignee?: {
    id: string
    name: string
  } | null
  phase: {
    id: string
    name: string
  }
}

interface ProjectKanbanProps {
  tasks: Task[]
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void
  onAddTask: (phaseId: string) => void
  isUpdating: boolean
  phases: Array<{ id: string; name: string }>
}

const statusLabels: Record<TaskStatus, string> = {
  TODO: '待辦',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
}

const statusColors: Record<TaskStatus, string> = {
  TODO: 'border-gray-200 bg-gray-50',
  IN_PROGRESS: 'border-blue-200 bg-blue-50',
  COMPLETED: 'border-green-200 bg-green-50',
}

const statusHeaderColors: Record<TaskStatus, string> = {
  TODO: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
}

const taskPriorityColors: Record<TaskPriority, string> = {
  HIGH: 'bg-red-100 text-red-800 border-red-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-gray-100 text-gray-800 border-gray-200',
}

const taskPriorityLabels: Record<TaskPriority, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
}

function formatDate(date: Date | string | null) {
  if (!date) return null
  return format(new Date(date), 'MM/dd')
}

// Draggable Task Card
function TaskCard({ task, isDragging }: { task: Task; isDragging?: boolean }) {
  return (
    <Card
      className={cn(
        'cursor-grab active:cursor-grabbing transition-all',
        isDragging && 'opacity-50 rotate-2 shadow-lg'
      )}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-sm line-clamp-2">{task.name}</span>
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Badge
            className={cn('text-xs', taskPriorityColors[task.priority as TaskPriority])}
            variant="outline"
          >
            {taskPriorityLabels[task.priority as TaskPriority]}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {task.phase.name}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignee.name}
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Draggable wrapper
function DraggableTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  )
}

// Droppable Column
function KanbanColumn({
  status,
  tasks,
  onAddTask,
  phases,
}: {
  status: TaskStatus
  tasks: Task[]
  onAddTask: (phaseId: string) => void
  phases: Array<{ id: string; name: string }>
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-h-[500px] rounded-lg border-2 transition-colors',
        statusColors[status],
        isOver && 'border-primary border-dashed'
      )}
    >
      <div
        className={cn(
          'px-4 py-3 rounded-t-md font-semibold flex items-center justify-between',
          statusHeaderColors[status]
        )}
      >
        <span>{statusLabels[status]}</span>
        <Badge variant="secondary" className="ml-2">
          {tasks.length}
        </Badge>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <DraggableTask key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            拖曳任務至此
          </div>
        )}
      </div>

      {status === 'TODO' && phases.length > 0 && (
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => onAddTask(phases[0].id)}
          >
            <Plus className="h-4 w-4 mr-2" />
            新增任務
          </Button>
        </div>
      )}
    </div>
  )
}

export function ProjectKanban({
  tasks,
  onTaskStatusChange,
  onAddTask,
  isUpdating,
  phases,
}: ProjectKanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      COMPLETED: [],
    }

    tasks.forEach((task) => {
      const status = task.status as TaskStatus
      if (grouped[status]) {
        grouped[status].push(task)
      }
    })

    return grouped
  }, [tasks])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const task = tasks.find((t) => t.id === active.id)
    if (task) {
      setActiveTask(task)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id as string
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // Check if dropped over a column
    const newStatus = over.id as TaskStatus
    if (['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(newStatus)) {
      if (task.status !== newStatus) {
        onTaskStatusChange(taskId, newStatus)
      }
    }
  }

  if (isUpdating) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['TODO', 'IN_PROGRESS', 'COMPLETED'] as TaskStatus[]).map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            onAddTask={onAddTask}
            phases={phases}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}
