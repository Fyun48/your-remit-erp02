'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Minus,
  X,
  ExternalLink,
  Send,
  Paperclip,
  Loader2,
  Check,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  File,
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

interface FloatingChatWindowProps {
  userId: string
  conversationId: string
  conversationName: string
  onClose: () => void
  onMinimize: () => void
  onPopout: () => void
  initialPosition?: { x: number; y: number }
}

export function FloatingChatWindow({
  userId,
  conversationId,
  conversationName,
  onClose,
  onMinimize,
  onPopout,
  initialPosition = { x: 100, y: 100 },
}: FloatingChatWindowProps) {
  const [position, setPosition] = useState(initialPosition)
  const [size, setSize] = useState({ width: 380, height: 500 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<Array<{
    fileName: string
    fileType: string
    fileSize: number
    fileUrl: string
  }>>([])
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])

  const dragOffset = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const windowRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const markAsReadMutation = trpc.messaging.markAsRead.useMutation()

  // Mark as read on mount
  useEffect(() => {
    markAsReadMutation.mutate({ userId, conversationId })
  }, [conversationId, userId])

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (messagesQuery.data?.messages) {
      scrollToBottom()
    }
  }, [messagesQuery.data?.messages, scrollToBottom])

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.chat-controls')) return
    setIsDragging(true)
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x))
        const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragOffset.current.y))
        setPosition({ x: newX, y: newY })
      }
      if (isResizing) {
        const newWidth = Math.max(300, resizeStart.current.width + (e.clientX - resizeStart.current.x))
        const newHeight = Math.max(400, resizeStart.current.height + (e.clientY - resizeStart.current.y))
        setSize({ width: newWidth, height: newHeight })
      }
    },
    [isDragging, isResizing, size.width, size.height]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  // Resize handler
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    }
  }

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
    <div
      ref={windowRef}
      className="fixed z-50 shadow-2xl rounded-lg overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      <Card className="h-full flex flex-col border-2">
        {/* Header */}
        <CardHeader
          className="py-2 px-3 border-b cursor-move select-none bg-primary text-primary-foreground"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-primary-foreground text-primary">
                  {conversationName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm truncate max-w-[150px]">
                {conversationName}
              </span>
            </div>
            <div className="flex items-center gap-1 chat-controls">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Camera className="h-4 w-4 mr-2" />
                    匯出對話截圖
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={onMinimize}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={onPopout}
                title="在新視窗開啟"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 p-2 overflow-hidden">
          <ScrollArea className="h-full">
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
                    'flex gap-1.5 mb-1.5',
                    isOwn ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {!isOwn && showAvatar && (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={msg.sender.avatarUrl || undefined} />
                      <AvatarFallback className="text-[10px]">{msg.sender.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  )}
                  {!isOwn && !showAvatar && <div className="w-6" />}

                  <div className={cn('max-w-[75%]', isOwn ? 'items-end' : 'items-start')}>
                    <div
                      className={cn(
                        'rounded-xl px-3 py-1.5 text-sm',
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted rounded-tl-sm',
                        msg.isDeleted && 'italic opacity-60'
                      )}
                    >
                      {msg.isDeleted ? (
                        <span className="text-xs">訊息已收回</span>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {msg.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    'flex items-center gap-1 p-1 rounded text-xs',
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
                      'flex items-center gap-0.5 mt-0.5',
                      isOwn ? 'justify-end' : 'justify-start'
                    )}>
                      <span className="text-[9px] text-muted-foreground">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                      {isOwn && (
                        isRead ? (
                          <CheckCheck className="h-2.5 w-2.5 text-blue-500" />
                        ) : (
                          <Check className="h-2.5 w-2.5 text-muted-foreground" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </ScrollArea>
        </CardContent>

        {/* Pending attachments */}
        {pendingAttachments.length > 0 && (
          <div className="px-2 py-1 border-t bg-muted/50">
            <div className="flex gap-1 flex-wrap">
              {pendingAttachments.map((att, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-background rounded px-1.5 py-0.5 text-xs"
                >
                  {getFileIcon(att.fileType)}
                  <span className="truncate max-w-[60px]">{att.fileName}</span>
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
        <div className="p-2 border-t">
          <div className="flex gap-1">
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
              className="h-8 w-8"
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
              className="h-8 text-sm"
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
              size="icon"
              className="h-8 w-8"
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

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <svg
            className="w-4 h-4 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      </Card>
    </div>
  )
}

// Minimized chat bubble
interface MinimizedChatBubbleProps {
  conversationName: string
  unreadCount: number
  onClick: () => void
  onClose: () => void
  position: number
}

export function MinimizedChatBubble({
  conversationName,
  unreadCount,
  onClick,
  onClose,
  position,
}: MinimizedChatBubbleProps) {
  return (
    <div
      className="fixed bottom-4 z-50 cursor-pointer group"
      style={{ right: 16 + position * 60 }}
    >
      <div
        className="relative"
        onClick={onClick}
      >
        <Avatar className="h-12 w-12 border-2 border-background shadow-lg hover:scale-105 transition-transform">
          <AvatarFallback className="bg-primary text-primary-foreground">
            {conversationName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
