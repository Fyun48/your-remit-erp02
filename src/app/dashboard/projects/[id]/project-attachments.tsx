'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Loader2,
  User,
  Layers,
  CheckSquare,
  ExternalLink,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface ProjectAttachmentsProps {
  projectId: string
  currentUserId: string
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType === 'application/pdf') return FileText
  return File
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ProjectAttachments({ projectId, currentUserId }: ProjectAttachmentsProps) {
  const utils = trpc.useUtils()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: attachments, isLoading } = trpc.project.getAttachments.useQuery({
    projectId,
  })

  const deleteAttachment = trpc.project.deleteAttachment.useMutation({
    onSuccess: () => {
      utils.project.getAttachments.invalidate({ projectId })
      utils.project.getActivities.invalidate({ projectId })
      setDeletingAttachmentId(null)
    },
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      Array.from(files).forEach(file => {
        formData.append('files', file)
      })
      formData.append('projectId', projectId)

      const response = await fetch('/api/projects/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        setUploadError(result.error || '上傳失敗')
      } else {
        utils.project.getAttachments.invalidate({ projectId })
        utils.project.getActivities.invalidate({ projectId })
        if (result.errors && result.errors.length > 0) {
          setUploadError(result.errors.join('; '))
        }
      }
    } catch {
      setUploadError('上傳失敗，請稍後再試')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = () => {
    if (!deletingAttachmentId) return
    deleteAttachment.mutate({
      id: deletingAttachmentId,
      actorId: currentUserId,
    })
  }

  const getTargetLabel = (attachment: { phase?: { name: string } | null; task?: { name: string } | null }) => {
    if (attachment.task) {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <CheckSquare className="h-3 w-3" />
          {attachment.task.name}
        </Badge>
      )
    }
    if (attachment.phase) {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <Layers className="h-3 w-3" />
          {attachment.phase.name}
        </Badge>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            附件
            {attachments && attachments.length > 0 && (
              <Badge variant="secondary">{attachments.length}</Badge>
            )}
          </CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.txt,.csv"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              上傳檔案
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {uploadError}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : attachments && attachments.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {attachments.map((attachment) => {
                const Icon = getFileIcon(attachment.mimeType)
                const isImage = attachment.mimeType.startsWith('image/')

                return (
                  <div
                    key={attachment.id}
                    className={cn(
                      'p-4 border rounded-lg hover:bg-accent/50 transition-colors',
                      attachment.uploaderId === currentUserId && 'bg-primary/5'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* File Icon or Preview */}
                      <div className="flex-shrink-0">
                        {isImage ? (
                          <div className="w-16 h-16 rounded border overflow-hidden bg-muted">
                            <img
                              src={attachment.fileUrl}
                              alt={attachment.fileName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                            <Icon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{attachment.fileName}</span>
                          {getTargetLabel(attachment)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>{formatFileSize(attachment.fileSize)}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {attachment.uploader.name}
                          </span>
                          <span>·</span>
                          <span>{format(new Date(attachment.createdAt), 'MM/dd HH:mm', { locale: zhTW })}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a href={attachment.fileUrl} download={attachment.fileName}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        {attachment.uploaderId === currentUserId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingAttachmentId(attachment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Paperclip className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>尚無附件</p>
            <p className="text-sm">上傳專案相關文件</p>
          </div>
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingAttachmentId} onOpenChange={() => setDeletingAttachmentId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>刪除附件</AlertDialogTitle>
              <AlertDialogDescription>
                確定要刪除這個附件嗎？此操作無法復原。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                {deleteAttachment.isPending ? '刪除中...' : '確定刪除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
