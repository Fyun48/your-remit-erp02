'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Plus,
  Search,
  Stamp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface SealRequestListProps {
  companyId: string
  companyName: string
  currentUserId: string
}

const sealTypeLabels: Record<string, string> = {
  COMPANY_SEAL: '公司大章',
  COMPANY_SMALL_SEAL: '公司小章',
  CONTRACT_SEAL: '合約用印',
  INVOICE_SEAL: '發票章',
  BOARD_SEAL: '董事會印鑑',
  BANK_SEAL: '銀行印鑑',
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  PENDING: { label: '待審核', color: 'bg-blue-100 text-blue-700', icon: Clock },
  APPROVED: { label: '已核准', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '已駁回', color: 'bg-red-100 text-red-700', icon: XCircle },
  PROCESSING: { label: '用印中', color: 'bg-orange-100 text-orange-700', icon: Stamp },
  COMPLETED: { label: '已完成', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500', icon: XCircle },
}

export function SealRequestList({
  companyId,
  companyName,
  currentUserId,
}: SealRequestListProps) {
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [actionDialog, setActionDialog] = useState<{
    type: 'approve' | 'reject' | 'process' | 'complete' | 'return' | null
    request: typeof requests[0] | null
  }>({ type: null, request: null })
  const [returnNote, setReturnNote] = useState('')

  // 使用 tRPC Query 取得資料
  const { data: requests = [], isLoading: isLoadingRequests } = trpc.sealRequest.list.useQuery({ companyId })
  const { data: statsData, isLoading: isLoadingStats } = trpc.sealRequest.statistics.useQuery({ companyId })
  const stats = statsData ?? { pendingCount: 0, processingCount: 0, overdueCount: 0 }

  const invalidateData = () => {
    utils.sealRequest.list.invalidate()
    utils.sealRequest.statistics.invalidate()
  }

  const approve = trpc.sealRequest.approve.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const reject = trpc.sealRequest.reject.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const startProcessing = trpc.sealRequest.startProcessing.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const complete = trpc.sealRequest.complete.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const confirmReturn = trpc.sealRequest.confirmReturn.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      setReturnNote('')
      invalidateData()
    },
  })

  const filteredRequests = requests.filter((req) => {
    if (search) {
      const s = search.toLowerCase()
      if (
        !req.requestNo.toLowerCase().includes(s) &&
        !req.applicant.name.toLowerCase().includes(s) &&
        !req.purpose.toLowerCase().includes(s)
      ) {
        return false
      }
    }
    if (filterStatus && req.status !== filterStatus) return false
    if (filterType && req.sealType !== filterType) return false
    return true
  })

  const formatDate = (dateStr: Date | string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-TW')
  }

  const isOverdue = (req: typeof requests[0]) => {
    if (!req.isCarryOut || req.actualReturn) return false
    if (!req.expectedReturn) return false
    return new Date(req.expectedReturn) < new Date()
  }

  const handleAction = (type: typeof actionDialog.type, request: typeof requests[0]) => {
    setActionDialog({ type, request })
  }

  const isLoading = isLoadingRequests || isLoadingStats

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const executeAction = () => {
    if (!actionDialog.request) return

    switch (actionDialog.type) {
      case 'approve':
        approve.mutate({ id: actionDialog.request.id, approverId: currentUserId })
        break
      case 'reject':
        reject.mutate({ id: actionDialog.request.id, approverId: currentUserId })
        break
      case 'process':
        startProcessing.mutate({ id: actionDialog.request.id, processedById: currentUserId })
        break
      case 'complete':
        complete.mutate({ id: actionDialog.request.id, processedById: currentUserId })
        break
      case 'return':
        confirmReturn.mutate({ id: actionDialog.request.id, returnNote: returnNote || undefined })
        break
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">用印申請</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Link href="/dashboard/admin/seal/statistics">
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            統計報表
          </Button>
        </Link>
        <Link href="/dashboard/admin/seal/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增申請
          </Button>
        </Link>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待審核</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">用印中</CardTitle>
            <Stamp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.processingCount}</div>
          </CardContent>
        </Card>
        <Card className={stats.overdueCount > 0 ? 'border-red-200' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">逾期未歸還</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.overdueCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-red-600' : ''}`}>
              {stats.overdueCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 篩選 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋單號、申請人、用途..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部狀態</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="PENDING">待審核</SelectItem>
                <SelectItem value="APPROVED">已核准</SelectItem>
                <SelectItem value="REJECTED">已駁回</SelectItem>
                <SelectItem value="PROCESSING">用印中</SelectItem>
                <SelectItem value="COMPLETED">已完成</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="印章類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部類型</SelectItem>
                {Object.entries(sealTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stamp className="h-5 w-5" />
            申請列表
          </CardTitle>
          <CardDescription>共 {filteredRequests.length} 筆申請</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8">
              <Stamp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚無用印申請</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">單號</TableHead>
                  <TableHead>申請人</TableHead>
                  <TableHead>印章類型</TableHead>
                  <TableHead>用途</TableHead>
                  <TableHead className="text-center">攜出</TableHead>
                  <TableHead>申請日期</TableHead>
                  <TableHead className="text-center">狀態</TableHead>
                  <TableHead className="w-32">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => {
                  const status = statusConfig[req.status]
                  const StatusIcon = status.icon
                  const overdue = isOverdue(req)

                  return (
                    <TableRow key={req.id} className={overdue ? 'bg-red-50' : ''}>
                      <TableCell>
                        <Link
                          href={`/dashboard/admin/seal/${req.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {req.requestNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{req.applicant.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {req.applicant.employeeNo}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{sealTypeLabels[req.sealType]}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{req.purpose}</TableCell>
                      <TableCell className="text-center">
                        {req.isCarryOut ? (
                          <div className="flex flex-col items-center">
                            <Badge variant={overdue ? 'destructive' : 'secondary'}>
                              {overdue ? '逾期' : '攜出'}
                            </Badge>
                            {req.expectedReturn && (
                              <span className="text-xs text-muted-foreground mt-1">
                                {formatDate(req.expectedReturn)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(req.createdAt)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {req.status === 'PENDING' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction('approve', req)}
                              >
                                核准
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction('reject', req)}
                              >
                                駁回
                              </Button>
                            </>
                          )}
                          {req.status === 'APPROVED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction('process', req)}
                            >
                              開始用印
                            </Button>
                          )}
                          {req.status === 'PROCESSING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction('complete', req)}
                            >
                              完成
                            </Button>
                          )}
                          {req.isCarryOut &&
                            !req.actualReturn &&
                            ['APPROVED', 'PROCESSING', 'COMPLETED'].includes(req.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction('return', req)}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                歸還
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 操作確認對話框 */}
      <Dialog
        open={!!actionDialog.type}
        onOpenChange={(open) => !open && setActionDialog({ type: null, request: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'approve' && '確認核准'}
              {actionDialog.type === 'reject' && '確認駁回'}
              {actionDialog.type === 'process' && '開始用印'}
              {actionDialog.type === 'complete' && '完成用印'}
              {actionDialog.type === 'return' && '確認歸還'}
            </DialogTitle>
          </DialogHeader>
          {actionDialog.request && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">單號</span>
                  <span className="font-mono">{actionDialog.request.requestNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">申請人</span>
                  <span>{actionDialog.request.applicant.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">印章類型</span>
                  <span>{sealTypeLabels[actionDialog.request.sealType]}</span>
                </div>
              </div>

              {actionDialog.type === 'return' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">歸還備註</label>
                  <Input
                    placeholder="輸入歸還備註（選填）"
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: null, request: null })}
            >
              取消
            </Button>
            <Button
              onClick={executeAction}
              variant={actionDialog.type === 'reject' ? 'destructive' : 'default'}
              disabled={
                approve.isPending ||
                reject.isPending ||
                startProcessing.isPending ||
                complete.isPending ||
                confirmReturn.isPending
              }
            >
              {approve.isPending ||
              reject.isPending ||
              startProcessing.isPending ||
              complete.isPending ||
              confirmReturn.isPending
                ? '處理中...'
                : '確認'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
