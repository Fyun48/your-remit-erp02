'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Download, Smartphone, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // 檢查是否已安裝（standalone 模式）
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(checkStandalone)

    // 檢查是否為 iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(isIOSDevice)

    // 監聽安裝提示事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowPrompt(true)
      return
    }

    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
    }

    setDeferredPrompt(null)
  }

  const canInstall = deferredPrompt !== null || isIOS

  // 如果已安裝，不顯示按鈕
  if (isStandalone) return null

  return (
    <>
      {canInstall && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleInstallClick}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          安裝 App
        </Button>
      )}

      {/* iOS 安裝說明對話框 */}
      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              安裝到手機
            </DialogTitle>
            <DialogDescription>
              將 ERP 系統安裝到您的 iPhone/iPad 主畫面
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-medium">
                1
              </div>
              <div>
                <p className="font-medium">點選分享按鈕</p>
                <p className="text-sm text-muted-foreground">
                  在 Safari 瀏覽器底部找到分享圖示（方形加箭頭）
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-medium">
                2
              </div>
              <div>
                <p className="font-medium">選擇「加入主畫面」</p>
                <p className="text-sm text-muted-foreground">
                  向下滑動找到「加入主畫面」選項並點選
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-medium">
                3
              </div>
              <div>
                <p className="font-medium">確認新增</p>
                <p className="text-sm text-muted-foreground">
                  點選右上角的「新增」完成安裝
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrompt(false)}>
              <X className="h-4 w-4 mr-2" />
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
