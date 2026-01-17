'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  Trash2,
  CheckCheck,
  Inbox,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'REQUEST_REJECTED':
      return <XCircle className="h-5 w-5 text-red-500" />
    case 'REVISION_REQUIRED':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />
    case 'APPROVAL_NEEDED':
      return <Clock className="h-5 w-5 text-blue-500" />
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />
  }
}

// Get notification type label
function getNotificationTypeLabel(type: string): string {
  switch (type) {
    case 'REQUEST_APPROVED':
      return '審核通過'
    case 'REQUEST_REJECTED':
      return '審核駁回'
    case 'REVISION_REQUIRED':
      return '需要修改'
    case 'APPROVAL_NEEDED':
      return '待審核'
    default:
      return '系統通知'
  }
}

interface NotificationListProps {
  userId: string
}

export function NotificationList({ userId }: NotificationListProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const utils = trpc.useUtils()

  // Fetch notifications based on active tab
  const { data: unreadData, isLoading: isLoadingUnread } =
    trpc.notification.getAll.useQuery(
      { userId, page, pageSize, isRead: false },
      { enabled: activeTab === 'unread' }
    )

  const { data: allData, isLoading: isLoadingAll } =
    trpc.notification.getAll.useQuery(
      { userId, page, pageSize },
      { enabled: activeTab === 'all' }
    )

  const { data: countData } = trpc.notification.getUnreadCount.useQuery({
    userId,
  })

  // Mutations
  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getAll.invalidate()
      utils.notification.getUnreadCount.invalidate({ userId })
    },
  })

  const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getAll.invalidate()
      utils.notification.getUnreadCount.invalidate({ userId })
    },
  })

  const deleteMutation = trpc.notification.delete.useMutation({
    onSuccess: () => {
      utils.notification.getAll.invalidate()
      utils.notification.getUnreadCount.invalidate({ userId })
    },
  })

  const clearAllMutation = trpc.notification.clearAll.useMutation({
    onSuccess: () => {
      utils.notification.getAll.invalidate()
      utils.notification.getUnreadCount.invalidate({ userId })
    },
  })

  const handleNotificationClick = async (notification: {
    id: string
    isRead: boolean
    link: string | null
  }) => {
    // Mark as read if not already
    if (!notification.isRead) {
      await markAsReadMutation.mutateAsync({ id: notification.id, userId })
    }

    // Navigate if link exists
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const handleDelete = async (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation()
    await deleteMutation.mutateAsync({ id: notificationId, userId })
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsReadMutation.mutateAsync({ userId })
  }

  const handleClearAllRead = async () => {
    await clearAllMutation.mutateAsync({ userId })
  }

  const currentData = activeTab === 'unread' ? unreadData : allData
  const notifications = currentData?.items || []
  const totalPages = currentData?.totalPages || 1
  const unreadCount = countData?.count || 0

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'unread' | 'all')
    setPage(1)
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <TabsList>
              <TabsTrigger value="unread" className="gap-2">
                未讀
                {unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">全部</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsReadMutation.isPending}
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  全部已讀
                </Button>
              )}
              {activeTab === 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllRead}
                  disabled={clearAllMutation.isPending}
                  className="text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  清除已讀
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="unread" className="m-0">
            {isLoadingUnread ? (
              <LoadingState />
            ) : notifications.length === 0 ? (
              <EmptyState message="沒有未讀通知" />
            ) : (
              <NotificationItems
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onDelete={handleDelete}
                isDeleting={deleteMutation.isPending}
              />
            )}
          </TabsContent>

          <TabsContent value="all" className="m-0">
            {isLoadingAll ? (
              <LoadingState />
            ) : notifications.length === 0 ? (
              <EmptyState message="沒有任何通知" />
            ) : (
              <NotificationItems
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onDelete={handleDelete}
                isDeleting={deleteMutation.isPending}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              上一頁
            </Button>
            <span className="text-sm text-muted-foreground">
              第 {page} / {totalPages} 頁
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              下一頁
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Inbox className="h-12 w-12 mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

interface NotificationItemsProps {
  notifications: Array<{
    id: string
    type: string
    title: string
    message: string
    link: string | null
    isRead: boolean
    createdAt: Date
  }>
  onNotificationClick: (notification: {
    id: string
    isRead: boolean
    link: string | null
  }) => Promise<void>
  onDelete: (e: React.MouseEvent, id: string) => Promise<void>
  isDeleting: boolean
}

function NotificationItems({
  notifications,
  onNotificationClick,
  onDelete,
  isDeleting,
}: NotificationItemsProps) {
  return (
    <div className="divide-y">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          onClick={() => onNotificationClick(notification)}
          className={`group flex items-start gap-4 px-4 py-4 cursor-pointer hover:bg-accent transition-colors ${
            !notification.isRead ? 'bg-accent/50' : ''
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium">{notification.title}</p>
              {!notification.isRead && (
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground">
                {getNotificationTypeLabel(notification.type)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(new Date(notification.createdAt))}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => onDelete(e, notification.id)}
            disabled={isDeleting}
            className="flex-shrink-0 p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 rounded transition-all"
            title="刪除通知"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
