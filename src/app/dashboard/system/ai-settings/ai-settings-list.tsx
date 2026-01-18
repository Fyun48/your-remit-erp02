'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Bot,
  Key,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

interface AISettingsListProps {
  userId: string
}

const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (推薦)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (較快速)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (經濟)' },
]

const GEMINI_MODELS = [
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (推薦)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (較快速)' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
]

export function AISettingsList({ userId }: AISettingsListProps) {
  const [provider, setProvider] = useState<string>('disabled')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testMessage, setTestMessage] = useState('')

  const configQuery = trpc.ai.getConfig.useQuery(undefined, {
    onSuccess: (data) => {
      setProvider(data.provider)
      setModel(data.model)
    },
  })

  const updateMutation = trpc.ai.updateConfig.useMutation({
    onSuccess: () => {
      configQuery.refetch()
      setApiKey('')
      setTestResult(null)
    },
  })

  const chatMutation = trpc.ai.chat.useMutation()

  const handleSave = () => {
    updateMutation.mutate({
      provider: provider as 'openai' | 'gemini' | 'disabled',
      apiKey: apiKey || undefined,
      model: model || undefined,
    })
  }

  const handleTest = async () => {
    setTestResult(null)
    setTestMessage('')

    const result = await chatMutation.mutateAsync({
      messages: [
        { role: 'user', content: '請用一句話回答：1+1=?' },
      ],
    })

    if (result.error) {
      setTestResult('error')
      setTestMessage(result.error)
    } else if (result.content) {
      setTestResult('success')
      setTestMessage(result.content)
    } else {
      setTestResult('error')
      setTestMessage('未收到回應')
    }
  }

  const getModelOptions = () => {
    if (provider === 'openai') return OPENAI_MODELS
    if (provider === 'gemini') return GEMINI_MODELS
    return []
  }

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/system">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">AI 服務設定</h1>
          <p className="text-muted-foreground">設定 AI 助理的 API 金鑰與模型</p>
        </div>
      </div>

      {/* 說明卡片 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            功能說明
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>啟用 AI 服務後，使用者可以透過右下角的 AI 助理：</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>查詢個人資料（請假紀錄、出勤狀況等）</li>
            <li>獲得系統使用說明</li>
            <li>快速執行常見操作</li>
          </ul>
          <p className="text-xs mt-4">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            API 金鑰將加密儲存，僅用於向 AI 服務商發送請求
          </p>
        </CardContent>
      </Card>

      {/* 設定表單 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API 設定
          </CardTitle>
          <CardDescription>
            選擇 AI 服務供應商並輸入 API 金鑰
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 供應商選擇 */}
          <div className="space-y-2">
            <Label htmlFor="provider">AI 服務供應商</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="選擇供應商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">停用 AI 服務</SelectItem>
                <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider !== 'disabled' && (
            <>
              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">API 金鑰</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1 md:max-w-[400px]">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={configQuery.data?.hasApiKey ? '已設定（輸入新值覆蓋）' : '輸入 API 金鑰'}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {provider === 'openai' && (
                    <>前往 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">OpenAI Platform</a> 取得金鑰</>
                  )}
                  {provider === 'gemini' && (
                    <>前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google AI Studio</a> 取得金鑰</>
                  )}
                </p>
              </div>

              {/* 模型選擇 */}
              <div className="space-y-2">
                <Label htmlFor="model">AI 模型</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="選擇模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {getModelOptions().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* 儲存按鈕 */}
          <div className="flex items-center gap-4 pt-4">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isLoading}
            >
              {updateMutation.isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              儲存設定
            </Button>

            {provider !== 'disabled' && configQuery.data?.hasApiKey && (
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={chatMutation.isLoading}
              >
                {chatMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                測試連線
              </Button>
            )}
          </div>

          {/* 儲存成功訊息 */}
          {updateMutation.isSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              設定已儲存
            </div>
          )}

          {/* 測試結果 */}
          {testResult && (
            <div className={`p-4 rounded-lg ${testResult === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={`font-medium ${testResult === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                  {testResult === 'success' ? '連線成功' : '連線失敗'}
                </span>
              </div>
              <p className={`text-sm ${testResult === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {testMessage}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 目前狀態 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">目前狀態</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${configQuery.data?.provider !== 'disabled' && configQuery.data?.hasApiKey ? 'bg-green-500' : 'bg-gray-300'}`} />
            <div>
              <p className="font-medium">
                {configQuery.data?.provider === 'disabled' ? 'AI 服務已停用' :
                  configQuery.data?.hasApiKey ? `已啟用 - ${configQuery.data.provider === 'openai' ? 'OpenAI' : 'Google Gemini'}` :
                    '尚未設定 API 金鑰'}
              </p>
              {configQuery.data?.model && configQuery.data?.provider !== 'disabled' && (
                <p className="text-sm text-muted-foreground">
                  使用模型：{configQuery.data.model}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
