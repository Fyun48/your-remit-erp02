'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  ArrowLeft,
  Stamp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  RotateCcw,
  Trash2,
  User,
  FileText,
  Calendar,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface SealRequest {
  id: string
  requestNo: string
  companyId: string
  applicantId: string
  sealType: string
  purpose: string
  documentName: string | null
  documentCount: number
  isCarryOut: boolean
  expectedReturn: string | null
  actualReturn: string | null
  returnNote: string | null
  status: string
  attachments: unknown
  approvalInstanceId: string | null
  processedById: string | null
  processedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  company: { id: string; name: string }
  applicant: { id: string; name: string; employeeNo: string; email: string }
  processedBy: { id: string; name: string } | null
}

interface SealRequestDetailProps {
  request: SealRequest
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

export function SealRequestDetail({ request, currentUserId }: SealRequestDetailProps) {
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [returnNote, setReturnNote] = useState('')

  const submit = trpc.sealRequest.submit.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => alert(e.message),
  })

  const cancel = trpc.sealRequest.cancel.useMutation({
    onSuccess: () => {
      setShowCancelDialog(false)
      router.refresh()
    },
    onError: (e) => alert(e.message),
  })

  const approve = trpc.sealRequest.approve.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => alert(e.message),
  })

  const reject = trpc.sealRequest.reject.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => alert(e.message),
  })

  const startProcessing = trpc.sealRequest.startProcessing.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => alert(e.message),
  })

  const complete = trpc.sealRequest.complete.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => alert(e.message),
  })

  const confirmReturn = trpc.sealRequest.confirmReturn.useMutation({
    onSuccess: () => {
      setShowReturnDialog(false)
      setReturnNote('')
      router.refresh()
    },
    onError: (e) => alert(e.message),
  })

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-TW')
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-TW')
  }

  const status = statusConfig[request.status]
  const StatusIcon = status.icon
  const isApplicant = request.applicantId === currentUserId
  const isOverdue =
    request.isCarryOut &&
    !request.actualReturn &&
    request.expectedReturn &&
    new Date(request.expectedReturn) < new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/seal">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{request.requestNo}</h1>
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                逾期未歸還
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{request.company.name}</p>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-2">
          {request.status === 'DRAFT' && isApplicant && (
            <>
              <Button onClick={() => submit.mutate({ id: request.id })} disabled={submit.isPending}>
                <Send className="h-4 w-4 mr-2" />
                提交審批
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                取消
              </Button>
            </>
          )}
          {request.status === 'PENDING' && (
            <>
              <Button onClick={() => approve.mutate({ id: request.id, approverId: currentUserId })}>
                <CheckCircle className="h-4 w-4 mr-2" />
                核准
              </Button>
              <Button
                variant="destructive"
                onClick={() => reject.mutate({ id: request.id, approverId: currentUserId })}
              >
                <XCircle className="h-4 w-4 mr-2" />
                駁回
              </Button>
              {isApplicant && (
                <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
                  取消申請
                </Button>
              )}
            </>
          )}
          {request.status === 'APPROVED' && (
            <Button
              onClick={() =>
                startProcessing.mutate({ id: request.id, processedById: currentUserId })
              }
            >
              <Stamp className="h-4 w-4 mr-2" />
              開始用印
            </Button>
          )}
          {request.status === 'PROCESSING' && (
            <Button
              onClick={() => complete.mutate({ id: request.id, processedById: currentUserId })}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              完成用印
            </Button>
          )}
          {request.isCarryOut &&
            !request.actualReturn &&
            ['APPROVED', 'PROCESSING', 'COMPLETED'].includes(request.status) && (
              <Button variant="outline" onClick={() => setShowReturnDialog(true)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                確認歸還
              </Button>
            )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 申請內容 */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stamp className="h-5 w-5" />
                用印資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">印章類型</Label>
                  <p className="font-medium">{sealTypeLabels[request.sealType]}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">用印份數</Label>
                  <p className="font-medium">{request.documentCount} 份</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">用途說明</Label>
                <p className="font-medium whitespace-pre-wrap">{request.purpose}</p>
              </div>
              {request.documentName && (
                <div>
                  <Label className="text-muted-foreground">文件名稱</Label>
                  <p className="font-medium">{request.documentName}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 攜出資訊 */}
          {request.isCarryOut && (
            <Card className={isOverdue ? 'border-red-200 bg-red-50' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className={`h-5 w-5 ${isOverdue ? 'text-red-500' : ''}`} />
                  攜出資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">預計歸還時間</Label>
                    <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                      {formatDateTime(request.expectedReturn)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">實際歸還時間</Label>
                    <p className="font-medium">
                      {request.actualReturn ? formatDateTime(request.actualReturn) : '尚未歸還'}
                    </p>
                  </div>
                </div>
                {request.returnNote && (
                  <div>
                    <Label className="text-muted-foreground">歸還備註</Label>
                    <p className="font-medium">{request.returnNote}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 處理紀錄 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                處理紀錄
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <div className="flex-1">
                    <p className="font-medium">申請建立</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                </div>
                {request.processedAt && (
                  <div className="flex items-center gap-4 pb-4 border-b">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    <div className="flex-1">
                      <p className="font-medium">開始處理</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(request.processedAt)} - {request.processedBy?.name}
                      </p>
                    </div>
                  </div>
                )}
                {request.completedAt && (
                  <div className="flex items-center gap-4 pb-4 border-b">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <div className="flex-1">
                      <p className="font-medium">用印完成</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(request.completedAt)}
                      </p>
                    </div>
                  </div>
                )}
                {request.actualReturn && (
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <div className="flex-1">
                      <p className="font-medium">已歸還</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(request.actualReturn)}
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
                <User className="h-5 w-5" />
                申請人資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">姓名</span>
                <span className="font-medium">{request.applicant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">員工編號</span>
                <span className="font-mono">{request.applicant.employeeNo}</span>
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
                <Calendar className="h-5 w-5" />
                時間資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">申請時間</span>
                <span>{formatDate(request.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">最後更新</span>
                <span>{formatDate(request.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 取消確認對話框 */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認取消申請？</AlertDialogTitle>
            <AlertDialogDescription>
              取消後無法恢復，確定要取消此用印申請嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancel.mutate({ id: request.id })}
              className="bg-red-600 hover:bg-red-700"
            >
              確認取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 歸還確認對話框 */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認歸還</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                確認印章已歸還？此操作將記錄歸還時間。
              </p>
            </div>
            <div className="space-y-2">
              <Label>歸還備註（選填）</Label>
              <Input
                placeholder="輸入歸還備註..."
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                confirmReturn.mutate({
                  id: request.id,
                  returnNote: returnNote || undefined,
                })
              }
              disabled={confirmReturn.isPending}
            >
              {confirmReturn.isPending ? '處理中...' : '確認歸還'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
