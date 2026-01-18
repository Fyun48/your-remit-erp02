'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  MessageSquare,
  Send,
  Paperclip,
  Search,
  Plus,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  File,
  Check,
  CheckCheck,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format, isToday, isYesterday, isThisYear } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface MessagingClientProps {
  userId: string
}

export function MessagingClient({ userId }: MessagingClientProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState('')
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])
  const [pendingAttachments, setPendingAttachments] = useState<Array<{
    fileName: string
    fileType: string
    fileSize: number
    fileUrl: string
  }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // API Queries
  const conversationsQuery = trpc.messaging.getConversations.useQuery(
    { userId },
    { refetchInterval: 10000 } // 每 10 秒重新取得
  )

  const messagesQuery = trpc.messaging.getMessages.useQuery(
    { userId, conversationId: selectedConversationId || '' },
    { enabled: !!selectedConversationId, refetchInterval: 5000 }
  )

  const employeeSearchQuery = trpc.messaging.searchEmployees.useQuery(
    { userId, query: newChatSearch },
    { enabled: newChatSearch.length >= 1 }
  )

  // Mutations
  const sendMessageMutation = trpc.messaging.sendMessage.useMutation({
    onSuccess: () => {
      setMessageInput('')
      setPendingAttachments([])
      conversationsQuery.refetch()
      messagesQuery.refetch()
    },
  })

  const createConversationMutation = trpc.messaging.getOrCreateDirectConversation.useMutation({
    onSuccess: (data) => {
      setSelectedConversationId(data.id)
      setShowNewChatDialog(false)
      setNewChatSearch('')
      conversationsQuery.refetch()
    },
  })

  const markAsReadMutation = trpc.messaging.markAsRead.useMutation({
    onSuccess: () => {
      conversationsQuery.refetch()
    },
  })

  // 滾動到最新訊息
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (messagesQuery.data?.messages) {
      scrollToBottom()
    }
  }, [messagesQuery.data?.messages, scrollToBottom])

  // 選擇對話時標記已讀
  useEffect(() => {
    if (selectedConversationId) {
      markAsReadMutation.mutate({ userId, conversationId: selectedConversationId })
    }
  }, [selectedConversationId, userId])

  // 發送訊息
  const handleSendMessage = () => {
    if ((!messageInput.trim() && pendingAttachments.length === 0) || !selectedConversationId) return

    sendMessageMutation.mutate({
      userId,
      conversationId: selectedConversationId,
      content: messageInput.trim() || ' ', // 如果只有附件則發送空格
      attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
    })
  }

  // 檔案上傳
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
        } else {
          const error = await response.json()
          alert(error.error || '上傳失敗')
        }
      } catch {
        alert('上傳失敗')
      }
    }

    setUploadingFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 移除待發送的附件
  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // 開始新對話
  const handleStartChat = (otherUserId: string) => {
    createConversationMutation.mutate({ userId, otherUserId })
  }

  // 格式化時間
  const formatMessageTime = (date: Date) => {
    const d = new Date(date)
    if (isToday(d)) return format(d, 'HH:mm')
    if (isYesterday(d)) return `昨天 ${format(d, 'HH:mm')}`
    if (isThisYear(d)) return format(d, 'MM/dd HH:mm')
    return format(d, 'yyyy/MM/dd HH:mm')
  }

  // 取得檔案圖示
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />
    return <File className="h-4 w-4" />
  }

  // 過濾對話列表
  const filteredConversations = conversationsQuery.data?.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const selectedConversation = conversationsQuery.data?.find(c => c.id === selectedConversationId)

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* 左側：對話列表 */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              訊息
            </CardTitle>
            <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>開始新對話</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="搜尋員工姓名或工號..."
                    value={newChatSearch}
                    onChange={(e) => setNewChatSearch(e.target.value)}
                  />
                  <ScrollArea className="h-[300px]">
                    {employeeSearchQuery.data?.map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg cursor-pointer"
                        onClick={() => handleStartChat(emp.id)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={emp.avatarUrl || undefined} />
                          <AvatarFallback>{emp.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {emp.employeeNo} · {emp.department} · {emp.position}
                          </div>
                        </div>
                      </div>
                    ))}
                    {newChatSearch && employeeSearchQuery.data?.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        找不到符合的員工
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋對話..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-2 overflow-hidden">
          <ScrollArea className="h-full">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent',
                  selectedConversationId === conv.id && 'bg-accent'
                )}
                onClick={() => setSelectedConversationId(conv.id)}
              >
                <Avatar>
                  <AvatarFallback>{conv.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{conv.name}</span>
                    {conv.unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] px-1.5">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessage.isDeleted
                        ? '訊息已收回'
                        : conv.lastMessage.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {filteredConversations.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                {searchQuery ? '找不到符合的對話' : '尚無對話'}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 右側：聊天視窗 */}
      <Card className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* 對話標題 */}
            <CardHeader className="py-3 border-b">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{selectedConversation.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{selectedConversation.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.type === 'DIRECT' ? '私人對話' : '群組'}
                  </p>
                </div>
              </div>
            </CardHeader>

            {/* 訊息列表 */}
            <CardContent className="flex-1 p-4 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                {messagesQuery.data?.messages.map((msg, index) => {
                  const isOwn = msg.senderId === userId
                  const showAvatar = index === 0 ||
                    messagesQuery.data?.messages[index - 1]?.senderId !== msg.senderId

                  // 判斷已讀狀態：對方的 lastReadAt > 訊息的 createdAt 表示已讀
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
                                        'flex items-center gap-2 p-2 rounded',
                                        isOwn ? 'bg-primary-foreground/20' : 'bg-background'
                                      )}
                                    >
                                      {getFileIcon(att.fileType)}
                                      <span className="text-xs truncate">{att.fileName}</span>
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
                          {/* 已讀狀態：✓ 已送達、✓✓ 已讀取 */}
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
            </CardContent>

            {/* 待發送附件預覽 */}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => removePendingAttachment(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 訊息輸入區 */}
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>選擇一個對話開始聊天</p>
              <p className="text-sm mt-1">或點擊 + 開始新對話</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
