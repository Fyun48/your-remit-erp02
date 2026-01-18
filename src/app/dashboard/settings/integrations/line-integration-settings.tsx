'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  MessageCircle,
  Bell,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  HelpCircle,
  Save,
  TestTube,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

export function LineIntegrationSettings() {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  // 表單狀態
  const [formData, setFormData] = useState({
    channelId: '',
    channelSecret: '',
    channelAccessToken: '',
    notifyClientId: '',
    notifyClientSecret: '',
    enabled: false,
  })

  // 載入設定
  const { data: config, isLoading, refetch } = trpc.systemSetting.getLineConfig.useQuery(undefined, {
    onSuccess: (data) => {
      setFormData({
        channelId: (data.LINE_CHANNEL_ID as string) || '',
        channelSecret: (data.LINE_CHANNEL_SECRET as string) || '',
        channelAccessToken: (data.LINE_CHANNEL_ACCESS_TOKEN as string) || '',
        notifyClientId: (data.LINE_NOTIFY_CLIENT_ID as string) || '',
        notifyClientSecret: (data.LINE_NOTIFY_CLIENT_SECRET as string) || '',
        enabled: data.LINE_ENABLED === 'true',
      })
    },
  })

  // 儲存設定
  const saveMutation = trpc.systemSetting.saveLineConfig.useMutation({
    onSuccess: () => {
      alert('設定已儲存')
      refetch()
    },
    onError: (err) => {
      alert(`儲存失敗: ${err.message}`)
    },
  })

  // 測試連線
  const testMutation = trpc.systemSetting.testLineConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        alert(result.message)
      } else {
        alert(result.message)
      }
    },
    onError: (err) => {
      alert(`測試失敗: ${err.message}`)
    },
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveMutation.mutateAsync(formData)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    try {
      await testMutation.mutateAsync()
    } finally {
      setIsTesting(false)
    }
  }

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">LINE 整合設定</h1>
            <p className="text-muted-foreground">設定 LINE Messaging API 與 LINE Notify</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
            />
            <Label>啟用 LINE 整合</Label>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            儲存設定
          </Button>
        </div>
      </div>

      {/* 狀態卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Messaging API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {config?.LINE_CHANNEL_ACCESS_TOKEN_SET ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-medium">已設定</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-gray-400" />
                  <span className="text-muted-foreground">未設定</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Bell className="h-4 w-4" />
              LINE Notify
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {config?.LINE_NOTIFY_CLIENT_SECRET_SET ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-medium">已設定</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-gray-400" />
                  <span className="text-muted-foreground">未設定</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={formData.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              整合狀態
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={formData.enabled ? 'default' : 'secondary'}>
              {formData.enabled ? '已啟用' : '已停用'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* 設定表單 */}
      <Tabs defaultValue="messaging" className="space-y-4">
        <TabsList>
          <TabsTrigger value="messaging" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Messaging API
          </TabsTrigger>
          <TabsTrigger value="notify" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            LINE Notify
          </TabsTrigger>
          <TabsTrigger value="help" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            設定說明
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messaging">
          <Card>
            <CardHeader>
              <CardTitle>LINE Messaging API 設定</CardTitle>
              <CardDescription>
                用於發送訊息給用戶、接收訊息、推播通知等功能
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="channelId">Channel ID</Label>
                  <Input
                    id="channelId"
                    value={formData.channelId}
                    onChange={(e) => setFormData(prev => ({ ...prev, channelId: e.target.value }))}
                    placeholder="輸入 Channel ID"
                  />
                  <p className="text-sm text-muted-foreground">
                    在 LINE Developers Console 的 Basic settings 中可找到
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channelSecret">Channel Secret</Label>
                  <div className="relative">
                    <Input
                      id="channelSecret"
                      type={showSecrets.channelSecret ? 'text' : 'password'}
                      value={formData.channelSecret}
                      onChange={(e) => setFormData(prev => ({ ...prev, channelSecret: e.target.value }))}
                      placeholder="輸入 Channel Secret"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => toggleSecretVisibility('channelSecret')}
                    >
                      {showSecrets.channelSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    用於驗證 Webhook 請求的簽名
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channelAccessToken">Channel Access Token</Label>
                  <div className="relative">
                    <Input
                      id="channelAccessToken"
                      type={showSecrets.channelAccessToken ? 'text' : 'password'}
                      value={formData.channelAccessToken}
                      onChange={(e) => setFormData(prev => ({ ...prev, channelAccessToken: e.target.value }))}
                      placeholder="輸入 Channel Access Token"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => toggleSecretVisibility('channelAccessToken')}
                    >
                      {showSecrets.channelAccessToken ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    在 Messaging API 頁面中發行 Long-lived channel access token
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting || !formData.channelAccessToken}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4 mr-2" />
                  )}
                  測試連線
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href="https://developers.line.biz/console/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    開啟 LINE Developers Console
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notify">
          <Card>
            <CardHeader>
              <CardTitle>LINE Notify 設定</CardTitle>
              <CardDescription>
                用於發送系統通知到用戶的 LINE，不需要用戶加入官方帳號
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notifyClientId">Client ID</Label>
                  <Input
                    id="notifyClientId"
                    value={formData.notifyClientId}
                    onChange={(e) => setFormData(prev => ({ ...prev, notifyClientId: e.target.value }))}
                    placeholder="輸入 LINE Notify Client ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notifyClientSecret">Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="notifyClientSecret"
                      type={showSecrets.notifyClientSecret ? 'text' : 'password'}
                      value={formData.notifyClientSecret}
                      onChange={(e) => setFormData(prev => ({ ...prev, notifyClientSecret: e.target.value }))}
                      placeholder="輸入 LINE Notify Client Secret"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => toggleSecretVisibility('notifyClientSecret')}
                    >
                      {showSecrets.notifyClientSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button variant="outline" asChild>
                  <a
                    href="https://notify-bot.line.me/my/services/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    開啟 LINE Notify 管理頁面
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="help">
          <Card>
            <CardHeader>
              <CardTitle>設定說明</CardTitle>
              <CardDescription>
                如何取得 LINE API 憑證
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Messaging API 說明 */}
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  LINE Messaging API 設定步驟
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>前往 <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-primary underline">LINE Developers Console</a></li>
                  <li>登入您的 LINE 帳號</li>
                  <li>建立新的 Provider（如果還沒有的話）</li>
                  <li>在 Provider 下建立新的 Messaging API Channel</li>
                  <li>在 Basic settings 頁面複製 <strong>Channel ID</strong> 和 <strong>Channel Secret</strong></li>
                  <li>在 Messaging API 頁面發行 <strong>Channel Access Token</strong>（選擇 Long-lived）</li>
                  <li>設定 Webhook URL 為：<code className="bg-muted px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/line/webhook</code></li>
                  <li>開啟 Use webhook 選項</li>
                </ol>
              </div>

              {/* LINE Notify 說明 */}
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-500" />
                  LINE Notify 設定步驟
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>前往 <a href="https://notify-bot.line.me/my/services/" target="_blank" rel="noopener noreferrer" className="text-primary underline">LINE Notify 管理頁面</a></li>
                  <li>點擊「登錄服務」建立新服務</li>
                  <li>填寫服務名稱和 Callback URL</li>
                  <li>Callback URL 設定為：<code className="bg-muted px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/line/notify/callback</code></li>
                  <li>建立完成後複製 <strong>Client ID</strong> 和 <strong>Client Secret</strong></li>
                </ol>
              </div>

              {/* 功能說明 */}
              <div className="space-y-3">
                <h3 className="font-bold">功能用途</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <div className="font-medium text-green-700 mb-2">Messaging API</div>
                    <ul className="list-disc list-inside text-green-600 space-y-1">
                      <li>雙向訊息（傳送和接收）</li>
                      <li>豐富訊息格式（圖片、按鈕等）</li>
                      <li>用戶需加入官方帳號好友</li>
                      <li>適合客服、互動機器人</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="font-medium text-blue-700 mb-2">LINE Notify</div>
                    <ul className="list-disc list-inside text-blue-600 space-y-1">
                      <li>單向推播通知</li>
                      <li>簡單文字訊息</li>
                      <li>用戶授權即可接收</li>
                      <li>適合系統提醒、狀態通知</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
