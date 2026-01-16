'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Printer,
  BarChart3,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface CardRequestListProps {
  companyId: string
  companyName: string
  currentUserId: string
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  PENDING: { label: '待審核', color: 'bg-blue-100 text-blue-700', icon: Clock },
  APPROVED: { label: '已核准', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '已駁回', color: 'bg-red-100 text-red-700', icon: XCircle },
  PRINTING: { label: '印刷中', color: 'bg-orange-100 text-orange-700', icon: Printer },
  COMPLETED: { label: '已完成', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500', icon: XCircle },
}

export function CardRequestList({
  companyId,
  companyName,
  currentUserId,
}: CardRequestListProps) {
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [actionDialog, setActionDialog] = useState<{
    type: 'approve' | 'reject' | 'print' | 'complete' | null
    request: typeof requests[0] | null
  }>({ type: null, request: null })

  // 使用 tRPC Query 取得資料
  const { data: requests = [], isLoading: isLoadingRequests } = trpc.businessCard.list.useQuery({ companyId })
  const { data: statsData, isLoading: isLoadingStats } = trpc.businessCard.statistics.useQuery({ companyId })
  const stats = statsData ?? { pendingCount: 0, printingCount: 0 }

  const invalidateData = () => {
    utils.businessCard.list.invalidate()
    utils.businessCard.statistics.invalidate()
  }

  const approve = trpc.businessCard.approve.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const reject = trpc.businessCard.reject.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const startPrinting = trpc.businessCard.startPrinting.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const complete = trpc.businessCard.complete.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const filteredRequests = requests.filter((req) => {
    if (search) {
      const s = search.toLowerCase()
      if (
        !req.requestNo.toLowerCase().includes(s) &&
        !req.applicant.name.toLowerCase().includes(s) &&
        !req.name.toLowerCase().includes(s)
      ) {
        return false
      }
    }
    if (filterStatus && req.status !== filterStatus) return false
    return true
  })

  const formatDate = (dateStr: Date | string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-TW')
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
      case 'print':
        startPrinting.mutate({ id: actionDialog.request.id })
        break
      case 'complete':
        complete.mutate({ id: actionDialog.request.id })
        break
    }
  }

  const getActionConfig = () => {
    switch (actionDialog.type) {
      case 'approve':
        return { title: '核准申請', message: '確定要核准此名片申請？', buttonText: '核准', buttonClass: 'bg-green-600 hover:bg-green-700' }
      case 'reject':
        return { title: '駁回申請', message: '確定要駁回此名片申請？', buttonText: '駁回', buttonClass: 'bg-red-600 hover:bg-red-700' }
      case 'print':
        return { title: '開始印刷', message: '確定要將此申請標記為印刷中？', buttonText: '開始印刷', buttonClass: 'bg-orange-600 hover:bg-orange-700' }
      case 'complete':
        return { title: '完成印刷', message: '確定名片已印刷完成？', buttonText: '完成', buttonClass: 'bg-emerald-600 hover:bg-emerald-700' }
      default:
        return { title: '', message: '', buttonText: '', buttonClass: '' }
    }
  }

  const actionConfig = getActionConfig()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">名片申請</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Link href="/dashboard/admin/card/statistics">
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            統計報表
          </Button>
        </Link>
        <Link href="/dashboard/admin/card/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增申請
          </Button>
        </Link>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-2">
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
            <CardTitle className="text-sm font-medium">印刷中</CardTitle>
            <Printer className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.printingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* 搜尋與篩選 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            申請列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋單號、申請人、名片姓名..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="全部狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部狀態</SelectItem>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>單號</TableHead>
                <TableHead>申請人</TableHead>
                <TableHead>名片姓名</TableHead>
                <TableHead>職稱</TableHead>
                <TableHead>數量</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>申請日期</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    暫無申請資料
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => {
                  const status = statusConfig[request.status] || statusConfig.DRAFT
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/admin/card/${request.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {request.requestNo}
                        </Link>
                      </TableCell>
                      <TableCell>{request.applicant.name}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.name}</div>
                          {request.nameEn && (
                            <div className="text-xs text-muted-foreground">{request.nameEn}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{request.title}</TableCell>
                      <TableCell>{request.quantity} 盒</TableCell>
                      <TableCell>
                        <Badge className={status.color}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(request.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {request.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600"
                                onClick={() => handleAction('approve', request)}
                              >
                                核准
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => handleAction('reject', request)}
                              >
                                駁回
                              </Button>
                            </>
                          )}
                          {request.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-600"
                              onClick={() => handleAction('print', request)}
                            >
                              開始印刷
                            </Button>
                          )}
                          {request.status === 'PRINTING' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600"
                              onClick={() => handleAction('complete', request)}
                            >
                              完成
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 操作確認對話框 */}
      <Dialog
        open={actionDialog.type !== null}
        onOpenChange={() => setActionDialog({ type: null, request: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionConfig.title}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">{actionConfig.message}</p>
          {actionDialog.request && (
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <p className="font-medium">{actionDialog.request.requestNo}</p>
              <p className="text-sm">申請人：{actionDialog.request.applicant.name}</p>
              <p className="text-sm">名片姓名：{actionDialog.request.name}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: null, request: null })}
            >
              取消
            </Button>
            <Button className={actionConfig.buttonClass} onClick={executeAction}>
              {actionConfig.buttonText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
