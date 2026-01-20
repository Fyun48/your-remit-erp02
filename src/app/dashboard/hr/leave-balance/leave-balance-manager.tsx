'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Edit2, History, RefreshCw } from 'lucide-react'

interface LeaveBalanceManagerProps {
  companyId: string
  companyName: string
  userId: string
}

interface AdjustDialogData {
  employeeId: string
  employeeName: string
  leaveTypeId: string
  leaveTypeName: string
  currentAdjustedHours: number  // 目前已調整的時數
  entitledHours: number         // 系統計算的應有時數
}

export function LeaveBalanceManager({
  companyId,
  companyName,
  userId,
}: LeaveBalanceManagerProps) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [search, setSearch] = useState('')
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string | undefined>()
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [adjustData, setAdjustData] = useState<AdjustDialogData | null>(null)
  const [adjustDays, setAdjustDays] = useState('0')      // 調整天數（可為負數）
  const [adjustExtraHours, setAdjustExtraHours] = useState('0')  // 調整時數（可為負數）
  const [adjustReason, setAdjustReason] = useState('')

  const { data: leaveTypes } = trpc.leaveType.list.useQuery({ companyId })

  const {
    data: balances,
    isLoading,
    refetch,
  } = trpc.leaveBalance.listByCompany.useQuery({
    companyId,
    year,
    leaveTypeId: selectedLeaveTypeId,
    search: search || undefined,
  })

  const { data: adjustments, refetch: refetchAdjustments } =
    trpc.leaveBalance.listAdjustments.useQuery({
      companyId,
      year,
      limit: 50,
    })

  const adjustMutation = trpc.leaveBalance.adjust.useMutation({
    onSuccess: () => {
      setAdjustDialogOpen(false)
      setAdjustData(null)
      setAdjustDays('0')
      setAdjustExtraHours('0')
      setAdjustReason('')
      refetch()
      refetchAdjustments()
    },
  })

  const handleOpenAdjustDialog = (
    employeeId: string,
    employeeName: string,
    leaveTypeId: string,
    leaveTypeName: string,
    currentAdjustedHours: number,
    entitledHours: number
  ) => {
    setAdjustData({
      employeeId,
      employeeName,
      leaveTypeId,
      leaveTypeName,
      currentAdjustedHours,
      entitledHours,
    })
    // 將目前的調整時數轉換為天數和時數顯示
    const days = Math.floor(Math.abs(currentAdjustedHours) / 8) * (currentAdjustedHours >= 0 ? 1 : -1)
    const hours = currentAdjustedHours % 8
    setAdjustDays(days.toString())
    setAdjustExtraHours(hours.toString())
    setAdjustDialogOpen(true)
  }

  // 計算調整後的總時數
  const calculateTotalAdjustedHours = () => {
    const days = parseFloat(adjustDays) || 0
    const hours = parseFloat(adjustExtraHours) || 0
    return days * 8 + hours
  }

  const handleAdjust = async () => {
    if (!adjustData || !adjustReason.trim()) return

    const totalAdjustedHours = calculateTotalAdjustedHours()

    await adjustMutation.mutateAsync({
      employeeId: adjustData.employeeId,
      companyId,
      leaveTypeId: adjustData.leaveTypeId,
      year,
      adjustedHours: totalAdjustedHours,
      reason: adjustReason,
      adjustedById: userId,
    })
  }

  // 還原預設值（將調整時數歸零）
  const handleResetToDefault = async () => {
    if (!adjustData) return

    await adjustMutation.mutateAsync({
      employeeId: adjustData.employeeId,
      companyId,
      leaveTypeId: adjustData.leaveTypeId,
      year,
      adjustedHours: 0,
      reason: '還原預設值',
      adjustedById: userId,
    })
  }

  const formatHours = (hours: number) => {
    if (hours === -1) return '無限'
    const days = hours / 8
    return `${days} 天 (${hours} 時)`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">假別餘額管理</h1>
        <p className="text-muted-foreground">{companyName}</p>
      </div>

      <Tabs defaultValue="balances">
        <TabsList>
          <TabsTrigger value="balances">餘額列表</TabsTrigger>
          <TabsTrigger value="history">調整歷史</TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="space-y-4">
          {/* 篩選條件 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="year">年度</Label>
                  <select
                    id="year"
                    className="border rounded-md p-2"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                  >
                    {[...Array(5)].map((_, i) => {
                      const y = new Date().getFullYear() - 2 + i
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="leaveType">假別</Label>
                  <select
                    id="leaveType"
                    className="border rounded-md p-2"
                    value={selectedLeaveTypeId || ''}
                    onChange={(e) =>
                      setSelectedLeaveTypeId(e.target.value || undefined)
                    }
                  >
                    <option value="">全部假別</option>
                    {leaveTypes?.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋員工姓名或編號..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                  />
                </div>

                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重新整理
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 餘額列表 */}
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">
                  載入中...
                </p>
              ) : balances && balances.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>員工編號</TableHead>
                        <TableHead>姓名</TableHead>
                        <TableHead>部門</TableHead>
                        <TableHead>職位</TableHead>
                        {selectedLeaveTypeId ? (
                          <>
                            <TableHead className="text-right">應有額度</TableHead>
                            <TableHead className="text-right">已使用</TableHead>
                            <TableHead className="text-right">調整時數</TableHead>
                            <TableHead className="text-right">剩餘</TableHead>
                            <TableHead className="text-center">操作</TableHead>
                          </>
                        ) : (
                          <TableHead>假別餘額概覽</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balances.map((item) => (
                        <TableRow key={item.employee.id}>
                          <TableCell>{item.employee.employeeNo}</TableCell>
                          <TableCell className="font-medium">
                            {item.employee.name}
                          </TableCell>
                          <TableCell>{item.department}</TableCell>
                          <TableCell>{item.position}</TableCell>
                          {selectedLeaveTypeId ? (
                            <>
                              {item.balances
                                .filter((b) => b.leaveType.id === selectedLeaveTypeId)
                                .map((balance) => (
                                  <>
                                    <TableCell key={`${balance.leaveType.id}-entitled`} className="text-right">
                                      {formatHours(balance.entitledHours)}
                                    </TableCell>
                                    <TableCell key={`${balance.leaveType.id}-used`} className="text-right">
                                      {formatHours(balance.usedHours)}
                                    </TableCell>
                                    <TableCell key={`${balance.leaveType.id}-adjusted`} className="text-right">
                                      {balance.adjustedHours !== 0 && (
                                        <span
                                          className={
                                            balance.adjustedHours > 0
                                              ? 'text-green-600'
                                              : 'text-red-600'
                                          }
                                        >
                                          {balance.adjustedHours > 0 ? '+' : ''}
                                          {formatHours(balance.adjustedHours)}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell key={`${balance.leaveType.id}-remaining`} className="text-right font-medium">
                                      {formatHours(balance.remainingHours)}
                                    </TableCell>
                                    <TableCell key={`${balance.leaveType.id}-action`} className="text-center">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleOpenAdjustDialog(
                                            item.employee.id,
                                            item.employee.name,
                                            balance.leaveType.id,
                                            balance.leaveType.name,
                                            balance.adjustedHours,
                                            balance.entitledHours
                                          )
                                        }
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </>
                                ))}
                            </>
                          ) : (
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {item.balances.slice(0, 3).map((balance) => (
                                  <span
                                    key={balance.leaveType.id}
                                    className="text-xs bg-muted px-2 py-1 rounded"
                                  >
                                    {balance.leaveType.name}:{' '}
                                    {balance.remainingHours === -1
                                      ? '無限'
                                      : `${balance.remainingHours / 8} 天`}
                                  </span>
                                ))}
                                {item.balances.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{item.balances.length - 3} 更多
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  沒有找到員工資料
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                調整歷史記錄
              </CardTitle>
              <CardDescription>
                最近 50 筆假別餘額調整記錄
              </CardDescription>
            </CardHeader>
            <CardContent>
              {adjustments && adjustments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>調整時間</TableHead>
                      <TableHead>員工</TableHead>
                      <TableHead>假別</TableHead>
                      <TableHead>年度</TableHead>
                      <TableHead className="text-right">調整前</TableHead>
                      <TableHead className="text-right">調整後</TableHead>
                      <TableHead className="text-right">變動</TableHead>
                      <TableHead>原因</TableHead>
                      <TableHead>調整者</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adj) => (
                      <TableRow key={adj.id}>
                        <TableCell className="text-sm">
                          {new Date(adj.adjustedAt).toLocaleString('zh-TW')}
                        </TableCell>
                        <TableCell>
                          {adj.employee.name}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({adj.employee.employeeNo})
                          </span>
                        </TableCell>
                        <TableCell>{adj.leaveType.name}</TableCell>
                        <TableCell>{adj.year}</TableCell>
                        <TableCell className="text-right">
                          {formatHours(adj.previousHours)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatHours(adj.newHours)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              adj.changeHours > 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {adj.changeHours > 0 ? '+' : ''}
                            {formatHours(adj.changeHours)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {adj.reason}
                        </TableCell>
                        <TableCell>{adj.adjustedBy.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  尚無調整記錄
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 調整對話框 */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>調整假別餘額</DialogTitle>
            <DialogDescription>
              調整 {adjustData?.employeeName} 的 {adjustData?.leaveTypeName} 餘額
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 目前狀態 */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">系統應有額度：</span>
                <span>{adjustData?.entitledHours === -1 ? '無限' : `${(adjustData?.entitledHours || 0) / 8} 天 (${adjustData?.entitledHours || 0} 時)`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">目前調整值：</span>
                <span className={adjustData?.currentAdjustedHours !== 0 ? (adjustData?.currentAdjustedHours || 0) > 0 ? 'text-green-600' : 'text-red-600' : ''}>
                  {adjustData?.currentAdjustedHours !== 0 ? (
                    <>
                      {(adjustData?.currentAdjustedHours || 0) > 0 ? '+' : ''}
                      {(adjustData?.currentAdjustedHours || 0) / 8} 天 ({adjustData?.currentAdjustedHours} 時)
                    </>
                  ) : '無調整'}
                </span>
              </div>
            </div>

            {/* 調整輸入 */}
            <div className="space-y-3">
              <Label>設定調整值（正數增加、負數減少）</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Input
                    id="adjustDays"
                    type="number"
                    step="1"
                    value={adjustDays}
                    onChange={(e) => setAdjustDays(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm">天</span>
                </div>
                <span className="text-muted-foreground">+</span>
                <div className="flex items-center gap-2">
                  <Input
                    id="adjustExtraHours"
                    type="number"
                    step="0.5"
                    value={adjustExtraHours}
                    onChange={(e) => setAdjustExtraHours(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm">時</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                例如：輸入 2 天 + 4 時 = 額外增加 20 小時；輸入 -1 天 = 減少 8 小時
              </p>
            </div>

            {/* 調整預覽 */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between font-medium">
                <span>新調整值：</span>
                <span className={calculateTotalAdjustedHours() !== 0 ? calculateTotalAdjustedHours() > 0 ? 'text-green-600' : 'text-red-600' : ''}>
                  {calculateTotalAdjustedHours() > 0 ? '+' : ''}{calculateTotalAdjustedHours() / 8} 天 ({calculateTotalAdjustedHours()} 時)
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>調整後總額度：</span>
                <span>
                  {adjustData?.entitledHours === -1
                    ? '無限'
                    : `${((adjustData?.entitledHours || 0) + calculateTotalAdjustedHours()) / 8} 天`}
                </span>
              </div>
            </div>

            {/* 調整原因 */}
            <div className="space-y-2">
              <Label htmlFor="adjustReason">調整原因 *</Label>
              <textarea
                id="adjustReason"
                className="w-full border rounded-md p-2 min-h-[60px] text-sm"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="請填寫調整原因（例如：補發特休、系統轉換調整等）"
                required
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleResetToDefault}
              disabled={adjustData?.currentAdjustedHours === 0 || adjustMutation.isPending}
              className="sm:mr-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              還原預設值
            </Button>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={!adjustReason.trim() || adjustMutation.isPending}
            >
              {adjustMutation.isPending ? '處理中...' : '確認調整'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
