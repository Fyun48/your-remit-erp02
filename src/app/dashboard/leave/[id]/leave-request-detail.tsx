'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Trash2,
  User,
  Building2,
  FileText,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { WorkflowStatus } from '@/components/workflow/workflow-status'
import { FlowProgress } from '@/components/approval/flow-progress'

interface LeaveRequest {
  id: string
  requestNo: string
  employeeId: string
  companyId: string
  leaveTypeId: string
  startDate: Date
  startPeriod: string
  endDate: Date
  endPeriod: string
  totalHours: number
  reason: string | null
  status: string
  submittedAt: Date | null
  processedAt: Date | null
  approvedById: string | null
  rejectedById: string | null
  approvalComment: string | null
  createdAt: Date
  updatedAt: Date
  leaveType: { id: string; name: string; code: string }
  employee: { id: string; name: string; employeeNo: string; email: string }
  company: { id: string; name: string }
  approvedBy: { id: string; name: string } | null
  rejectedBy: { id: string; name: string } | null
}

interface LeaveRequestDetailProps {
  request: LeaveRequest
  currentUserId: string
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  PENDING: { label: '待審核', color: 'bg-blue-100 text-blue-700', icon: Clock },
  APPROVED: { label: '已核准', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '已駁回', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500', icon: XCircle },
}

const periodLabels: Record<string, string> = {
  FULL_DAY: '全天',
  AM: '上午',
  PM: '下午',
}

export function LeaveRequestDetail({ request, currentUserId }: LeaveRequestDetailProps) {
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const submit = trpc.leaveRequest.submit.useMutation({
    onSuccess: () => router.refresh(),
  })

  const cancel = trpc.leaveRequest.cancel.useMutation({
    onSuccess: () => {
      setShowCancelDialog(false)
      router.refresh()
    },
  })

  const approve = trpc.leaveRequest.approve.useMutation({
    onSuccess: () => router.refresh(),
  })

  const status = statusConfig[request.status] || statusConfig.DRAFT
  const StatusIcon = status.icon

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-TW')
  }

  const formatDateTime = (date: Date | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('zh-TW')
  }

  const isOwner = request.employeeId === currentUserId

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/leave">
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
                  approve.mutate({
                    id: request.id,
                    action: 'APPROVE',
                    approverId: currentUserId,
                  })
                }
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                核准
              </Button>
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() =>
                  approve.mutate({
                    id: request.id,
                    action: 'REJECT',
                    approverId: currentUserId,
                  })
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
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 主要內容 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 請假資訊 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                請假資訊
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">假別</p>
                  <p className="font-medium">{request.leaveType.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">請假天數</p>
                  <p className="font-medium">{request.totalHours / 8} 天</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">開始日期</p>
                  <p className="font-medium">
                    {formatDate(request.startDate)} {periodLabels[request.startPeriod]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">結束日期</p>
                  <p className="font-medium">
                    {formatDate(request.endDate)} {periodLabels[request.endPeriod]}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 請假事由 */}
          {request.reason && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  請假事由
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{request.reason}</p>
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
                {request.submittedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-yellow-500" />
                    <div>
                      <p className="font-medium">送出審核</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(request.submittedAt)}
                      </p>
                    </div>
                  </div>
                )}
                {request.processedAt && (
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
                        {formatDateTime(request.processedAt)} by{' '}
                        {request.approvedBy?.name || request.rejectedBy?.name}
                      </p>
                      {request.approvalComment && (
                        <p className="text-sm mt-1">{request.approvalComment}</p>
                      )}
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
                <span className="font-medium">{request.employee.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">員工編號</span>
                <span>{request.employee.employeeNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-sm">{request.employee.email}</span>
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
                <Clock className="h-4 w-4" />
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

          {/* 新流程審核進度 */}
          <FlowProgress
            moduleType="LEAVE"
            referenceId={request.id}
          />

          {/* 舊簽核狀態（相容性） */}
          <WorkflowStatus
            requestType="LEAVE"
            requestId={request.id}
          />
        </div>
      </div>

      {/* 取消對話框 */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消申請</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            確定要取消此請假申請嗎？此操作無法復原。
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
    </div>
  )
}
