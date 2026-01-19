'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Target,
  Loader2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Star,
  Info,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useSession } from 'next-auth/react'

export default function ProjectKpiSettingsPage() {
  const { data: session } = useSession()
  const employeeId = session?.user?.id || ''

  // 取得員工的主要任職公司
  const { data: primaryCompany, isLoading: isLoadingCompany } = trpc.employee.getPrimaryCompany.useQuery(
    { employeeId },
    { enabled: !!employeeId }
  )
  const companyId = primaryCompany?.id || ''

  const [completionWeight, setCompletionWeight] = useState(40)
  const [onTimeWeight, setOnTimeWeight] = useState(35)
  const [qualityWeight, setQualityWeight] = useState(25)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // 取得目前設定
  const { data: settings, isLoading } = trpc.projectKpi.getSettings.useQuery(
    { companyId },
    { enabled: !!companyId }
  )

  const updateSettings = trpc.projectKpi.updateSettings.useMutation({
    onSuccess: () => {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (error) => {
      setValidationError(error.message)
      setTimeout(() => setValidationError(null), 5000)
    },
  })

  // 初始化表單
  useEffect(() => {
    if (settings) {
      setCompletionWeight(Math.round(settings.completionWeight * 100))
      setOnTimeWeight(Math.round(settings.onTimeWeight * 100))
      setQualityWeight(Math.round(settings.qualityWeight * 100))
    }
  }, [settings])

  // 驗證權重總和
  const totalWeight = completionWeight + onTimeWeight + qualityWeight
  const isValidTotal = totalWeight === 100

  const handleSave = () => {
    if (!isValidTotal) {
      setValidationError('權重總和必須等於 100%')
      return
    }

    updateSettings.mutate({
      companyId,
      completionWeight: completionWeight / 100,
      onTimeWeight: onTimeWeight / 100,
      qualityWeight: qualityWeight / 100,
    })
  }

  // 自動調整其他權重
  const adjustWeights = (
    changedWeight: 'completion' | 'onTime' | 'quality',
    newValue: number
  ) => {
    const remaining = 100 - newValue

    switch (changedWeight) {
      case 'completion': {
        setCompletionWeight(newValue)
        const ratio = onTimeWeight / (onTimeWeight + qualityWeight) || 0.5
        setOnTimeWeight(Math.round(remaining * ratio))
        setQualityWeight(remaining - Math.round(remaining * ratio))
        break
      }
      case 'onTime': {
        setOnTimeWeight(newValue)
        const ratio = completionWeight / (completionWeight + qualityWeight) || 0.5
        setCompletionWeight(Math.round(remaining * ratio))
        setQualityWeight(remaining - Math.round(remaining * ratio))
        break
      }
      case 'quality': {
        setQualityWeight(newValue)
        const ratio = completionWeight / (completionWeight + onTimeWeight) || 0.5
        setCompletionWeight(Math.round(remaining * ratio))
        setOnTimeWeight(remaining - Math.round(remaining * ratio))
        break
      }
    }
  }

  if (isLoading || isLoadingCompany) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            專案 KPI 設定
          </h1>
          <p className="text-muted-foreground">
            設定專案績效指標的權重比例
          </p>
        </div>
      </div>

      {/* 說明卡片 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">KPI 計算公式</p>
              <p>綜合績效分數 = (完成率 × 完成率權重) + (準時率 × 準時率權重) + (品質分數 × 品質權重)</p>
              <ul className="mt-2 space-y-1 text-blue-700">
                <li>• <strong>完成率</strong>：已完成任務數 / 總任務數</li>
                <li>• <strong>準時率</strong>：準時完成任務數 / 已完成任務數</li>
                <li>• <strong>品質評分</strong>：專案結案時的評分（1-5分 → 轉換為百分比）</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 權重設定 */}
      <Card>
        <CardHeader>
          <CardTitle>權重設定</CardTitle>
          <CardDescription>
            調整各項指標在綜合績效計算中的權重比例，總和必須等於 100%
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* 完成率 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <Label className="text-base font-medium">完成率權重</Label>
              </div>
              <Badge variant="secondary" className="text-lg px-3">
                {completionWeight}%
              </Badge>
            </div>
            <Slider
              value={[completionWeight]}
              onValueChange={([value]) => adjustWeights('completion', value)}
              max={100}
              step={5}
              className="[&_[role=slider]]:bg-green-600"
            />
            <p className="text-sm text-muted-foreground">
              衡量專案任務的完成程度，反映團隊的執行力
            </p>
          </div>

          <Separator />

          {/* 準時率 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <Label className="text-base font-medium">準時率權重</Label>
              </div>
              <Badge variant="secondary" className="text-lg px-3">
                {onTimeWeight}%
              </Badge>
            </div>
            <Slider
              value={[onTimeWeight]}
              onValueChange={([value]) => adjustWeights('onTime', value)}
              max={100}
              step={5}
              className="[&_[role=slider]]:bg-blue-600"
            />
            <p className="text-sm text-muted-foreground">
              衡量任務是否在截止日前完成，反映時間管理能力
            </p>
          </div>

          <Separator />

          {/* 品質評分 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                <Label className="text-base font-medium">品質評分權重</Label>
              </div>
              <Badge variant="secondary" className="text-lg px-3">
                {qualityWeight}%
              </Badge>
            </div>
            <Slider
              value={[qualityWeight]}
              onValueChange={([value]) => adjustWeights('quality', value)}
              max={100}
              step={5}
              className="[&_[role=slider]]:bg-amber-500"
            />
            <p className="text-sm text-muted-foreground">
              專案結案時的品質評分，反映交付物的品質水準
            </p>
          </div>

          <Separator />

          {/* 權重總和驗證 */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="font-medium">權重總和</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={isValidTotal ? 'default' : 'destructive'}
                className="text-lg px-4"
              >
                {totalWeight}%
              </Badge>
              {isValidTotal ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
            </div>
          </div>

          {/* 訊息與儲存 */}
          <div className="flex items-center justify-between">
            <div>
              {saveSuccess && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>設定已儲存</span>
                </div>
              )}
              {validationError && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleSave}
              disabled={!isValidTotal || updateSettings.isPending}
            >
              {updateSettings.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              儲存設定
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 預覽卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>計算範例</CardTitle>
          <CardDescription>
            假設有一個專案的各項指標如下
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-sm text-green-600 mb-1">完成率</div>
              <div className="text-2xl font-bold text-green-700">85%</div>
            </div>
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">準時率</div>
              <div className="text-2xl font-bold text-blue-700">90%</div>
            </div>
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-sm text-amber-600 mb-1">品質評分</div>
              <div className="text-2xl font-bold text-amber-700">80%</div>
              <div className="text-xs text-amber-600">（4分/5分）</div>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
              <div className="text-sm text-purple-600 mb-1">綜合分數</div>
              <div className="text-2xl font-bold text-purple-700">
                {Math.round(85 * (completionWeight / 100) + 90 * (onTimeWeight / 100) + 80 * (qualityWeight / 100))}%
              </div>
              <div className="text-xs text-purple-600">
                = 85×{completionWeight}% + 90×{onTimeWeight}% + 80×{qualityWeight}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
