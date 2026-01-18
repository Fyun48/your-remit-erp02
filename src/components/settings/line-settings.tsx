'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Loader2, Link2, Unlink, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface LineSettingsProps {
  userId: string
}

export function LineSettings({ userId }: LineSettingsProps) {
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false)

  const { data: status, isLoading, refetch } = trpc.line.getStatus.useQuery({ userId })
  const { data: config } = trpc.line.isConfigured.useQuery()
  const { data: authData } = trpc.line.getAuthUrl.useQuery(
    { userId, redirectUrl: '/dashboard/settings' },
    { enabled: !status?.isLinked && config?.isConfigured }
  )

  const unlinkMutation = trpc.line.unlink.useMutation({
    onSuccess: () => {
      refetch()
      setShowUnlinkDialog(false)
    },
  })

  const handleLinkLine = () => {
    if (authData?.authUrl) {
      window.location.href = authData.authUrl
    }
  }

  const handleUnlink = () => {
    unlinkMutation.mutate({ userId })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!config?.isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#00B900">
              <path d="M12 2C6.48 2 2 5.82 2 10.5c0 3.58 2.65 6.6 6.35 7.89-.09.35-.22.63-.38.89-.21.35-.35.6-.49.87-.14.27-.27.51-.32.8-.05.29.02.61.24.84.22.23.51.33.8.28.29-.05.57-.15.83-.27.58-.27 1.14-.57 1.69-.89 1.07.22 2.2.34 3.38.34 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/>
            </svg>
            LINE 帳號連動
          </CardTitle>
          <CardDescription>
            系統尚未設定 LINE 整合功能
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>請聯繫系統管理員以啟用此功能</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#00B900">
              <path d="M12 2C6.48 2 2 5.82 2 10.5c0 3.58 2.65 6.6 6.35 7.89-.09.35-.22.63-.38.89-.21.35-.35.6-.49.87-.14.27-.27.51-.32.8-.05.29.02.61.24.84.22.23.51.33.8.28.29-.05.57-.15.83-.27.58-.27 1.14-.57 1.69-.89 1.07.22 2.2.34 3.38.34 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/>
            </svg>
            LINE 帳號連動
          </CardTitle>
          <CardDescription>
            連結您的 LINE 帳號，即可將訊息分享到 LINE
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.isLinked ? (
            <>
              <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">已連結 LINE 帳號</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                      {status.isTokenValid ? '有效' : '需重新授權'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    LINE ID: {status.lineUserId}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {!status.isTokenValid && (
                  <Button onClick={handleLinkLine}>
                    <Link2 className="h-4 w-4 mr-2" />
                    重新授權
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowUnlinkDialog(true)}
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  解除連結
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="h-12 w-12 rounded-full bg-[#00B900] flex items-center justify-center">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C6.48 2 2 5.82 2 10.5c0 3.58 2.65 6.6 6.35 7.89-.09.35-.22.63-.38.89-.21.35-.35.6-.49.87-.14.27-.27.51-.32.8-.05.29.02.61.24.84.22.23.51.33.8.28.29-.05.57-.15.83-.27.58-.27 1.14-.57 1.69-.89 1.07.22 2.2.34 3.38.34 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium">連結您的 LINE 帳號</p>
                  <p className="text-sm text-muted-foreground">
                    連結後可將 ERP 系統中的訊息、截圖等內容快速分享到 LINE
                  </p>
                </div>
              </div>

              <Button onClick={handleLinkLine} className="bg-[#00B900] hover:bg-[#00A000]">
                <ExternalLink className="h-4 w-4 mr-2" />
                連結 LINE 帳號
              </Button>

              <p className="text-xs text-muted-foreground">
                點擊後將跳轉到 LINE 授權頁面，請使用您的 LINE 帳號登入並授權
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要解除 LINE 連結？</AlertDialogTitle>
            <AlertDialogDescription>
              解除連結後，您將無法使用 LINE 分享功能。您可以隨時重新連結帳號。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              解除連結
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
