'use client'

import * as React from 'react'
import { useCallback, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Upload,
  X,
  File,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react'

export interface UploadedFile {
  name: string
  url: string
  size?: number
}

export interface FileUploadProps {
  /** Upload API endpoint */
  uploadUrl: string
  /** Field name for the request number or folder identifier */
  requestNo?: string
  /** Callback when files are successfully uploaded */
  onUploadComplete?: (files: UploadedFile[]) => void
  /** Callback when a file is removed */
  onRemove?: (file: UploadedFile) => void
  /** Currently uploaded files */
  value?: UploadedFile[]
  /** Maximum number of files */
  maxFiles?: number
  /** Maximum file size in bytes */
  maxSize?: number
  /** Accepted file types (MIME types or extensions) */
  accept?: string
  /** Hint text to display */
  hint?: string
  /** Whether the upload is disabled */
  disabled?: boolean
  /** Additional className for the dropzone */
  className?: string
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return <File className="h-4 w-4" />

  if (['pdf'].includes(ext)) {
    return <FileText className="h-4 w-4 text-red-500" />
  }
  if (['doc', 'docx'].includes(ext)) {
    return <FileText className="h-4 w-4 text-blue-500" />
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return <ImageIcon className="h-4 w-4 text-green-500" />
  }
  return <File className="h-4 w-4" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function FileUpload({
  uploadUrl,
  requestNo,
  onUploadComplete,
  onRemove,
  value = [],
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024,
  accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg',
  hint,
  disabled = false,
  className,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const canUploadMore = value.length < maxFiles

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      if (disabled || !canUploadMore) return

      const fileArray = Array.from(files)
      const remainingSlots = maxFiles - value.length
      const filesToUpload = fileArray.slice(0, remainingSlots)

      if (filesToUpload.length === 0) {
        setError(`已達上傳上限 (${maxFiles} 個檔案)`)
        return
      }

      // Client-side validation
      const validFiles: File[] = []
      const validationErrors: string[] = []

      for (const file of filesToUpload) {
        if (file.size > maxSize) {
          validationErrors.push(`${file.name}: 檔案大小超過限制`)
          continue
        }
        validFiles.push(file)
      }

      if (validFiles.length === 0) {
        setError(validationErrors.join('; '))
        return
      }

      setIsUploading(true)
      setError(null)

      try {
        const formData = new FormData()
        validFiles.forEach((file) => formData.append('files', file))
        if (requestNo) {
          formData.append('requestNo', requestNo)
        }

        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || '上傳失敗')
        }

        if (result.files && result.files.length > 0) {
          onUploadComplete?.(result.files)
        }

        if (result.errors && result.errors.length > 0) {
          setError(result.errors.join('; '))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '上傳失敗')
      } finally {
        setIsUploading(false)
        // Reset input
        if (inputRef.current) {
          inputRef.current.value = ''
        }
      }
    },
    [disabled, canUploadMore, maxFiles, maxSize, value.length, uploadUrl, requestNo, onUploadComplete]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled && canUploadMore) {
        setIsDragOver(true)
      }
    },
    [disabled, canUploadMore]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (!disabled && canUploadMore && e.dataTransfer.files) {
        handleUpload(e.dataTransfer.files)
      }
    },
    [disabled, canUploadMore, handleUpload]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleUpload(e.target.files)
      }
    },
    [handleUpload]
  )

  const handleRemove = useCallback(
    (file: UploadedFile) => {
      onRemove?.(file)
      setError(null)
    },
    [onRemove]
  )

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-colors',
          isDragOver && 'border-primary bg-primary/5',
          disabled || !canUploadMore
            ? 'border-muted bg-muted/50 cursor-not-allowed'
            : 'border-muted-foreground/25 hover:border-primary/50 cursor-pointer',
          className
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && canUploadMore && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          onChange={handleFileSelect}
          disabled={disabled || !canUploadMore}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2 text-center">
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">上傳中...</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {canUploadMore ? '拖放檔案或點擊上傳' : `已達上傳上限 (${maxFiles} 個)`}
                </p>
                {hint && (
                  <p className="text-xs text-muted-foreground whitespace-pre-line">
                    {hint}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Uploaded files list */}
      {value.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            已上傳檔案 ({value.length}/{maxFiles})
          </p>
          <div className="space-y-2">
            {value.map((file, index) => (
              <div
                key={`${file.url}-${index}`}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                {getFileIcon(file.name)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  {file.size && (
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(file)
                  }}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
