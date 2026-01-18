'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Camera, Download, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Message {
  id: string
  content: string
  senderId: string
  sender: {
    name: string
  }
  createdAt: Date
  isDeleted: boolean
}

interface ConversationExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationName: string
  messages: Message[]
  currentUserId: string
}

type ExportRange = 'recent_10' | 'recent_50' | 'today' | 'custom'

export function ConversationExportDialog({
  open,
  onOpenChange,
  conversationName,
  messages,
  currentUserId,
}: ConversationExportDialogProps) {
  const [exportRange, setExportRange] = useState<ExportRange>('recent_10')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const getFilteredMessages = (): Message[] => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (exportRange) {
      case 'recent_10':
        return messages.slice(-10)
      case 'recent_50':
        return messages.slice(-50)
      case 'today':
        return messages.filter(m => new Date(m.createdAt) >= today)
      case 'custom':
        const start = customStartDate ? new Date(customStartDate) : new Date(0)
        const end = customEndDate ? new Date(customEndDate + 'T23:59:59') : new Date()
        return messages.filter(m => {
          const msgDate = new Date(m.createdAt)
          return msgDate >= start && msgDate <= end
        })
      default:
        return messages.slice(-10)
    }
  }

  const generateImage = async () => {
    setIsExporting(true)

    try {
      const filteredMessages = getFilteredMessages()
      if (filteredMessages.length === 0) {
        alert('沒有符合條件的訊息')
        setIsExporting(false)
        return
      }

      // Create canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Cannot get canvas context')
      }

      // Settings
      const padding = 40
      const messageGap = 16
      const avatarSize = 36
      const maxWidth = 600
      const bubbleMaxWidth = 400
      const fontSize = 14
      const smallFontSize = 11
      const lineHeight = 1.5

      // Calculate height
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

      let totalHeight = padding * 2 + 60 // Header + footer

      for (const msg of filteredMessages) {
        const text = msg.isDeleted ? '訊息已收回' : msg.content
        const lines = wrapText(ctx, text, bubbleMaxWidth - 24)
        const bubbleHeight = lines.length * fontSize * lineHeight + 16
        totalHeight += bubbleHeight + messageGap + 20 // +20 for sender name and time
      }

      // Set canvas size
      canvas.width = maxWidth
      canvas.height = totalHeight

      // Background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Header
      ctx.fillStyle = '#1e293b'
      ctx.font = `bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      ctx.fillText(conversationName, padding, padding + 20)

      // Date range
      ctx.fillStyle = '#64748b'
      ctx.font = `${smallFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      const startTime = format(new Date(filteredMessages[0].createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })
      const endTime = format(new Date(filteredMessages[filteredMessages.length - 1].createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })
      ctx.fillText(`${startTime} - ${endTime}`, padding, padding + 42)

      // Draw messages
      let y = padding + 70

      for (const msg of filteredMessages) {
        const isOwn = msg.senderId === currentUserId
        const text = msg.isDeleted ? '訊息已收回' : msg.content
        const lines = wrapText(ctx, text, bubbleMaxWidth - 24)
        const bubbleHeight = lines.length * fontSize * lineHeight + 16
        const bubbleWidth = Math.min(
          bubbleMaxWidth,
          Math.max(...lines.map(l => ctx.measureText(l).width)) + 24
        )

        // Sender name (for others)
        if (!isOwn) {
          ctx.fillStyle = '#64748b'
          ctx.font = `${smallFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
          ctx.fillText(msg.sender.name, padding + avatarSize + 8, y)
          y += 16
        }

        // Bubble
        const bubbleX = isOwn ? maxWidth - padding - bubbleWidth : padding + avatarSize + 8

        ctx.fillStyle = isOwn ? '#2563eb' : '#f1f5f9'
        roundRect(ctx, bubbleX, y, bubbleWidth, bubbleHeight, 16)
        ctx.fill()

        // Text
        ctx.fillStyle = isOwn ? '#ffffff' : '#1e293b'
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

        let textY = y + 12 + fontSize * 0.8
        for (const line of lines) {
          ctx.fillText(line, bubbleX + 12, textY)
          textY += fontSize * lineHeight
        }

        y += bubbleHeight + 4

        // Time
        ctx.fillStyle = '#94a3b8'
        ctx.font = `${smallFontSize - 1}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        const time = format(new Date(msg.createdAt), 'HH:mm')
        const timeWidth = ctx.measureText(time).width
        const timeX = isOwn ? maxWidth - padding - timeWidth : padding + avatarSize + 8
        ctx.fillText(time, timeX, y)

        y += messageGap
      }

      // Footer
      ctx.fillStyle = '#94a3b8'
      ctx.font = `${smallFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      ctx.fillText('由 ERP 系統產生', padding, totalHeight - padding)

      // Generate URL
      const url = canvas.toDataURL('image/png')
      setPreviewUrl(url)
    } catch (error) {
      console.error('Export failed:', error)
      alert('匯出失敗')
    } finally {
      setIsExporting(false)
    }
  }

  const downloadImage = () => {
    if (!previewUrl) return

    const link = document.createElement('a')
    link.href = previewUrl
    link.download = `對話截圖-${conversationName}-${format(new Date(), 'yyyyMMdd-HHmmss')}.png`
    link.click()
  }

  const handleClose = () => {
    setPreviewUrl(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>匯出對話截圖</DialogTitle>
        </DialogHeader>

        {!previewUrl ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>選擇範圍</Label>
                <Select value={exportRange} onValueChange={(v) => setExportRange(v as ExportRange)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent_10">最近 10 則訊息</SelectItem>
                    <SelectItem value="recent_50">最近 50 則訊息</SelectItem>
                    <SelectItem value="today">今日對話</SelectItem>
                    <SelectItem value="custom">自訂時間範圍</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {exportRange === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>開始日期</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>結束日期</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                目前對話共有 {messages.length} 則訊息
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={generateImage} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                產生截圖
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex justify-center bg-muted rounded-lg p-4 max-h-[60vh] overflow-auto">
              <img
                src={previewUrl}
                alt="Conversation export preview"
                className="max-w-full h-auto rounded shadow-lg"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewUrl(null)}>
                重新選擇
              </Button>
              <Button onClick={downloadImage}>
                <Download className="h-4 w-4 mr-2" />
                下載圖片
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Helper function to wrap text
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    const words = paragraph.split('')
    let currentLine = ''

    for (const char of words) {
      const testLine = currentLine + char
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  }

  return lines.length > 0 ? lines : ['']
}

// Helper function to draw rounded rectangle
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}
