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
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Printer,
  Send,
  Trash2,
  User,
  Calendar,
  Building2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface CardRequest {
  id: string
  requestNo: string
  companyId: string
  applicantId: string
  name: string
  nameEn: string | null
  title: string
  titleEn: string | null
  department: string | null
  phone: string | null
  mobile: string | null
  fax: string | null
  email: string | null
  address: string | null
  quantity: number
  note: string | null
  status: string
  approvedById: string | null
  approvedAt: string | null
  printedAt: string | null
  createdAt: string
  updatedAt: string
  company: { id: string; name: string }
  applicant: { id: string; name: string; employeeNo: string; email: string }
  approvedBy: { id: string; name: string } | null
}

interface CardRequestDetailProps {
  request: CardRequest
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

export function CardRequestDetail({ request, currentUserId }: CardRequestDetailProps) {
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const submit = trpc.businessCard.submit.useMutation({
    onSuccess: () => router.refresh(),
  })

  const cancel = trpc.businessCard.cancel.useMutation({
    onSuccess: () => {
      setShowCancelDialog(false)
      router.refresh()
    },
  })

  const approve = trpc.businessCard.approve.useMutation({
    onSuccess: () => router.refresh(),
  })

  const reject = trpc.businessCard.reject.useMutation({
    onSuccess: () => router.refresh(),
  })

  const startPrinting = trpc.businessCard.startPrinting.useMutation({
    onSuccess: () => router.refresh(),
  })

  const complete = trpc.businessCard.complete.useMutation({
    onSuccess: () => router.refresh(),
  })

  const status = statusConfig[request.status] || statusConfig.DRAFT
  const StatusIcon = status.icon

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-TW')
  }

  const isOwner = request.applicantId === currentUserId

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/card">
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
                onClick={() => approve.mutate({ id: request.id, approverId: currentUserId })}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                核准
              </Button>
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() => reject.mutate({ id: request.id, approverId: currentUserId })}
              >
                <XCircle className="h-4 w-4 mr-2" />
                駁回
              </Button>
              {isOwner && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                >
                  取消申請
                </Button>
              )}
            </>
          )}
          {request.status === 'APPROVED' && (
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => startPrinting.mutate({ id: request.id })}
            >
              <Printer className="h-4 w-4 mr-2" />
              開始印刷
            </Button>
          )}
          {request.status === 'PRINTING' && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => complete.mutate({ id: request.id })}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              完成印刷
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 名片資訊 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 名片預覽 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                名片預覽
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-white shadow-sm max-w-md mx-auto aspect-[1.75/1] flex flex-col justify-between">
                <div>
                  <div className="font-bold text-lg text-primary">
                    {request.company.name}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-xl">{request.name}</div>
                  {request.nameEn && (
                    <div className="text-muted-foreground">{request.nameEn}</div>
                  )}
                  <div className="text-muted-foreground">
                    {request.title}
                    {request.titleEn && ` / ${request.titleEn}`}
                    {request.department && ` | ${request.department}`}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {request.phone && <div>Tel: {request.phone}</div>}
                  {request.mobile && <div>Mobile: {request.mobile}</div>}
                  {request.fax && <div>Fax: {request.fax}</div>}
                  {request.email && <div>Email: {request.email}</div>}
                  {request.address && <div>{request.address}</div>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 詳細資料 */}
          <Card>
            <CardHeader>
              <CardTitle>申請詳情</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">姓名</p>
                  <p className="font-medium">{request.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">英文名</p>
                  <p className="font-medium">{request.nameEn || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">職稱</p>
                  <p className="font-medium">{request.title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">英文職稱</p>
                  <p className="font-medium">{request.titleEn || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">部門</p>
                  <p className="font-medium">{request.department || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">數量</p>
                  <p className="font-medium">{request.quantity} 盒</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">備註</p>
                  <p className="font-medium">{request.note || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                {request.printedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="font-medium">印刷完成</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(request.printedAt)}
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
          <p className="text-muted-foreground">確定要取消此名片申請嗎？此操作無法復原。</p>
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
