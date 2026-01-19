'use client'

import { useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ZoomIn,
  ZoomOut,
  Calendar,
  User,
} from 'lucide-react'
import { format, addDays, differenceInDays, startOfDay, eachDayOfInterval, startOfWeek, isSameDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW'
type PhaseStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

interface Task {
  id: string
  name: string
  status: string
  priority: string
  dueDate?: Date | null
  estimatedHours?: number | null
  assignee?: {
    id: string
    name: string
  } | null
}

interface Phase {
  id: string
  name: string
  status: string
  plannedEndDate?: Date | null
  tasks: Task[]
}

interface ProjectGanttProps {
  projectName: string
  plannedStartDate?: Date | null
  plannedEndDate?: Date | null
  phases: Phase[]
}

const phaseStatusColors: Record<PhaseStatus, string> = {
  PENDING: 'bg-gray-400',
  IN_PROGRESS: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
}

const taskStatusColors: Record<TaskStatus, string> = {
  TODO: 'bg-gray-400',
  IN_PROGRESS: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
}

const taskPriorityColors: Record<TaskPriority, string> = {
  HIGH: 'border-red-500',
  MEDIUM: 'border-yellow-500',
  LOW: 'border-gray-400',
}

const DAY_WIDTH_OPTIONS = [20, 30, 40, 60]

/* eslint-disable @typescript-eslint/no-unused-vars */
export function ProjectGantt({
  projectName,
  plannedStartDate,
  plannedEndDate,
  phases,
}: ProjectGanttProps) {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dayWidthIndex, setDayWidthIndex] = useState(1)
  const dayWidth = DAY_WIDTH_OPTIONS[dayWidthIndex]

  // Calculate date range (endDate is calculated but not directly used)
  const { startDate, totalDays, dates } = useMemo(() => {
    const today = startOfDay(new Date())
    let minDate = plannedStartDate ? startOfDay(new Date(plannedStartDate)) : today
    let maxDate = plannedEndDate ? startOfDay(new Date(plannedEndDate)) : addDays(today, 30)

    // Consider phase and task dates
    phases.forEach((phase) => {
      if (phase.plannedEndDate) {
        const phaseEnd = startOfDay(new Date(phase.plannedEndDate))
        if (phaseEnd > maxDate) maxDate = phaseEnd
      }
      phase.tasks.forEach((task) => {
        if (task.dueDate) {
          const taskDue = startOfDay(new Date(task.dueDate))
          if (taskDue > maxDate) maxDate = taskDue
        }
      })
    })

    // Add padding
    minDate = addDays(minDate, -7)
    maxDate = addDays(maxDate, 14)

    const total = differenceInDays(maxDate, minDate) + 1
    const allDates = eachDayOfInterval({ start: minDate, end: maxDate })

    return {
      startDate: minDate,
      endDate: maxDate,
      totalDays: total,
      dates: allDates,
    }
  }, [plannedStartDate, plannedEndDate, phases])

  // Group dates by week
  const weeks = useMemo(() => {
    const weekMap = new Map<string, Date[]>()
    dates.forEach((date) => {
      const weekStart = startOfWeek(date, { locale: zhTW })
      const weekKey = format(weekStart, 'yyyy-MM-dd')
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, [])
      }
      weekMap.get(weekKey)!.push(date)
    })
    return Array.from(weekMap.entries()).map(([key, days]) => ({
      weekStart: new Date(key),
      days,
    }))
  }, [dates])

  const getDatePosition = (date: Date | null | undefined): number => {
    if (!date) return 0
    const d = startOfDay(new Date(date))
    return differenceInDays(d, startDate) * dayWidth
  }

  const getBarWidth = (start: Date | null | undefined, end: Date | null | undefined): number => {
    if (!start || !end) return dayWidth
    const s = startOfDay(new Date(start))
    const e = startOfDay(new Date(end))
    return (differenceInDays(e, s) + 1) * dayWidth
  }

  const isToday = (date: Date) => isSameDay(date, new Date())
  const isWeekend = (date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  const handleZoomIn = () => {
    if (dayWidthIndex < DAY_WIDTH_OPTIONS.length - 1) {
      setDayWidthIndex(dayWidthIndex + 1)
    }
  }

  const handleZoomOut = () => {
    if (dayWidthIndex > 0) {
      setDayWidthIndex(dayWidthIndex - 1)
    }
  }

  const scrollToToday = () => {
    if (scrollRef.current) {
      const todayPosition = getDatePosition(new Date())
      scrollRef.current.scrollLeft = todayPosition - 200
    }
  }

  const ROW_HEIGHT = 40
  const HEADER_HEIGHT = 60
  const LABEL_WIDTH = 250

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            甘特圖
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={scrollToToday}>
              今天
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomOut}
              disabled={dayWidthIndex === 0}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomIn}
              disabled={dayWidthIndex === DAY_WIDTH_OPTIONS.length - 1}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex border-t">
          {/* Left labels */}
          <div
            className="flex-shrink-0 border-r bg-muted/30"
            style={{ width: LABEL_WIDTH }}
          >
            {/* Header placeholder */}
            <div
              className="border-b px-4 flex items-center font-semibold"
              style={{ height: HEADER_HEIGHT }}
            >
              階段 / 任務
            </div>

            {/* Phase and task labels */}
            {phases.map((phase) => (
              <div key={phase.id}>
                <div
                  className="border-b px-4 flex items-center gap-2 bg-muted/50 font-medium"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      phaseStatusColors[phase.status as PhaseStatus]
                    )}
                  />
                  <span className="truncate">{phase.name}</span>
                </div>
                {phase.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="border-b px-4 pl-8 flex items-center gap-2"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        taskStatusColors[task.status as TaskStatus]
                      )}
                    />
                    <span className="truncate text-sm">{task.name}</span>
                  </div>
                ))}
              </div>
            ))}

            {phases.length === 0 && (
              <div
                className="px-4 flex items-center text-muted-foreground"
                style={{ height: ROW_HEIGHT }}
              >
                尚無階段
              </div>
            )}
          </div>

          {/* Right timeline */}
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div style={{ width: totalDays * dayWidth }}>
              {/* Header with dates */}
              <div
                className="border-b flex sticky top-0 bg-background z-10"
                style={{ height: HEADER_HEIGHT }}
              >
                {weeks.map(({ weekStart, days }) => (
                  <div key={weekStart.toISOString()} className="flex flex-col">
                    <div
                      className="border-b border-r px-2 text-xs font-medium text-center bg-muted/30"
                      style={{ width: days.length * dayWidth, height: 24 }}
                    >
                      {format(weekStart, 'M/d', { locale: zhTW })} 週
                    </div>
                    <div className="flex" style={{ height: HEADER_HEIGHT - 24 }}>
                      {days.map((date) => (
                        <div
                          key={date.toISOString()}
                          className={cn(
                            'border-r flex flex-col items-center justify-center text-xs',
                            isToday(date) && 'bg-primary/10 font-bold',
                            isWeekend(date) && 'bg-muted/50'
                          )}
                          style={{ width: dayWidth }}
                        >
                          <span>{format(date, 'd')}</span>
                          <span className="text-muted-foreground">
                            {format(date, 'EEE', { locale: zhTW })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline rows */}
              <TooltipProvider>
                {phases.map((phase) => (
                  <div key={phase.id}>
                    {/* Phase row */}
                    <div
                      className="border-b relative bg-muted/20"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Today line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                        style={{ left: getDatePosition(new Date()) }}
                      />

                      {/* Phase bar */}
                      {phase.plannedEndDate && plannedStartDate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'absolute top-2 h-6 rounded cursor-pointer opacity-80 hover:opacity-100 transition-opacity',
                                phaseStatusColors[phase.status as PhaseStatus]
                              )}
                              style={{
                                left: getDatePosition(plannedStartDate),
                                width: getBarWidth(plannedStartDate, phase.plannedEndDate),
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-semibold">{phase.name}</p>
                              <p className="text-xs">
                                預計完成：{format(new Date(phase.plannedEndDate), 'yyyy/MM/dd')}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Grid lines */}
                      {dates.map((date) => (
                        <div
                          key={date.toISOString()}
                          className={cn(
                            'absolute top-0 bottom-0 border-r',
                            isWeekend(date) && 'bg-muted/30'
                          )}
                          style={{
                            left: getDatePosition(date),
                            width: dayWidth,
                          }}
                        />
                      ))}
                    </div>

                    {/* Task rows */}
                    {phase.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="border-b relative"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {/* Today line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                          style={{ left: getDatePosition(new Date()) }}
                        />

                        {/* Task bar */}
                        {task.dueDate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'absolute top-2 h-6 rounded cursor-pointer opacity-80 hover:opacity-100 transition-opacity border-l-4',
                                  taskStatusColors[task.status as TaskStatus],
                                  taskPriorityColors[task.priority as TaskPriority]
                                )}
                                style={{
                                  left: getDatePosition(addDays(new Date(task.dueDate), -3)),
                                  width: dayWidth * 4,
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                <p className="font-semibold">{task.name}</p>
                                {task.assignee && (
                                  <p className="text-xs flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {task.assignee.name}
                                  </p>
                                )}
                                <p className="text-xs">
                                  截止：{format(new Date(task.dueDate), 'yyyy/MM/dd')}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Grid lines */}
                        {dates.map((date) => (
                          <div
                            key={date.toISOString()}
                            className={cn(
                              'absolute top-0 bottom-0 border-r',
                              isWeekend(date) && 'bg-muted/30'
                            )}
                            style={{
                              left: getDatePosition(date),
                              width: dayWidth,
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}

                {phases.length === 0 && (
                  <div
                    className="flex items-center justify-center text-muted-foreground"
                    style={{ height: ROW_HEIGHT }}
                  >
                    請先新增專案階段與任務
                  </div>
                )}
              </TooltipProvider>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Legend */}
        <div className="p-4 border-t flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span>未開始/待辦</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>進行中</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>已完成</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 bg-red-500" />
            <span>今天</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
