'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Info,
  Printer,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'

type VoucherStatus = 'DRAFT' | 'PENDING' | 'POSTED' | 'VOID'
type VoucherType = 'RECEIPT' | 'PAYMENT' | 'TRANSFER'

interface Account {
  id: string
  code: string
  name: string
}

interface VoucherLine {
  id: string
  lineNo: number
  accountId: string
  account: Account
  debitAmount: number | { toNumber: () => number }
  creditAmount: number | { toNumber: () => number }
  description: string | null
  customer: { name: string } | null
  vendor: { name: string } | null
  department: { name: string } | null
}

interface Voucher {
  id: string
  voucherNo: string
  voucherDate: Date
  voucherType: VoucherType
  status: VoucherStatus
  description: string | null
  totalDebit: number | { toNumber: () => number }
  totalCredit: number | { toNumber: () => number }
  company: { id: string; name: string }
  period: { id: string; year: number; period: number; status: string }
  createdBy: { id: string; name: string }
  approvedBy: { id: string; name: string } | null
  postedBy: { id: string; name: string } | null
  createdAt: Date
  postedAt: Date | null
  lines: VoucherLine[]
}

interface VoucherDetailProps {
  voucher: Voucher
  accounts: Account[]
  employeeId: string
  hasPermission: boolean
}

const statusConfig: Record<VoucherStatus, { label: string; icon: typeof Clock; color: string; description: string }> = {
  DRAFT: {
    label: '草稿',
    icon: Clock,
    color: 'text-gray-500 bg-gray-100',
    description: '傳票尚未提交，可以修改或刪除',
  },
  PENDING: {
    label: '待審核',
    icon: Clock,
    color: 'text-blue-500 bg-blue-100',
    description: '傳票已提交，等待審核過帳',
  },
  POSTED: {
    label: '已過帳',
    icon: CheckCircle,
    color: 'text-green-500 bg-green-100',
    description: '傳票已過帳，無法修改或刪除',
  },
  VOID: {
    label: '作廢',
    icon: XCircle,
    color: 'text-red-500 bg-red-100',
    description: '傳票已作廢，不計入帳務',
  },
}

const typeLabels: Record<VoucherType, string> = {
  RECEIPT: '收款傳票',
  PAYMENT: '付款傳票',
  TRANSFER: '轉帳傳票',
}

function toNumber(value: number | string | { toNumber: () => number } | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value) || 0
  if (typeof value === 'object' && 'toNumber' in value) return value.toNumber()
  return 0
}

export function VoucherDetail({
  voucher,
  employeeId,
  hasPermission,
}: VoucherDetailProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showVoidDialog, setShowVoidDialog] = useState(false)

  const utils = trpc.useUtils()

  const postMutation = trpc.voucher.post.useMutation({
    onSuccess: () => {
      toast.success('傳票已過帳')
      utils.voucher.getById.invalidate({ id: voucher.id })
      router.refresh()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const voidMutation = trpc.voucher.void.useMutation({
    onSuccess: () => {
      toast.success('傳票已作廢')
      utils.voucher.getById.invalidate({ id: voucher.id })
      router.refresh()
      setShowVoidDialog(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = trpc.voucher.delete.useMutation({
    onSuccess: () => {
      toast.success('傳票已刪除')
      router.push('/dashboard/finance/accounting/vouchers')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const status = statusConfig[voucher.status]
  const StatusIcon = status.icon
  const canEdit = voucher.status === 'DRAFT' && voucher.period.status === 'OPEN' && hasPermission
  const canDelete = voucher.status === 'DRAFT' && voucher.period.status === 'OPEN' && hasPermission
  const canPost = (voucher.status === 'DRAFT' || voucher.status === 'PENDING') && voucher.period.status === 'OPEN' && hasPermission
  const canVoid = voucher.status !== 'VOID' && hasPermission

  const handlePost = () => {
    postMutation.mutate({ id: voucher.id, postedById: employeeId })
  }

  const handleVoid = () => {
    voidMutation.mutate({ id: voucher.id })
  }

  const handleDelete = () => {
    deleteMutation.mutate({ id: voucher.id })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* 頂部導航欄 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/finance/accounting/vouchers')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{voucher.voucherNo}</h1>
            <p className="text-muted-foreground">{voucher.company.name}</p>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            列印
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/finance/accounting/vouchers/${voucher.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              編輯
            </Button>
          )}
          {canPost && (
            <Button
              size="sm"
              onClick={handlePost}
              disabled={postMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              過帳
            </Button>
          )}
          {canVoid && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVoidDialog(true)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              作廢
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              刪除
            </Button>
          )}
        </div>
      </div>

      {/* 狀態說明 */}
      <Alert className="print:hidden">
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
          <span>{status.description}</span>
        </AlertDescription>
      </Alert>

      {/* 傳票資訊 */}
      <Card>
        <CardHeader>
          <CardTitle>傳票資訊</CardTitle>
          <CardDescription>{typeLabels[voucher.voucherType]}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">傳票日期</p>
              <p className="font-medium">
                {new Date(voucher.voucherDate).toLocaleDateString('zh-TW')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">會計期間</p>
              <p className="font-medium">
                {voucher.period.year} 年 {voucher.period.period} 月
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">製單人</p>
              <p className="font-medium">{voucher.createdBy.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">製單時間</p>
              <p className="font-medium">
                {new Date(voucher.createdAt).toLocaleString('zh-TW')}
              </p>
            </div>
            {voucher.postedBy && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">過帳人</p>
                  <p className="font-medium">{voucher.postedBy.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">過帳時間</p>
                  <p className="font-medium">
                    {voucher.postedAt
                      ? new Date(voucher.postedAt).toLocaleString('zh-TW')
                      : '-'}
                  </p>
                </div>
              </>
            )}
            {voucher.description && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-sm text-muted-foreground">摘要</p>
                <p className="font-medium">{voucher.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 分錄明細 */}
      <Card>
        <CardHeader>
          <CardTitle>分錄明細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 w-12">行</th>
                  <th className="text-left py-3 px-2">科目</th>
                  <th className="text-left py-3 px-2">說明</th>
                  <th className="text-left py-3 px-2">輔助核算</th>
                  <th className="text-right py-3 px-2 w-32">借方金額</th>
                  <th className="text-right py-3 px-2 w-32">貸方金額</th>
                </tr>
              </thead>
              <tbody>
                {voucher.lines.map((line) => (
                  <tr key={line.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 text-center">{line.lineNo}</td>
                    <td className="py-3 px-2">
                      <span className="font-mono text-xs">{line.account.code}</span>
                      <span className="ml-2">{line.account.name}</span>
                    </td>
                    <td className="py-3 px-2">{line.description || '-'}</td>
                    <td className="py-3 px-2">
                      {line.customer && <span className="text-blue-600">客戶: {line.customer.name}</span>}
                      {line.vendor && <span className="text-orange-600">供應商: {line.vendor.name}</span>}
                      {line.department && <span className="text-purple-600">部門: {line.department.name}</span>}
                      {!line.customer && !line.vendor && !line.department && '-'}
                    </td>
                    <td className="py-3 px-2 text-right font-mono">
                      {toNumber(line.debitAmount) > 0
                        ? `$${toNumber(line.debitAmount).toLocaleString()}`
                        : ''}
                    </td>
                    <td className="py-3 px-2 text-right font-mono">
                      {toNumber(line.creditAmount) > 0
                        ? `$${toNumber(line.creditAmount).toLocaleString()}`
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-medium">
                  <td colSpan={4} className="py-3 px-2 text-right">
                    合計
                  </td>
                  <td className="py-3 px-2 text-right font-mono">
                    ${toNumber(voucher.totalDebit).toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-mono">
                    ${toNumber(voucher.totalCredit).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 刪除確認對話框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此傳票？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。傳票 {voucher.voucherNo} 及其所有分錄將被永久刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 作廢確認對話框 */}
      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要作廢此傳票？</AlertDialogTitle>
            <AlertDialogDescription>
              作廢後傳票將不計入帳務計算。此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoid}
              disabled={voidMutation.isPending}
            >
              確定作廢
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
