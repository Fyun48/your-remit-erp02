'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Calendar,
  UserCheck,
  AlertTriangle,
  Loader2,
  Clock,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format, isWithinInterval, isFuture, isToday, differenceInDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface ProjectTeamAvailabilityProps {
  projectId: string
}

interface MemberLeave {
  id: string
  startDate: Date
  endDate: Date
  status: string
  totalHours: number
  employee: {
    id: string
    name: string
  }
  leaveType: {
    id: string
    name: string
  }
}

const statusLabels: Record<string, string> = {
  APPROVED: '已核准',
  PENDING: '審核中',
}

const statusColors: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

export function ProjectTeamAvailability({ projectId }: ProjectTeamAvailabilityProps) {
  const { data: leavesData, isLoading } = trpc.project.getMemberLeaves.useQuery({
    projectId,
  })

  // Cast to typed array (tRPC types don't always infer includes)
  const leaves = leavesData as MemberLeave[] | undefined

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

  // Separate current/upcoming leaves
  const now = new Date()
  const currentLeaves = leaves?.filter(leave => {
    const start = new Date(leave.startDate)
    const end = new Date(leave.endDate)
    return isWithinInterval(now, { start, end }) || isToday(start)
  }) || []

  const upcomingLeaves = leaves?.filter(leave => {
    const start = new Date(leave.startDate)
    return isFuture(start) && !isToday(start)
  }) || []

  const hasNoLeaves = (!leaves || leaves.length === 0)

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5" />
            團隊可用性
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{currentLeaves.length}</div>
              <p className="text-xs text-muted-foreground">目前請假中</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{upcomingLeaves.length}</div>
              <p className="text-xs text-muted-foreground">即將請假</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{leaves?.length || 0}</div>
              <p className="text-xs text-muted-foreground">30天內總計</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Leaves */}
      {currentLeaves.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-red-700">
              <AlertTriangle className="h-4 w-4" />
              目前請假中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentLeaves.map((leave) => {
                const endDate = new Date(leave.endDate)
                const daysRemaining = differenceInDays(endDate, now)

                return (
                  <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{leave.employee.name}</span>
                          <Badge variant="outline" className={statusColors[leave.status]}>
                            {leave.leaveType.name}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(leave.startDate), 'MM/dd', { locale: zhTW })} - {format(endDate, 'MM/dd', { locale: zhTW })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">
                        {daysRemaining > 0 ? `剩餘 ${daysRemaining} 天` : '今天結束'}
                      </p>
                      <p className="text-xs text-muted-foreground">{leave.totalHours} 小時</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Leaves */}
      {upcomingLeaves.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              即將請假
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {upcomingLeaves.map((leave) => {
                  const startDate = new Date(leave.startDate)
                  const daysUntil = differenceInDays(startDate, now)

                  return (
                    <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{leave.employee.name}</span>
                            <Badge variant="outline" className={statusColors[leave.status]}>
                              {leave.leaveType.name}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {statusLabels[leave.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(startDate, 'MM/dd', { locale: zhTW })} - {format(new Date(leave.endDate), 'MM/dd', { locale: zhTW })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'text-sm font-medium',
                          daysUntil <= 7 ? 'text-yellow-600' : 'text-muted-foreground'
                        )}>
                          {daysUntil} 天後
                        </p>
                        <p className="text-xs text-muted-foreground">{leave.totalHours} 小時</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* No Leaves */}
      {hasNoLeaves && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="font-medium text-green-700">團隊全員可用</p>
              <p className="text-sm">未來 30 天內無成員請假</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
