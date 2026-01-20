'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Calendar,
  Plus,
  Lock,
  Unlock,
  ArrowLeft,
  Building2,
  Info,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'

interface Company {
  companyId: string
  company: {
    id: string
    name: string
  }
}

interface AccountingPeriodsProps {
  assignments: Company[]
  initialCompanyId: string
  employeeId: string
  hasPermission: boolean
}

type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED'

const statusConfig: Record<PeriodStatus, { label: string; className: string; description: string }> = {
  OPEN: {
    label: '開放',
    className: 'bg-green-100 text-green-800',
    description: '允許新增、修改、刪除傳票',
  },
  CLOSED: {
    label: '已關閉',
    className: 'bg-yellow-100 text-yellow-800',
    description: '禁止新增、修改、刪除傳票，但可重新開放',
  },
  LOCKED: {
    label: '已鎖定',
    className: 'bg-red-100 text-red-800',
    description: '永久鎖定，無法重新開放（通常用於年結後）',
  },
}

export function AccountingPeriods({
  assignments,
  initialCompanyId,
  employeeId,
  hasPermission,
}: AccountingPeriodsProps) {
  const router = useRouter()
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId)
  const [periodToClose, setPeriodToClose] = useState<string | null>(null)
  const [periodToReopen, setPeriodToReopen] = useState<string | null>(null)

  const utils = trpc.useUtils()

  const { data: periods = [], isLoading } = trpc.accountingPeriod.list.useQuery(
    { companyId: selectedCompanyId },
    { enabled: !!selectedCompanyId }
  )

  const initializeMutation = trpc.accountingPeriod.initializeYear.useMutation({
    onSuccess: (data) => {
      toast.success(`已初始化 ${data.year} 年度會計期間`)
      utils.accountingPeriod.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const closeMutation = trpc.accountingPeriod.close.useMutation({
    onSuccess: () => {
      toast.success('已關閉會計期間')
      utils.accountingPeriod.list.invalidate()
      setPeriodToClose(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const reopenMutation = trpc.accountingPeriod.reopen.useMutation({
    onSuccess: () => {
      toast.success('已重新開放會計期間')
      utils.accountingPeriod.list.invalidate()
      setPeriodToReopen(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const selectedCompany = assignments.find(a => a.companyId === selectedCompanyId)

  const handleCompanyChange = async (companyId: string) => {
    // 更新全域公司選擇 cookie
    try {
      const response = await fetch('/api/company/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
        credentials: 'include',
      })
      if (response.ok) {
        window.location.reload()
      }
    } catch (error) {
      toast.error('切換公司失敗')
    }
  }

  // 依年度分組
  const periodsByYear = periods.reduce((acc, period) => {
    if (!acc[period.year]) acc[period.year] = []
    acc[period.year].push(period)
    return acc
  }, {} as Record<number, typeof periods>)

  const years = Object.keys(periodsByYear).map(Number).sort((a, b) => b - a)
  const currentYear = new Date().getFullYear()

  const handleInitialize = (year: number) => {
    initializeMutation.mutate({ companyId: selectedCompanyId, year })
  }

  const handleClose = () => {
    if (periodToClose) {
      closeMutation.mutate({ id: periodToClose, closedBy: employeeId })
    }
  }

  const handleReopen = () => {
    if (periodToReopen) {
      reopenMutation.mutate({ id: periodToReopen })
    }
  }

  const getPeriodName = (period: { year: number; period: number }) => {
    return `${period.year} 年 ${period.period} 月`
  }

  return (
    <div className="space-y-6">
      {/* 頂部導航欄 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/finance/accounting')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">會計期間</h1>
            <p className="text-muted-foreground">{selectedCompany?.company.name}</p>
          </div>
        </div>

        {/* 公司選擇器 */}
        {assignments.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="選擇公司" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={a.companyId} value={a.companyId}>
                    {a.company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 狀態說明 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1">
            <p className="font-medium">會計期間狀態說明：</p>
            <ul className="text-sm space-y-1 ml-4">
              <li>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Unlock className="h-3 w-3" />
                  開放
                </span>
                {' '}- {statusConfig.OPEN.description}
              </li>
              <li>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  <Lock className="h-3 w-3" />
                  已關閉
                </span>
                {' '}- {statusConfig.CLOSED.description}
              </li>
              <li>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <Lock className="h-3 w-3" />
                  已鎖定
                </span>
                {' '}- {statusConfig.LOCKED.description}
              </li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* 操作按鈕 */}
      {hasPermission && !periodsByYear[currentYear] && (
        <div className="flex gap-2">
          <Button
            onClick={() => handleInitialize(currentYear)}
            disabled={initializeMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            初始化 {currentYear} 年度
          </Button>
        </div>
      )}

      {/* 期間列表 */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">載入中...</div>
      ) : periods.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立會計期間</p>
              {hasPermission && (
                <p className="text-sm text-muted-foreground mt-2">
                  點擊「初始化 {currentYear} 年度」建立本年度的 12 個會計期間
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <Card key={year}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {year} 年度
                    </CardTitle>
                    <CardDescription>
                      共 {periodsByYear[year].length} 個期間
                    </CardDescription>
                  </div>
                  {hasPermission && !periodsByYear[year + 1] && year === years[0] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInitialize(year + 1)}
                      disabled={initializeMutation.isPending}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      新增 {year + 1} 年度
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 w-20">期間</th>
                        <th className="text-left py-2 px-2">起始日</th>
                        <th className="text-left py-2 px-2">結束日</th>
                        <th className="text-center py-2 px-2 w-24">狀態</th>
                        <th className="text-left py-2 px-2">關閉時間</th>
                        {hasPermission && (
                          <th className="text-center py-2 px-2 w-28">操作</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {periodsByYear[year]
                        .sort((a, b) => a.period - b.period)
                        .map((period) => {
                          const config = statusConfig[period.status as PeriodStatus] || statusConfig.OPEN
                          return (
                            <tr key={period.id} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-2 font-medium">{period.period} 月</td>
                              <td className="py-2 px-2">
                                {new Date(period.startDate).toLocaleDateString('zh-TW')}
                              </td>
                              <td className="py-2 px-2">
                                {new Date(period.endDate).toLocaleDateString('zh-TW')}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
                                  title={config.description}
                                >
                                  {period.status === 'OPEN' ? (
                                    <Unlock className="h-3 w-3" />
                                  ) : (
                                    <Lock className="h-3 w-3" />
                                  )}
                                  {config.label}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-muted-foreground">
                                {period.closedAt
                                  ? new Date(period.closedAt).toLocaleString('zh-TW')
                                  : '-'}
                              </td>
                              {hasPermission && (
                                <td className="py-2 px-2 text-center">
                                  {period.status === 'OPEN' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setPeriodToClose(period.id)}
                                    >
                                      <Lock className="h-3 w-3 mr-1" />
                                      關閉
                                    </Button>
                                  )}
                                  {period.status === 'CLOSED' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setPeriodToReopen(period.id)}
                                    >
                                      <Unlock className="h-3 w-3 mr-1" />
                                      開放
                                    </Button>
                                  )}
                                  {period.status === 'LOCKED' && (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 關閉期間確認對話框 */}
      <AlertDialog open={!!periodToClose} onOpenChange={(open) => !open && setPeriodToClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要關閉此會計期間？</AlertDialogTitle>
            <AlertDialogDescription>
              關閉後將無法在此期間新增、修改或刪除傳票。
              <br />
              <br />
              關閉前請確認：
              <ul className="list-disc ml-6 mt-2">
                <li>所有傳票已過帳完畢</li>
                <li>期間內的帳目已確認無誤</li>
              </ul>
              <br />
              如有需要，您可以在之後重新開放此期間（已鎖定的期間除外）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              disabled={closeMutation.isPending}
            >
              確定關閉
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重新開放期間確認對話框 */}
      <AlertDialog open={!!periodToReopen} onOpenChange={(open) => !open && setPeriodToReopen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要重新開放此會計期間？</AlertDialogTitle>
            <AlertDialogDescription>
              重新開放後將允許在此期間新增、修改或刪除傳票。
              <br />
              <br />
              請注意，這可能會影響後續期間的會計數據一致性。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReopen}
              disabled={reopenMutation.isPending}
            >
              確定開放
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
