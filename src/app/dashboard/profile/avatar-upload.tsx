'use client'

import { useState, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Camera, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface AvatarUploadProps {
  employeeId: string
  employeeName: string
  avatarUrl: string | null
}

export function AvatarUpload({ employeeId, employeeName, avatarUrl }: AvatarUploadProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('請選擇有效的圖片格式 (JPG, PNG, GIF, WebP)')
      return
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('檔案大小不能超過 2MB')
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('employeeId', employeeId)

      const response = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '上傳失敗')
      }

      toast.success('頭像上傳成功')
      setIsDialogOpen(false)
      setSelectedFile(null)
      setPreviewUrl(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上傳失敗')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!avatarUrl) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/avatar/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '刪除失敗')
      }

      toast.success('頭像已刪除')
      setIsDialogOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刪除失敗')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setSelectedFile(null)
    setPreviewUrl(null)
  }

  return (
    <>
      <button
        onClick={() => setIsDialogOpen(true)}
        className="relative group cursor-pointer"
        type="button"
      >
        <Avatar className="h-20 w-20 transition-opacity group-hover:opacity-80">
          <AvatarImage src={avatarUrl || undefined} alt={employeeName} />
          <AvatarFallback className="text-xl">
            {employeeName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="h-6 w-6 text-white" />
        </div>
      </button>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>更換頭像</DialogTitle>
            <DialogDescription>
              上傳新的頭像照片，支援 JPG、PNG、GIF、WebP 格式，最大 2MB
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview area */}
            <div className="flex justify-center">
              <Avatar className="h-32 w-32">
                <AvatarImage src={previewUrl || avatarUrl || undefined} alt={employeeName} />
                <AvatarFallback className="text-3xl">
                  {employeeName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {previewUrl ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? '上傳中...' : '確認上傳'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  選擇照片
                </Button>
              )}

              {avatarUrl && !previewUrl && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? '刪除中...' : '刪除現有頭像'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
