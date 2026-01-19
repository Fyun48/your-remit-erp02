'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, CheckCircle, XCircle, AlertCircle, Clock, Loader2, UserPlus, MessageSquare, ListTodo, AlertTriangle } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

// Format relative time in Chinese
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return '剛剛'
  if (diffMin < 60) return `${diffMin} 分鐘前`
  if (diffHour < 24) return `${diffHour} 小時前`
  if (diffDay < 7) return `${diffDay} 天前`
  return date.toLocaleDateString('zh-TW')
}

// Get icon based on notification type
function getNotificationIcon(type: string) {
  switch (type) {
    case 'REQUEST_APPROVED':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'REQUEST_REJECTED':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'REVISION_REQUIRED':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    case 'APPROVAL_NEEDED':
      return <Clock className="h-4 w-4 text-blue-500" />
    // Project notification types
    case 'TASK_ASSIGNED':
      return <ListTodo className="h-4 w-4 text-purple-500" />
    case 'TASK_DUE_SOON':
      return <Clock className="h-4 w-4 text-orange-500" />
    case 'TASK_OVERDUE':
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    case 'PROJECT_MEMBER_ADDED':
      return <UserPlus className="h-4 w-4 text-blue-500" />
    case 'COMMENT_MENTIONED':
      return <MessageSquare className="h-4 w-4 text-indigo-500" />
    case 'PROJECT_STATUS_CHANGED':
      return <AlertCircle className="h-4 w-4 text-cyan-500" />
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />
  }
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: Date
}

export function NotificationBell() {
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const userId = session?.user?.id

  // Fetch unread count
  const { data: countData } = trpc.notification.getUnreadCount.useQuery(
    { userId: userId! },
    { enabled: !!userId, refetchInterval: 30000 }
  )

  // Fetch recent unread notifications
  const { data: notifications, isLoading } = trpc.notification.getUnread.useQuery(
    { userId: userId! },
    { enabled: !!userId && open }
  )

  // Mark as read mutation
  const markAsReadMutation = trpc.notification.markAsRead.useMutation()

  const utils = trpc.useUtils()

  const handleNotificationClick = async (notification: Notification) => {
    if (!userId) return

    // Mark as read
    if (!notification.isRead) {
      await markAsReadMutation.mutateAsync({
        id: notification.id,
        userId,
      })
      // Invalidate queries to refresh data
      utils.notification.getUnreadCount.invalidate({ userId })
      utils.notification.getUnread.invalidate({ userId })
    }

    // Close popover
    setOpen(false)

    // Navigate if link exists
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const unreadCount = countData?.count ?? 0
  const recentNotifications = (notifications || []).slice(0, 10)

  if (!userId) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          aria-label="通知"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold">通知</h4>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {unreadCount} 則未讀
            </span>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2" />
              <p className="text-sm">暫無通知</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="flex w-full gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(new Date(notification.createdAt))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2">
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full text-sm">
              查看全部
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
