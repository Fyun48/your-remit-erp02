'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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

export function MessageBell() {
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const userId = session?.user?.id

  // Fetch total unread message count
  const { data: countData } = trpc.messaging.getTotalUnreadCount.useQuery(
    { userId: userId! },
    { enabled: !!userId, refetchInterval: 10000 }
  )

  // Fetch conversations with unread messages
  const { data: conversations, isLoading } = trpc.messaging.getConversations.useQuery(
    { userId: userId! },
    { enabled: !!userId && open }
  )

  const handleConversationClick = (conversationId: string) => {
    setOpen(false)
    router.push(`/dashboard/messages?conversation=${conversationId}`)
  }

  const unreadCount = countData?.count ?? 0
  const unreadConversations = (conversations || [])
    .filter(c => c.unreadCount > 0)
    .slice(0, 5)

  if (!userId) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          aria-label="訊息"
        >
          <MessageSquare className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold">訊息</h4>
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
          ) : unreadConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">暫無未讀訊息</p>
            </div>
          ) : (
            <div className="divide-y">
              {unreadConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className="flex w-full gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                      {conversation.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {conversation.name}
                      </p>
                      <span className="flex-shrink-0 ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </span>
                    </div>
                    {conversation.lastMessage && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {conversation.lastMessage.isDeleted
                          ? '訊息已收回'
                          : conversation.lastMessage.content}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {conversation.updatedAt && formatTimeAgo(new Date(conversation.updatedAt))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => {
              setOpen(false)
              router.push('/dashboard/messages')
            }}
          >
            查看全部
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
