'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Trash2,
  User,
  Calendar,
  Building2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface RequestItem {
  itemId: string
  itemCode: string
  itemName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

interface StationeryRequest {
  id: string
  requestNo: string
  companyId: string
  applicantId: string
  items: unknown
  totalAmount: number
  purpose: string | null
  status: string
  approvedById: string | null
  approvedAt: string | null
  issuedAt: string | null
  issuedById: string | null
  createdAt: string
  updatedAt: string
  company: { id: string; name: string }
  applicant: { id: string; name: string; employeeNo: string; email: string }
  approvedBy: { id: string; name: string } | null
  issuedBy: { id: string; name: string } | null
}

interface StationeryRequestDetailProps {
  request: StationeryRequest
  currentUserId: string
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  PENDING: { label: '待審核', color: 'bg-blue-100 text-blue-700', icon: Clock },
  APPROVED: { label: '待發放', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '已駁回', color: 'bg-red-100 text-red-700', icon: XCircle },
  ISSUED: { label: '已發放', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500', icon: XCircle },
}

export function StationeryRequestDetail({
  request,
  currentUserId,
}: StationeryRequestDetailProps) {
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showIssueDialog, setShowIssueDialog] = useState(false)

  const submit = trpc.stationery.requestSubmit.useMutation({
    onSuccess: () => router.refresh(),
  })

  const cancel = trpc.stationery.requestCancel.useMutation({
    onSuccess: () => {
      setShowCancelDialog(false)
      router.refresh()
    },
  })

  const approve = trpc.stationery.requestApprove.useMutation({
    onSuccess: () => router.refresh(),
  })

  const reject = trpc.stationery.requestReject.useMutation({
    onSuccess: () => router.refresh(),
  })

  const issue = trpc.stationery.requestIssue.useMutation({
    onSuccess: () => {
      setShowIssueDialog(false)
      router.refresh()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const status = statusConfig[request.status] || statusConfig.DRAFT
  const StatusIcon = status.icon
  const items = request.items as RequestItem[]

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-TW')
  }

  const isOwner = request.applicantId === currentUserId

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/stationery">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{request.requestNo}</h1>
              <Badge className={status.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">{request.company.name}</p>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-2">
          {request.status === 'DRAFT' && isOwner && (
            <>
              <Button onClick={() => submit.mutate({ id: request.id })}>
                <Send className="h-4 w-4 mr-2" />
                提交審批
              </Button>
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() => setShowCancelDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                取消
              </Button>
            </>
          )}
          {request.status === 'PENDING' && (
            <>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() =>
                  approve.mutate({ id: request.id, approverId: currentUserId })
                }
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                核准
              </Button>
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() =>
                  reject.mutate({ id: request.id, approverId: currentUserId })
                }
              >
                <XCircle className="h-4 w-4 mr-2" />
                駁回
              </Button>
              {isOwner && (
                <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
                  取消申請
                </Button>
              )}
            </>
          )}
          {request.status === 'APPROVED' && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowIssueDialog(true)}
            >
              <Package className="h-4 w-4 mr-2" />
              發放文具
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 主要內容 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 申請明細 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                申請明細
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>代碼</TableHead>
                    <TableHead>品名</TableHead>
                    <TableHead className="text-right">單價</TableHead>
                    <TableHead className="text-right">數量</TableHead>
                    <TableHead className="text-right">小計</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.itemCode}</TableCell>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell className="text-right">
                        ${item.unitPrice.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        ${item.subtotal.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end pt-4 border-t mt-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">總計</p>
                  <p className="text-2xl font-bold text-primary">
                    ${request.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 用途說明 */}
          {request.purpose && (
            <Card>
              <CardHeader>
                <CardTitle>用途說明</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{request.purpose}</p>
              </CardContent>
            </Card>
          )}

          {/* 處理紀錄 */}
          <Card>
            <CardHeader>
              <CardTitle>處理紀錄</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium">申請建立</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                </div>
                {request.approvedAt && (
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-2 h-2 mt-2 rounded-full ${
                        request.status === 'REJECTED' ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    />
                    <div>
                      <p className="font-medium">
                        {request.status === 'REJECTED' ? '已駁回' : '已核准'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(request.approvedAt)} by {request.approvedBy?.name}
                      </p>
                    </div>
                  </div>
                )}
                {request.issuedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="font-medium">已發放</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(request.issuedAt)} by {request.issuedBy?.name}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 側邊欄 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                申請人資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">申請人</span>
                <span className="font-medium">{request.applicant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">員工編號</span>
                <span>{request.applicant.employeeNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-sm">{request.applicant.email}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                公司資訊
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{request.company.name}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                時間資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">建立時間</span>
                <span>{formatDateTime(request.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">更新時間</span>
                <span>{formatDateTime(request.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 取消對話框 */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消申請</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            確定要取消此文具申請嗎？此操作無法復原。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              返回
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancel.mutate({ id: request.id })}
            >
              確定取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 發放確認對話框 */}
      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>發放文具</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            確定要發放此文具申請嗎？發放後將自動扣除庫存。
          </p>
          <div className="bg-muted/50 p-3 rounded-lg space-y-1">
            <p className="font-medium">{request.requestNo}</p>
            <p className="text-sm">申請人：{request.applicant.name}</p>
            <p className="text-sm">
              品項數：{items.length} 項，共{' '}
              {items.reduce((sum, item) => sum + item.quantity, 0)} 件
            </p>
            <p className="text-sm">金額：${request.totalAmount.toLocaleString()}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssueDialog(false)}>
              取消
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() =>
                issue.mutate({ id: request.id, issuerId: currentUserId })
              }
            >
              確認發放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
