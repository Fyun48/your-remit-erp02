import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Receipt, Plus, Clock, CheckCircle, XCircle, FileText } from 'lucide-react'

export default async function ExpensePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id

  // Use getCurrentCompany to respect the user's selected company from header switcher
  const currentCompany = await getCurrentCompany(employeeId)

  if (!currentCompany) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">費用核銷</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">尚未指派任職公司</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const companyId = currentCompany.id

  // 取得今年費用核銷紀錄
  const year = new Date().getFullYear()
  const requests = await prisma.expenseRequest.findMany({
    where: {
      employeeId,
      companyId,
      periodStart: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31),
      },
    },
    include: { items: { include: { category: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // 計算統計數據
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'PENDING').length,
    approved: requests.filter(r => r.status === 'APPROVED').length,
    totalAmount: requests
      .filter(r => r.status === 'APPROVED')
      .reduce((sum, r) => sum + r.totalAmount, 0),
  }

  const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    DRAFT: { label: '草稿', className: 'bg-gray-100 text-gray-800', icon: FileText },
    PENDING: { label: '審核中', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
    APPROVED: { label: '已核准', className: 'bg-green-100 text-green-800', icon: CheckCircle },
    REJECTED: { label: '已拒絕', className: 'bg-red-100 text-red-800', icon: XCircle },
    CANCELLED: { label: '已取消', className: 'bg-gray-100 text-gray-500', icon: XCircle },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">費用核銷</h1>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">{currentCompany.name}</p>
          <Link href="/dashboard/expense/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新增報銷
            </Button>
          </Link>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總申請數</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{year} 年度</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">審核中</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">等待審核</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已核准</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">通過審核</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">核准金額</CardTitle>
            <Receipt className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalAmount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">TWD</p>
          </CardContent>
        </Card>
      </div>

      {/* 報銷列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            我的報銷紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">尚無報銷紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">單號</th>
                    <th className="text-left py-3 px-2 font-medium">標題</th>
                    <th className="text-left py-3 px-2 font-medium">報銷期間</th>
                    <th className="text-right py-3 px-2 font-medium">金額</th>
                    <th className="text-left py-3 px-2 font-medium">狀態</th>
                    <th className="text-center py-3 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const config = statusConfig[req.status] || statusConfig.DRAFT
                    const StatusIcon = config.icon
                    return (
                      <tr key={req.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-mono text-sm">{req.requestNo}</td>
                        <td className="py-3 px-2">{req.title}</td>
                        <td className="py-3 px-2">
                          {new Date(req.periodStart).toLocaleDateString('zh-TW')}
                          {req.periodStart.getTime() !== req.periodEnd.getTime() && (
                            <> ~ {new Date(req.periodEnd).toLocaleDateString('zh-TW')}</>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          ${req.totalAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Link href={`/dashboard/expense/${req.id}`}>
                            <Button variant="outline" size="sm">
                              查看
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
