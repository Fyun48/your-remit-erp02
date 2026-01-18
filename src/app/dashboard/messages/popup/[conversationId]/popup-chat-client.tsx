'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Send,
  Paperclip,
  Loader2,
  Check,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  File,
  X,
  Camera,
  MoreVertical,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { trpc } from '@/lib/trpc'
import { format, isToday, isYesterday, isThisYear } from 'date-fns'
import { cn } from '@/lib/utils'

interface PopupChatClientProps {
  userId: string
  conversationId: string
}

export function PopupChatClient({ userId, conversationId }: PopupChatClientProps) {
  const [messageInput, setMessageInput] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<Array<{
    fileName: string
    fileType: string
    fileSize: number
    fileUrl: string
  }>>([])
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get conversation info
  const conversationsQuery = trpc.messaging.getConversations.useQuery(
    { userId },
    { refetchInterval: 30000 }
  )

  const conversation = conversationsQuery.data?.find(c => c.id === conversationId)
  const conversationName = conversation?.name || '對話'

  // Update window title
  useEffect(() => {
    document.title = `${conversationName} - 訊息`
  }, [conversationName])

  // API Queries
  const messagesQuery = trpc.messaging.getMessages.useQuery(
    { userId, conversationId },
    { refetchInterval: 3000 }
  )

  const sendMessageMutation = trpc.messaging.sendMessage.useMutation({
    onSuccess: () => {
      setMessageInput('')
      setPendingAttachments([])
      messagesQuery.refetch()
    },
  })

  const markAsReadMutation = trpc.messaging.markAsRead.useMutation({
    onSuccess: () => {
      conversationsQuery.refetch()
    },
  })

  // Mark as read on mount and when new messages arrive
  useEffect(() => {
    markAsReadMutation.mutate({ userId, conversationId })
  }, [conversationId, userId, messagesQuery.data?.messages?.length])

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (messagesQuery.data?.messages) {
      scrollToBottom()
    }
  }, [messagesQuery.data?.messages, scrollToBottom])

  // Send message
  const handleSendMessage = () => {
    if ((!messageInput.trim() && pendingAttachments.length === 0)) return

    sendMessageMutation.mutate({
      userId,
      conversationId,
      content: messageInput.trim() || ' ',
      attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
    })
  }

  // File upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    setUploadingFiles(fileArray)

    for (const file of fileArray) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const response = await fetch('/api/messages/upload', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          setPendingAttachments(prev => [...prev, data])
        }
      } catch {
        // Handle error silently
      }
    }

    setUploadingFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Format time
  const formatMessageTime = (date: Date) => {
    const d = new Date(date)
    if (isToday(d)) return format(d, 'HH:mm')
    if (isYesterday(d)) return `昨天 ${format(d, 'HH:mm')}`
    if (isThisYear(d)) return format(d, 'MM/dd HH:mm')
    return format(d, 'yyyy/MM/dd HH:mm')
  }

  // Get file icon
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-3 w-3" />
    if (fileType === 'application/pdf') return <FileText className="h-3 w-3 text-red-500" />
    return <File className="h-3 w-3" />
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary-foreground text-primary text-sm">
              {conversationName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="font-semibold">{conversationName}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Camera className="h-4 w-4 mr-2" />
              匯出對話截圖
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messagesQuery.data?.messages.map((msg, index) => {
          const isOwn = msg.senderId === userId
          const showAvatar = index === 0 ||
            messagesQuery.data?.messages[index - 1]?.senderId !== msg.senderId
          const recipientReadAt = messagesQuery.data?.recipientReadAt
          const isRead = isOwn && recipientReadAt &&
            new Date(recipientReadAt) >= new Date(msg.createdAt)

          return (
            <div
              key={msg.id}
              className={cn(
                'flex gap-2 mb-2',
                isOwn ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {!isOwn && showAvatar && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={msg.sender.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">{msg.sender.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
              )}
              {!isOwn && !showAvatar && <div className="w-8" />}

              <div className={cn('max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
                {!isOwn && showAvatar && (
                  <span className="text-xs text-muted-foreground ml-1">{msg.sender.name}</span>
                )}
                <div
                  className={cn(
                    'rounded-2xl px-4 py-2',
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted rounded-tl-sm',
                    msg.isDeleted && 'italic opacity-60'
                  )}
                >
                  {msg.isDeleted ? (
                    <span className="text-sm">訊息已收回</span>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                'flex items-center gap-2 p-2 rounded text-xs',
                                isOwn ? 'bg-primary-foreground/20' : 'bg-background'
                              )}
                            >
                              {getFileIcon(att.fileType)}
                              <span className="truncate">{att.fileName}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className={cn(
                  'flex items-center gap-1 mt-0.5',
                  isOwn ? 'justify-end' : 'justify-start'
                )}>
                  <span className="text-[10px] text-muted-foreground">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                  {isOwn && (
                    isRead ? (
                      <CheckCheck className="h-3 w-3 text-blue-500" />
                    ) : (
                      <Check className="h-3 w-3 text-muted-foreground" />
                    )
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/50">
          <div className="flex gap-2 flex-wrap">
            {pendingAttachments.map((att, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-background rounded px-2 py-1"
              >
                {getFileIcon(att.fileType)}
                <span className="text-xs truncate max-w-[100px]">{att.fileName}</span>
                <button
                  onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== index))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFiles.length > 0}
          >
            {uploadingFiles.length > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
          <Input
            placeholder="輸入訊息..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={(!messageInput.trim() && pendingAttachments.length === 0) || sendMessageMutation.isLoading}
          >
            {sendMessageMutation.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
