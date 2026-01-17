'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
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

export function PWAInstallPrompt() {
  const [showQRCode, setShowQRCode] = useState(false)
  const [installUrl, setInstallUrl] = useState('')
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // 檢查是否已安裝（standalone 模式）
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(checkStandalone)

    // 設定安裝 URL（使用當前網站的根路徑）
    if (typeof window !== 'undefined') {
      setInstallUrl(window.location.origin)
    }
  }, [])

  // 如果已安裝（在 App 內），不顯示按鈕
  if (isStandalone) return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowQRCode(true)}
        className="gap-2 w-full justify-start text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white"
      >
        <Download className="h-4 w-4" />
        安裝 App
      </Button>

      {/* QR Code 對話框 */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              安裝 MY-ERP App
            </DialogTitle>
            <DialogDescription>
              使用手機掃描 QR Code 安裝應用程式
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-lg shadow-inner">
              <QRCodeSVG
                value={installUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground text-center">
              掃描後請依照提示將網頁加入主畫面
            </p>
          </div>

          {/* 安裝說明 */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">掃描後安裝步驟：</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
                <span><strong>Android：</strong>點選「安裝應用程式」或選單中的「新增至主畫面」</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
                <span><strong>iOS：</strong>點選分享按鈕 → 「加入主畫面」</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQRCode(false)} className="w-full">
              <X className="h-4 w-4 mr-2" />
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
