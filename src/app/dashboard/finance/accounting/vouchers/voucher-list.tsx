'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Building2,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface Company {
  companyId: string
  company: {
    id: string
    name: string
  }
}

interface VoucherListProps {
  assignments: Company[]
  initialCompanyId: string
  hasPermission: boolean
}

type VoucherStatus = 'DRAFT' | 'PENDING' | 'POSTED' | 'VOID'
type VoucherType = 'RECEIPT' | 'PAYMENT' | 'TRANSFER'

const statusConfig: Record<VoucherStatus, { label: string; icon: typeof Clock; color: string; description: string; operation: string }> = {
  DRAFT: {
    label: '草稿',
    icon: Clock,
    color: 'text-gray-500',
    description: '可編輯/刪除',
    operation: '建立者或有權限者可編輯、刪除或送審',
  },
  PENDING: {
    label: '待審核',
    icon: Clock,
    color: 'text-blue-500',
    description: '等待過帳',
    operation: '財務主管可過帳或退回',
  },
  POSTED: {
    label: '已過帳',
    icon: CheckCircle,
    color: 'text-green-500',
    description: '已計入帳務',
    operation: '財務主管可作廢（需填寫原因）',
  },
  VOID: {
    label: '作廢',
    icon: XCircle,
    color: 'text-red-500',
    description: '不計入帳務',
    operation: '已作廢，無法再操作',
  },
}

const typeLabels: Record<VoucherType, string> = {
  RECEIPT: '收款',
  PAYMENT: '付款',
  TRANSFER: '轉帳',
}

function toNumber(value: number | { toNumber?: () => number } | unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value) || 0
}

type SortField = 'voucherNo' | 'voucherDate' | 'voucherType' | 'totalDebit' | 'status' | 'createdBy'
type SortDirection = 'asc' | 'desc'

export function VoucherList({
  assignments,
  initialCompanyId,
  hasPermission,
}: VoucherListProps) {
  const router = useRouter()
  const [selectedCompanyId] = useState(initialCompanyId)
  const [sortField, setSortField] = useState<SortField>('voucherDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const { data: vouchersData = [], isLoading } = trpc.voucher.list.useQuery(
    { companyId: selectedCompanyId },
    { enabled: !!selectedCompanyId }
  )

  // 排序邏輯
  const vouchers = [...vouchersData].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'voucherNo':
        comparison = a.voucherNo.localeCompare(b.voucherNo)
        break
      case 'voucherDate':
        comparison = new Date(a.voucherDate).getTime() - new Date(b.voucherDate).getTime()
        break
      case 'voucherType':
        comparison = a.voucherType.localeCompare(b.voucherType)
        break
      case 'totalDebit':
        comparison = toNumber(a.totalDebit) - toNumber(b.totalDebit)
        break
      case 'status':
        comparison = a.status.localeCompare(b.status)
        break
      case 'createdBy':
        comparison = a.createdBy.name.localeCompare(b.createdBy.name)
        break
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const selectedCompany = assignments.find(a => a.companyId === selectedCompanyId)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />
  }

  const handleCompanyChange = async (companyId: string) => {
    // 更新全域公司選擇 cookie
    try {
      const response = await fetch('/api/company/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
        credentials: 'include',
      })
      if (response.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error('切換公司失敗', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* 頂部導航欄 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/finance/accounting')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">傳票管理</h1>
            <p className="text-muted-foreground">{selectedCompany?.company.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 公司選擇器 */}
          {assignments.length > 1 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="選擇公司" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((a) => (
                    <SelectItem key={a.companyId} value={a.companyId}>
                      {a.company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {hasPermission && (
            <Link href="/dashboard/finance/accounting/vouchers/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新增傳票
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 狀態說明 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <div className="font-medium">傳票狀態說明：</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(statusConfig).map(([key, config]) => {
                const StatusIcon = config.icon
                return (
                  <div key={key} className="flex items-start gap-2 text-sm">
                    <StatusIcon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                    <div>
                      <span className={`font-medium ${config.color}`}>{config.label}</span>
                      <span className="text-muted-foreground"> ({config.description})</span>
                      <div className="text-xs text-muted-foreground">{config.operation}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* 傳票列表 */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">載入中...</div>
      ) : vouchers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立任何傳票</p>
              {hasPermission && (
                <p className="text-sm text-muted-foreground mt-2">
                  點擊「新增傳票」開始建立傳票
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>傳票列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th
                      className="text-left py-3 px-2 cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('voucherNo')}
                    >
                      <div className="flex items-center">
                        傳票號碼
                        <SortIcon field="voucherNo" />
                      </div>
                    </th>
                    <th
                      className="text-left py-3 px-2 cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('voucherDate')}
                    >
                      <div className="flex items-center">
                        日期
                        <SortIcon field="voucherDate" />
                      </div>
                    </th>
                    <th
                      className="text-left py-3 px-2 cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('voucherType')}
                    >
                      <div className="flex items-center">
                        類型
                        <SortIcon field="voucherType" />
                      </div>
                    </th>
                    <th className="text-left py-3 px-2">摘要</th>
                    <th
                      className="text-right py-3 px-2 cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('totalDebit')}
                    >
                      <div className="flex items-center justify-end">
                        金額
                        <SortIcon field="totalDebit" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2">分錄</th>
                    <th
                      className="text-center py-3 px-2 cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center justify-center">
                        狀態
                        <SortIcon field="status" />
                      </div>
                    </th>
                    <th
                      className="text-left py-3 px-2 cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('createdBy')}
                    >
                      <div className="flex items-center">
                        製單人
                        <SortIcon field="createdBy" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const status = statusConfig[voucher.status as VoucherStatus]
                    const StatusIcon = status.icon
                    return (
                      <tr key={voucher.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <Link
                            href={`/dashboard/finance/accounting/vouchers/${voucher.id}`}
                            className="font-mono text-primary hover:underline"
                          >
                            {voucher.voucherNo}
                          </Link>
                        </td>
                        <td className="py-3 px-2">
                          {new Date(voucher.voucherDate).toLocaleDateString('zh-TW')}
                        </td>
                        <td className="py-3 px-2">{typeLabels[voucher.voucherType as VoucherType]}</td>
                        <td className="py-3 px-2 max-w-xs truncate">
                          {voucher.description || '-'}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          ${toNumber(voucher.totalDebit).toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-center">{voucher._count.lines}</td>
                        <td className="py-3 px-2">
                          <div
                            className={`flex items-center justify-center gap-1 ${status.color}`}
                            title={status.description}
                          >
                            <StatusIcon className="h-4 w-4" />
                            <span>{status.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">{voucher.createdBy.name}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
