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
  currentHours: number
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
  const [adjustHours, setAdjustHours] = useState('')
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
      setAdjustHours('')
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
    currentHours: number
  ) => {
    setAdjustData({
      employeeId,
      employeeName,
      leaveTypeId,
      leaveTypeName,
      currentHours,
    })
    setAdjustHours(currentHours.toString())
    setAdjustDialogOpen(true)
  }

  const handleAdjust = async () => {
    if (!adjustData || !adjustReason.trim()) return

    await adjustMutation.mutateAsync({
      employeeId: adjustData.employeeId,
      companyId,
      leaveTypeId: adjustData.leaveTypeId,
      year,
      adjustedHours: parseFloat(adjustHours),
      reason: adjustReason,
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
                                            balance.adjustedHours
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>調整假別餘額</DialogTitle>
            <DialogDescription>
              調整 {adjustData?.employeeName} 的 {adjustData?.leaveTypeName} 餘額
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adjustHours">調整後時數</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="adjustHours"
                  type="number"
                  step="0.5"
                  value={adjustHours}
                  onChange={(e) => setAdjustHours(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">小時</span>
                <span className="text-sm">
                  = {parseFloat(adjustHours || '0') / 8} 天
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                變動: {parseFloat(adjustHours || '0') - (adjustData?.currentHours || 0)} 小時
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustReason">調整原因 *</Label>
              <textarea
                id="adjustReason"
                className="w-full border rounded-md p-2 min-h-[80px]"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="請填寫調整原因（例如：補發特休、系統轉換調整等）"
                required
              />
            </div>
          </div>
          <DialogFooter>
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
