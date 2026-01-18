'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Camera, X, Check, Loader2 } from 'lucide-react'

interface ScreenCaptureProps {
  onCapture: (file: File) => void
  disabled?: boolean
}

export function ScreenCaptureButton({ onCapture, disabled }: ScreenCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const captureScreen = async () => {
    try {
      setIsCapturing(true)

      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: false,
      })

      // Create video element to capture frame
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()

      // Wait a frame for video to be ready
      await new Promise(resolve => requestAnimationFrame(resolve))

      // Create canvas and draw video frame
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0)

      // Stop all tracks
      stream.getTracks().forEach(track => track.stop())

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create blob'))
          },
          'image/png',
          1.0
        )
      })

      // Create preview URL
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setCapturedBlob(blob)
      setShowPreview(true)
    } catch (error) {
      console.error('Screen capture failed:', error)
    } finally {
      setIsCapturing(false)
    }
  }

  const handleConfirm = () => {
    if (capturedBlob) {
      const file = new File([capturedBlob], `screenshot-${Date.now()}.png`, {
        type: 'image/png',
      })
      onCapture(file)
    }
    handleClose()
  }

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setCapturedBlob(null)
    setShowPreview(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={captureScreen}
        disabled={disabled || isCapturing}
        title="螢幕截圖 (Ctrl+Shift+S)"
      >
        {isCapturing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
      </Button>

      <Dialog open={showPreview} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>螢幕截圖預覽</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center bg-muted rounded-lg p-4 max-h-[60vh] overflow-auto">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Screenshot preview"
                className="max-w-full h-auto rounded shadow-lg"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleConfirm}>
              <Check className="h-4 w-4 mr-2" />
              貼上對話
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Region selection screen capture (more advanced)
interface RegionCaptureOverlayProps {
  onCapture: (blob: Blob) => void
  onCancel: () => void
}

export function RegionCaptureOverlay({ onCapture, onCancel }: RegionCaptureOverlayProps) {
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [endPos, setEndPos] = useState({ x: 0, y: 0 })
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsSelecting(true)
    setStartPos({ x: e.clientX, y: e.clientY })
    setEndPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelecting) {
      setEndPos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = async () => {
    if (!isSelecting) return
    setIsSelecting(false)

    const rect = {
      x: Math.min(startPos.x, endPos.x),
      y: Math.min(startPos.y, endPos.y),
      width: Math.abs(endPos.x - startPos.x),
      height: Math.abs(endPos.y - startPos.y),
    }

    if (rect.width < 10 || rect.height < 10) {
      onCancel()
      return
    }

    try {
      // Capture the screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      })

      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()

      await new Promise(resolve => requestAnimationFrame(resolve))

      // Calculate scale factor
      const scaleX = video.videoWidth / window.innerWidth
      const scaleY = video.videoHeight / window.innerHeight

      // Create canvas for the selected region
      const canvas = document.createElement('canvas')
      canvas.width = rect.width * scaleX
      canvas.height = rect.height * scaleY
      const ctx = canvas.getContext('2d')

      ctx?.drawImage(
        video,
        rect.x * scaleX,
        rect.y * scaleY,
        rect.width * scaleX,
        rect.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      )

      stream.getTracks().forEach(track => track.stop())

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create blob'))
          },
          'image/png',
          1.0
        )
      })

      onCapture(blob)
    } catch (error) {
      console.error('Region capture failed:', error)
      onCancel()
    }
  }

  const selectionRect = {
    left: Math.min(startPos.x, endPos.x),
    top: Math.min(startPos.y, endPos.y),
    width: Math.abs(endPos.x - startPos.x),
    height: Math.abs(endPos.y - startPos.y),
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] cursor-crosshair"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      tabIndex={0}
    >
      {/* Instructions */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg text-sm">
        拖曳選擇截圖區域，按 ESC 取消
      </div>

      {/* Selection rectangle */}
      {isSelecting && selectionRect.width > 0 && selectionRect.height > 0 && (
        <div
          className="absolute border-2 border-primary bg-primary/10"
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        />
      )}

      {/* Cancel button */}
      <Button
        variant="outline"
        size="sm"
        className="absolute bottom-4 right-4"
        onClick={onCancel}
      >
        <X className="h-4 w-4 mr-2" />
        取消
      </Button>
    </div>
  )
}
