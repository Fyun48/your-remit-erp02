'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Calculator,
  Loader2,
  Plus,
  Play,
  Eye,
  CheckCircle,
  Calendar,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'
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

interface PayrollPeriodsProps {
  companyId: string
  companyName: string
  userId: string
}

export default function PayrollPeriods({ companyId, companyName, userId }: PayrollPeriodsProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newPeriodMonth, setNewPeriodMonth] = useState(currentMonth.toString())
  const [calculatingPeriodId, setCalculatingPeriodId] = useState<string | null>(null)
  const [approvingPeriodId, setApprovingPeriodId] = useState<string | null>(null)

  const utils = trpc.useUtils()

  const { data: periods, isLoading } = trpc.payroll.listPeriods.useQuery({
    companyId,
    year: parseInt(selectedYear),
  })

  const createMutation = trpc.payroll.createPeriod.useMutation({
    onSuccess: () => {
      toast.success('薪資期間已建立')
      utils.payroll.listPeriods.invalidate({ companyId, year: parseInt(selectedYear) })
      setIsCreateOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const calculateMutation = trpc.payroll.calculatePeriodPayroll.useMutation({
    onSuccess: (result) => {
      toast.success(`薪資計算完成，共產生 ${result.slipCount} 張薪資單`)
      utils.payroll.listPeriods.invalidate({ companyId, year: parseInt(selectedYear) })
      setCalculatingPeriodId(null)
    },
    onError: (error) => {
      toast.error(error.message)
      setCalculatingPeriodId(null)
    },
  })

  const updateStatusMutation = trpc.payroll.updatePeriodStatus.useMutation({
    onSuccess: () => {
      toast.success('狀態已更新')
      utils.payroll.listPeriods.invalidate({ companyId, year: parseInt(selectedYear) })
      setApprovingPeriodId(null)
    },
    onError: (error) => {
      toast.error(error.message)
      setApprovingPeriodId(null)
    },
  })

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      DRAFT: { label: '草稿', variant: 'secondary' },
      CALCULATED: { label: '已計算', variant: 'outline' },
      APPROVED: { label: '已核准', variant: 'default' },
      PAID: { label: '已發放', variant: 'default' },
    }
    const c = config[status] || { label: status, variant: 'secondary' as const }
    return <Badge variant={c.variant}>{c.label}</Badge>
  }

  const handleCreate = () => {
    createMutation.mutate({
      companyId,
      year: parseInt(selectedYear),
      month: parseInt(newPeriodMonth),
    })
  }

  const handleCalculate = (periodId: string) => {
    setCalculatingPeriodId(periodId)
    calculateMutation.mutate({
      periodId,
      operatorId: userId,
    })
  }

  const handleApprove = (periodId: string) => {
    updateStatusMutation.mutate({
      id: periodId,
      status: 'APPROVED',
      operatorId: userId,
    })
  }

  const handlePaid = (periodId: string) => {
    updateStatusMutation.mutate({
      id: periodId,
      status: 'PAID',
      operatorId: userId,
    })
  }

  // 取得已存在的月份
  const existingMonths = periods?.map(p => p.month) || []
  const availableMonths = months.filter(m => !existingMonths.includes(m))

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
          <Link href="/dashboard/hr/payroll">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              薪資計算
            </h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button disabled={availableMonths.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                新增期間
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增薪資期間</DialogTitle>
                <DialogDescription>
                  建立 {selectedYear} 年的薪資期間
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label>月份</Label>
                <Select value={newPeriodMonth} onValueChange={setNewPeriodMonth}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map(month => (
                      <SelectItem key={month} value={month.toString()}>
                        {month} 月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  建立
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 期間列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{selectedYear} 年薪資期間</CardTitle>
          <CardDescription>
            管理每月薪資計算與發放
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!periods || periods.length === 0) ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">尚無薪資期間</h3>
              <p className="text-muted-foreground mb-4">
                點擊「新增期間」按鈕開始建立
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>期間</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-center">薪資單數</TableHead>
                  <TableHead>計算時間</TableHead>
                  <TableHead>核准時間</TableHead>
                  <TableHead>發放時間</TableHead>
                  <TableHead className="w-[200px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">
                      {period.year} 年 {period.month} 月
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(period.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      {period._count.slips}
                    </TableCell>
                    <TableCell>
                      {period.calculatedAt
                        ? new Date(period.calculatedAt).toLocaleDateString('zh-TW')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {period.approvedAt
                        ? new Date(period.approvedAt).toLocaleDateString('zh-TW')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {period.paidAt
                        ? new Date(period.paidAt).toLocaleDateString('zh-TW')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {period.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            onClick={() => handleCalculate(period.id)}
                            disabled={calculateMutation.isPending && calculatingPeriodId === period.id}
                          >
                            {calculateMutation.isPending && calculatingPeriodId === period.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 mr-1" />
                            )}
                            計算
                          </Button>
                        )}

                        {period.status === 'CALCULATED' && (
                          <>
                            <Link href={`/dashboard/hr/payroll/periods/${period.id}`}>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4 mr-1" />
                                檢視
                              </Button>
                            </Link>
                            <AlertDialog open={approvingPeriodId === period.id} onOpenChange={(open) => !open && setApprovingPeriodId(null)}>
                              <Button size="sm" onClick={() => setApprovingPeriodId(period.id)}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                核准
                              </Button>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>確認核准</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    確定要核准 {period.year} 年 {period.month} 月的薪資嗎？
                                    核准後將無法重新計算。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleApprove(period.id)}>
                                    確認核准
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}

                        {period.status === 'APPROVED' && (
                          <>
                            <Link href={`/dashboard/hr/payroll/periods/${period.id}`}>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4 mr-1" />
                                檢視
                              </Button>
                            </Link>
                            <AlertDialog>
                              <Button size="sm" variant="default" onClick={() => setApprovingPeriodId(period.id)}>
                                標記發放
                              </Button>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>確認發放</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    確定要標記 {period.year} 年 {period.month} 月的薪資為已發放嗎？
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handlePaid(period.id)}>
                                    確認發放
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}

                        {period.status === 'PAID' && (
                          <Link href={`/dashboard/hr/payroll/periods/${period.id}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-1" />
                              檢視
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 說明 */}
      <Card>
        <CardHeader>
          <CardTitle>薪資計算流程</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">1. 草稿</Badge>
              <span className="text-muted-foreground">建立期間</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">2. 已計算</Badge>
              <span className="text-muted-foreground">自動計算薪資</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-2">
              <Badge variant="default">3. 已核准</Badge>
              <span className="text-muted-foreground">主管審核</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-2">
              <Badge variant="default">4. 已發放</Badge>
              <span className="text-muted-foreground">完成發放</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
