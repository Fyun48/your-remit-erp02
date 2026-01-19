'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Layers,
  TrendingUp,
  Calendar,
  Target,
  BarChart3,
} from 'lucide-react'
import { differenceInDays, isPast, isWithinInterval, addDays } from 'date-fns'
import { cn } from '@/lib/utils'

// Type definitions used in interface

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

interface Member {
  employeeId: string
  employee: {
    id: string
    name: string
  }
  role: string
  leftAt?: Date | null
}

interface ProjectStatsProps {
  projectName: string
  projectStatus: string
  plannedStartDate?: Date | null
  plannedEndDate?: Date | null
  actualStartDate?: Date | null
  phases: Phase[]
  members: Member[]
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function ProjectStats({
  projectName,
  projectStatus,
  plannedStartDate,
  plannedEndDate,
  actualStartDate,
  phases,
  members,
}: ProjectStatsProps) {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const stats = useMemo(() => {
    // Task statistics
    let totalTasks = 0
    let todoTasks = 0
    let inProgressTasks = 0
    let completedTasks = 0
    let overdueTasks = 0
    let dueSoonTasks = 0
    let highPriorityTasks = 0
    let totalEstimatedHours = 0

    // Assignee workload
    const assigneeWorkload = new Map<string, { name: string; total: number; completed: number }>()

    // Phase statistics
    let completedPhases = 0
    let inProgressPhases = 0

    phases.forEach((phase) => {
      if (phase.status === 'COMPLETED') completedPhases++
      if (phase.status === 'IN_PROGRESS') inProgressPhases++

      phase.tasks.forEach((task) => {
        totalTasks++

        if (task.status === 'TODO') todoTasks++
        if (task.status === 'IN_PROGRESS') inProgressTasks++
        if (task.status === 'COMPLETED') completedTasks++
        if (task.priority === 'HIGH') highPriorityTasks++
        if (task.estimatedHours) totalEstimatedHours += task.estimatedHours

        // Check overdue
        if (task.dueDate && task.status !== 'COMPLETED') {
          const dueDate = new Date(task.dueDate)
          if (isPast(dueDate)) {
            overdueTasks++
          } else if (isWithinInterval(dueDate, { start: new Date(), end: addDays(new Date(), 7) })) {
            dueSoonTasks++
          }
        }

        // Track assignee workload
        if (task.assignee) {
          const existing = assigneeWorkload.get(task.assignee.id) || {
            name: task.assignee.name,
            total: 0,
            completed: 0,
          }
          existing.total++
          if (task.status === 'COMPLETED') existing.completed++
          assigneeWorkload.set(task.assignee.id, existing)
        }
      })
    })

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Calculate days remaining
    let daysRemaining = null
    let totalDays = null
    let daysElapsed = null
    let timeProgress = 0

    if (plannedStartDate && plannedEndDate) {
      const start = new Date(plannedStartDate)
      const end = new Date(plannedEndDate)
      const today = new Date()

      totalDays = differenceInDays(end, start)
      daysElapsed = differenceInDays(today, start)
      daysRemaining = differenceInDays(end, today)

      if (totalDays > 0) {
        timeProgress = Math.min(Math.max(Math.round((daysElapsed / totalDays) * 100), 0), 100)
      }
    }

    // Active members
    const activeMembers = members.filter((m) => !m.leftAt).length

    return {
      totalTasks,
      todoTasks,
      inProgressTasks,
      completedTasks,
      overdueTasks,
      dueSoonTasks,
      highPriorityTasks,
      totalEstimatedHours,
      completionRate,
      completedPhases,
      inProgressPhases,
      totalPhases: phases.length,
      daysRemaining,
      totalDays,
      daysElapsed,
      timeProgress,
      activeMembers,
      assigneeWorkload: Array.from(assigneeWorkload.entries()).map(([id, data]) => ({
        id,
        ...data,
        completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      })),
    }
  }, [phases, members, plannedStartDate, plannedEndDate])

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總體進度</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <Progress value={stats.completionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.completedTasks} / {stats.totalTasks} 任務完成
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">時間進度</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.daysRemaining !== null ? (
                stats.daysRemaining >= 0 ? `${stats.daysRemaining} 天` : '已逾期'
              ) : (
                '-'
              )}
            </div>
            <Progress
              value={stats.timeProgress}
              className={cn('mt-2', stats.timeProgress > stats.completionRate && 'bg-yellow-200')}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.daysElapsed !== null && stats.totalDays !== null
                ? `已過 ${stats.daysElapsed} / ${stats.totalDays} 天`
                : '尚未設定專案日期'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">需關注項目</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.overdueTasks + stats.dueSoonTasks}
            </div>
            <div className="flex gap-2 mt-2">
              {stats.overdueTasks > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.overdueTasks} 已逾期
                </Badge>
              )}
              {stats.dueSoonTasks > 0 && (
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
                  {stats.dueSoonTasks} 即將到期
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.highPriorityTasks} 個高優先任務
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">團隊</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeMembers}</div>
            <p className="text-xs text-muted-foreground mt-2">
              活躍成員
            </p>
            <p className="text-xs text-muted-foreground">
              預估總工時：{stats.totalEstimatedHours} 小時
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Status Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              任務狀態分佈
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-20 text-sm">待辦</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gray-500 rounded-full"
                        style={{
                          width: stats.totalTasks > 0
                            ? `${(stats.todoTasks / stats.totalTasks) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <span className="text-sm w-12 text-right">{stats.todoTasks}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-20 text-sm">進行中</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: stats.totalTasks > 0
                            ? `${(stats.inProgressTasks / stats.totalTasks) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <span className="text-sm w-12 text-right">{stats.inProgressTasks}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-20 text-sm">已完成</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{
                          width: stats.totalTasks > 0
                            ? `${(stats.completedTasks / stats.totalTasks) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <span className="text-sm w-12 text-right">{stats.completedTasks}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              階段進度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {phases.length === 0 ? (
                <p className="text-muted-foreground text-sm">尚無階段</p>
              ) : (
                phases.map((phase) => {
                  const phaseTasks = phase.tasks.length
                  const phaseCompleted = phase.tasks.filter((t) => t.status === 'COMPLETED').length
                  const phaseProgress = phaseTasks > 0 ? Math.round((phaseCompleted / phaseTasks) * 100) : 0

                  return (
                    <div key={phase.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[200px]">{phase.name}</span>
                        <span className="text-muted-foreground">
                          {phaseCompleted}/{phaseTasks}
                        </span>
                      </div>
                      <Progress value={phaseProgress} className="h-2" />
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Workload */}
      {stats.assigneeWorkload.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              成員工作量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.assigneeWorkload.map((assignee) => (
                <div key={assignee.id} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium truncate">{assignee.name}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${assignee.completionRate}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-24">
                        {assignee.completed}/{assignee.total} 完成
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{stats.completedPhases}</p>
                <p className="text-sm text-green-600">已完成階段</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{stats.inProgressPhases}</p>
                <p className="text-sm text-blue-600">進行中階段</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100">
                <Layers className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats.totalPhases}</p>
                <p className="text-sm text-purple-600">總階段數</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
