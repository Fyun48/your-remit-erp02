'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Bell,
  Clock,
  AlertTriangle,
  Loader2,
  Calendar,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface ProjectRemindersProps {
  projectId: string
  employeeId: string
  companyId: string
}

export function ProjectReminders({ projectId, employeeId, companyId }: ProjectRemindersProps) {
  const { data: upcomingTasks, isLoading: loadingUpcoming } = trpc.project.getUpcomingDeadlines.useQuery({
    employeeId,
    companyId,
    daysAhead: 7,
  })

  const { data: overdueTasks, isLoading: loadingOverdue } = trpc.project.getOverdueTasks.useQuery({
    employeeId,
    companyId,
  })

  const isLoading = loadingUpcoming || loadingOverdue

  // Filter tasks for this project
  const projectUpcoming = upcomingTasks?.filter(
    task => task.phase.projectId === projectId && !isPast(new Date(task.dueDate!))
  ) || []

  const projectOverdue = overdueTasks?.filter(
    task => task.phase.projectId === projectId
  ) || []

  const getDeadlineStatus = (dueDate: Date) => {
    if (isPast(dueDate)) {
      return { label: '已逾期', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle }
    }
    if (isToday(dueDate)) {
      return { label: '今天到期', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock }
    }
    if (isTomorrow(dueDate)) {
      return { label: '明天到期', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock }
    }
    return { label: '即將到期', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Calendar }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const allTasks = [...projectOverdue, ...projectUpcoming]

  if (allTasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            截止日期提醒
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>沒有即將到期的任務</p>
            <p className="text-sm">您的所有任務都在正常進度中</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          截止日期提醒
          {allTasks.length > 0 && (
            <Badge variant={projectOverdue.length > 0 ? 'destructive' : 'secondary'}>
              {allTasks.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {allTasks.map((task) => {
              const dueDate = new Date(task.dueDate!)
              const status = getDeadlineStatus(dueDate)
              const StatusIcon = status.icon

              return (
                <div
                  key={task.id}
                  className={cn(
                    'p-4 border rounded-lg',
                    status.color
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <StatusIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <span>階段：{task.phase.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-2 opacity-80">
                        <Calendar className="h-3 w-3" />
                        <span>
                          截止日期：{format(dueDate, 'yyyy/MM/dd', { locale: zhTW })}
                        </span>
                        <span>·</span>
                        <span>
                          {formatDistanceToNow(dueDate, {
                            addSuffix: true,
                            locale: zhTW,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
