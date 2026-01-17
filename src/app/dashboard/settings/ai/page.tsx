'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Bot, Key, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { trpc } from '@/lib/trpc'

const OPENAI_MODELS = [
  { id: 'gpt-4', name: 'GPT-4' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
]

const GEMINI_MODELS = [
  { id: 'gemini-pro', name: 'Gemini Pro' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
]

export default function AISettingsPage() {
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'disabled'>('disabled')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 取得目前設定
  const { data: config, isLoading } = trpc.ai.getConfig.useQuery()

  const updateConfig = trpc.ai.updateConfig.useMutation({
    onSuccess: () => {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      setApiKey('') // 清除 API Key 輸入
    },
  })

  // 初始化表單
  useEffect(() => {
    if (config) {
      setProvider(config.provider)
      setModel(config.model || '')
    }
  }, [config])

  // 當 provider 變更時重設 model
  useEffect(() => {
    if (provider === 'openai' && !OPENAI_MODELS.find(m => m.id === model)) {
      setModel('gpt-3.5-turbo')
    } else if (provider === 'gemini' && !GEMINI_MODELS.find(m => m.id === model)) {
      setModel('gemini-pro')
    } else if (provider === 'disabled') {
      setModel('')
    }
  }, [provider])

  const handleSave = () => {
    updateConfig.mutate({
      provider,
      apiKey: apiKey || undefined,
      model: model || undefined,
    })
  }

  const currentModels = provider === 'openai' ? OPENAI_MODELS :
                        provider === 'gemini' ? GEMINI_MODELS : []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI 服務設定</h1>
        <p className="text-muted-foreground">設定 AI 智慧助理的服務供應商與 API Key</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI 供應商設定
          </CardTitle>
          <CardDescription>
            選擇要使用的 AI 服務供應商。需要有效的 API Key 才能啟用 AI 功能。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider 選擇 */}
          <div className="space-y-2">
            <Label>服務供應商</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">停用</SelectItem>
                <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Model 選擇 */}
          {provider !== 'disabled' && (
            <div className="space-y-2">
              <Label>模型</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* API Key */}
          {provider !== 'disabled' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Key
              </Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.hasApiKey ? '已設定（輸入新值以更新）' : '請輸入 API Key'}
              />
              {config?.hasApiKey && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  API Key 已設定
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {provider === 'openai'
                  ? '從 platform.openai.com 取得 API Key'
                  : '從 Google AI Studio 取得 API Key'}
              </p>
            </div>
          )}

          {/* 儲存按鈕 */}
          <div className="flex items-center gap-4 pt-4">
            <Button
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  儲存中...
                </>
              ) : (
                '儲存設定'
              )}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                設定已儲存
              </span>
            )}
            {updateConfig.isError && (
              <span className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                儲存失敗
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 說明卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>使用說明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            <strong>OpenAI (GPT)</strong>：需要 OpenAI 帳號並建立 API Key。
            GPT-3.5-Turbo 為較經濟的選項，GPT-4 則提供更強大的能力。
          </p>
          <p>
            <strong>Google Gemini</strong>：需要 Google Cloud 帳號或 Google AI Studio 存取權。
            Gemini Pro 為免費額度較高的選項。
          </p>
          <p>
            <strong>費用說明</strong>：AI 服務會依據使用量計費，請參考各供應商的定價頁面。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
