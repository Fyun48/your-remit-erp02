import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, FileText, CheckCircle, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function VouchersPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: { company: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  const companyId = employee.assignments[0].companyId

  // 取得傳票列表
  const vouchers = await prisma.voucher.findMany({
    where: { companyId },
    include: {
      period: true,
      createdBy: { select: { name: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { voucherNo: 'desc' },
    take: 50,
  })

  const statusConfig = {
    DRAFT: { label: '草稿', icon: Clock, color: 'text-gray-500' },
    PENDING: { label: '待審核', icon: Clock, color: 'text-blue-500' },
    POSTED: { label: '已過帳', icon: CheckCircle, color: 'text-green-500' },
    VOID: { label: '作廢', icon: XCircle, color: 'text-red-500' },
  }

  const typeLabels = {
    RECEIPT: '收款',
    PAYMENT: '付款',
    TRANSFER: '轉帳',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">傳票管理</h1>
          <p className="text-muted-foreground">{employee.assignments[0].company.name}</p>
        </div>
        <Link href="/dashboard/finance/accounting/vouchers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增傳票
          </Button>
        </Link>
      </div>

      {vouchers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立任何傳票</p>
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
                    <th className="text-left py-3 px-2">傳票號碼</th>
                    <th className="text-left py-3 px-2">日期</th>
                    <th className="text-left py-3 px-2">類型</th>
                    <th className="text-left py-3 px-2">摘要</th>
                    <th className="text-right py-3 px-2">金額</th>
                    <th className="text-center py-3 px-2">分錄</th>
                    <th className="text-center py-3 px-2">狀態</th>
                    <th className="text-left py-3 px-2">製單人</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const status = statusConfig[voucher.status]
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
                        <td className="py-3 px-2">{typeLabels[voucher.voucherType]}</td>
                        <td className="py-3 px-2 max-w-xs truncate">
                          {voucher.description || '-'}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          ${Number(voucher.totalDebit).toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-center">{voucher._count.lines}</td>
                        <td className="py-3 px-2">
                          <div className={`flex items-center justify-center gap-1 ${status.color}`}>
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
