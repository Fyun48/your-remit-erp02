'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Settings,
  Loader2,
  Save,
  Info,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PayrollSettingsProps {
  companyId: string
  companyName: string
}

export default function PayrollSettings({ companyId, companyName }: PayrollSettingsProps) {
  const utils = trpc.useUtils()
  const { data: setting, isLoading } = trpc.payroll.getSetting.useQuery({ companyId })

  const updateMutation = trpc.payroll.updateSetting.useMutation({
    onSuccess: () => {
      toast.success('設定已儲存')
      utils.payroll.getSetting.invalidate({ companyId })
    },
    onError: (error) => {
      toast.error(`儲存失敗: ${error.message}`)
    },
  })

  const [formData, setFormData] = useState({
    laborInsuranceRate: 0.125,
    laborInsuranceEmpShare: 0.2,
    healthInsuranceRate: 0.0517,
    healthInsuranceEmpShare: 0.3,
    laborPensionRate: 0.06,
    overtimeRate1: 1.34,
    overtimeRate2: 1.67,
    overtimeRateHoliday: 2.0,
    minimumWage: 29500,
    withholdingThreshold: 88501,
  })

  useEffect(() => {
    if (setting) {
      setFormData({
        laborInsuranceRate: Number(setting.laborInsuranceRate),
        laborInsuranceEmpShare: Number(setting.laborInsuranceEmpShare),
        healthInsuranceRate: Number(setting.healthInsuranceRate),
        healthInsuranceEmpShare: Number(setting.healthInsuranceEmpShare),
        laborPensionRate: Number(setting.laborPensionRate),
        overtimeRate1: Number(setting.overtimeRate1),
        overtimeRate2: Number(setting.overtimeRate2),
        overtimeRateHoliday: Number(setting.overtimeRateHoliday),
        minimumWage: Number(setting.minimumWage),
        withholdingThreshold: Number(setting.withholdingThreshold),
      })
    }
  }, [setting])

  const handleSave = () => {
    updateMutation.mutate({
      companyId,
      ...formData,
    })
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    const numValue = parseFloat(value) || 0
    setFormData(prev => ({ ...prev, [field]: numValue }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* 標題區 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/hr/payroll">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="h-6 w-6" />
                薪資設定
              </h1>
              <p className="text-muted-foreground">{companyName}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            儲存設定
          </Button>
        </div>

        {/* 勞保設定 */}
        <Card>
          <CardHeader>
            <CardTitle>勞工保險</CardTitle>
            <CardDescription>
              2026 年（民國 115 年）勞保費率 12.5%（含就業保險 1%）
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="laborInsuranceRate">勞保費率</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>2026 年勞保費率 12.5%（含就業保險 1%）</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="laborInsuranceRate"
                  type="number"
                  step="0.001"
                  value={(formData.laborInsuranceRate * 100).toFixed(2)}
                  onChange={(e) => handleInputChange('laborInsuranceRate', String(parseFloat(e.target.value) / 100))}
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="laborInsuranceEmpShare">員工自付比例</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>員工自付 20%，雇主負擔 70%，政府補助 10%</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="laborInsuranceEmpShare"
                  type="number"
                  step="0.01"
                  value={(formData.laborInsuranceEmpShare * 100).toFixed(0)}
                  onChange={(e) => handleInputChange('laborInsuranceEmpShare', String(parseFloat(e.target.value) / 100))}
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 健保設定 */}
        <Card>
          <CardHeader>
            <CardTitle>全民健保</CardTitle>
            <CardDescription>
              2026 年（民國 115 年）健保費率 5.17%
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="healthInsuranceRate">健保費率</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>2026 年健保費率 5.17%</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="healthInsuranceRate"
                  type="number"
                  step="0.01"
                  value={(formData.healthInsuranceRate * 100).toFixed(2)}
                  onChange={(e) => handleInputChange('healthInsuranceRate', String(parseFloat(e.target.value) / 100))}
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="healthInsuranceEmpShare">員工自付比例</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>員工自付 30%，雇主負擔 60%，政府補助 10%</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="healthInsuranceEmpShare"
                  type="number"
                  step="0.01"
                  value={(formData.healthInsuranceEmpShare * 100).toFixed(0)}
                  onChange={(e) => handleInputChange('healthInsuranceEmpShare', String(parseFloat(e.target.value) / 100))}
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 勞退設定 */}
        <Card>
          <CardHeader>
            <CardTitle>勞工退休金</CardTitle>
            <CardDescription>
              雇主每月應提撥不低於 6%
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="laborPensionRate">雇主提撥率</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>雇主每月應提撥工資 6% 至勞退專戶</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="laborPensionRate"
                  type="number"
                  step="0.01"
                  value={(formData.laborPensionRate * 100).toFixed(0)}
                  onChange={(e) => handleInputChange('laborPensionRate', String(parseFloat(e.target.value) / 100))}
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 加班費倍率 */}
        <Card>
          <CardHeader>
            <CardTitle>加班費倍率</CardTitle>
            <CardDescription>
              依勞動基準法第 24 條規定
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="overtimeRate1">平日加班（前 2 小時）</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>延長工作時間在 2 小時以內，加給 1/3 以上</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="overtimeRate1"
                  type="number"
                  step="0.01"
                  value={formData.overtimeRate1}
                  onChange={(e) => handleInputChange('overtimeRate1', e.target.value)}
                />
                <span className="text-muted-foreground">倍</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="overtimeRate2">平日加班（超過 2 小時）</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>延長工作時間超過 2 小時，加給 2/3 以上</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="overtimeRate2"
                  type="number"
                  step="0.01"
                  value={formData.overtimeRate2}
                  onChange={(e) => handleInputChange('overtimeRate2', e.target.value)}
                />
                <span className="text-muted-foreground">倍</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="overtimeRateHoliday">休息日/假日加班</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>休息日或國定假日加班，加倍發給</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="overtimeRateHoliday"
                  type="number"
                  step="0.01"
                  value={formData.overtimeRateHoliday}
                  onChange={(e) => handleInputChange('overtimeRateHoliday', e.target.value)}
                />
                <span className="text-muted-foreground">倍</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 其他設定 */}
        <Card>
          <CardHeader>
            <CardTitle>其他設定</CardTitle>
            <CardDescription>
              基本工資與扣繳相關設定
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="minimumWage">基本工資</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>2026 年基本工資 29,500 元</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="minimumWage"
                  type="number"
                  step="100"
                  value={formData.minimumWage}
                  onChange={(e) => handleInputChange('minimumWage', e.target.value)}
                />
                <span className="text-muted-foreground">元</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="withholdingThreshold">薪資扣繳起扣點</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>月薪超過此金額需預扣所得稅（2026 年為 88,501 元）</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="withholdingThreshold"
                  type="number"
                  step="1"
                  value={formData.withholdingThreshold}
                  onChange={(e) => handleInputChange('withholdingThreshold', e.target.value)}
                />
                <span className="text-muted-foreground">元</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
