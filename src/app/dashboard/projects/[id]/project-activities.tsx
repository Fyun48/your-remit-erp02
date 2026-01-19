'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Activity,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  PlayCircle,
  Loader2,
  MessageSquare,
  Upload,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format, formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface ProjectActivitiesProps {
  projectId: string
}

const actionIcons: Record<string, React.ElementType> = {
  CREATED: Plus,
  UPDATED: Pencil,
  DELETED: Trash2,
  MEMBER_ADDED: UserPlus,
  MEMBER_REMOVED: UserMinus,
  MEMBER_ROLE_CHANGED: Pencil,
  STATUS_CHANGED: PlayCircle,
  COMMENTED: MessageSquare,
  UPLOADED: Upload,
}

const actionColors: Record<string, string> = {
  CREATED: 'bg-green-100 text-green-600',
  UPDATED: 'bg-blue-100 text-blue-600',
  DELETED: 'bg-red-100 text-red-600',
  MEMBER_ADDED: 'bg-purple-100 text-purple-600',
  MEMBER_REMOVED: 'bg-orange-100 text-orange-600',
  MEMBER_ROLE_CHANGED: 'bg-yellow-100 text-yellow-600',
  STATUS_CHANGED: 'bg-cyan-100 text-cyan-600',
  COMMENTED: 'bg-indigo-100 text-indigo-600',
  UPLOADED: 'bg-teal-100 text-teal-600',
}

const targetTypeLabels: Record<string, string> = {
  PROJECT: '專案',
  PHASE: '階段',
  TASK: '任務',
  MEMBER: '成員',
  ATTACHMENT: '附件',
}

export function ProjectActivities({ projectId }: ProjectActivitiesProps) {
  const { data: activities, isLoading } = trpc.project.getActivities.useQuery({
    projectId,
    limit: 50,
  })

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

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            活動紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            尚無活動紀錄
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          活動紀錄
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = actionIcons[activity.action] || Pencil
              const colorClass = actionColors[activity.action] || 'bg-gray-100 text-gray-600'

              return (
                <div key={activity.id} className="flex gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.actor.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {targetTypeLabels[activity.targetType] || activity.targetType}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{activity.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                        locale: zhTW,
                      })}
                      <span className="mx-1">·</span>
                      {format(new Date(activity.createdAt), 'MM/dd HH:mm', { locale: zhTW })}
                    </p>
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
