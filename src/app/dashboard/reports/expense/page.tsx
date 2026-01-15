import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt, TrendingUp, PieChart, Building2 } from 'lucide-react'

export default async function ExpenseReportPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得員工任職資訊
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

  const assignment = employee.assignments[0]
  const now = new Date()
  const year = now.getFullYear()

  // 取得該公司所有已核准的費用報銷記錄（本年度）
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year + 1, 0, 1)

  const expenseRequests = await prisma.expenseRequest.findMany({
    where: {
      companyId: assignment.companyId,
      status: 'APPROVED',
      periodStart: { gte: startOfYear, lt: endOfYear },
    },
    include: {
      items: {
        include: {
          category: true,
        },
      },
    },
  })

  // 取得費用類別列表
  const expenseCategories = await prisma.expenseCategory.findMany({
    where: {
      OR: [
        { companyId: assignment.companyId },
        { companyId: null },
      ],
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  })

  // 計算年度總費用
  const totalExpenseAmount = expenseRequests.reduce((sum, r) => sum + r.totalAmount, 0)

  // 報銷筆數
  const totalExpenseCount = expenseRequests.length

  // 類別使用統計
  const categoryStats = expenseCategories.map(cat => {
    const items = expenseRequests.flatMap(r => r.items).filter(item => item.categoryId === cat.id)
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
    return {
      id: cat.id,
      name: cat.name,
      code: cat.code,
      count: items.length,
      totalAmount,
    }
  }).filter(stat => stat.count > 0)

  // 最大類別（金額最高）
  const maxCategory = categoryStats.length > 0
    ? categoryStats.reduce((max, curr) => curr.totalAmount > max.totalAmount ? curr : max)
    : null

  // 月度費用統計
  const monthlyStats = Array.from({ length: 12 }, (_, i) => {
    const monthRequests = expenseRequests.filter(r => {
      const month = new Date(r.periodStart).getMonth()
      return month === i
    })
    const totalAmount = monthRequests.reduce((sum, r) => sum + r.totalAmount, 0)
    return {
      month: i + 1,
      count: monthRequests.length,
      totalAmount,
    }
  })

  // 費用高峰月（金額最高）
  const peakMonth = monthlyStats.reduce((max, curr) => curr.totalAmount > max.totalAmount ? curr : max)

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                      '七月', '八月', '九月', '十月', '十一月', '十二月']

  // 格式化金額為 TWD
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // 計算最大值用於進度條
  const maxMonthlyAmount = Math.max(...monthlyStats.map(m => m.totalAmount), 1)
  const maxCategoryAmount = categoryStats.length > 0
    ? Math.max(...categoryStats.map(s => s.totalAmount), 1)
    : 1
  const totalCategoryAmount = categoryStats.reduce((sum, s) => sum + s.totalAmount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">費用分析</h1>
        <p className="text-muted-foreground">
          {year}年度 - {assignment.company.name}
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              年度總費用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalExpenseAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              報銷筆數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalExpenseCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              最大類別
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {maxCategory?.name || '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              費用高峰月
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {peakMonth.totalAmount > 0 ? monthNames[peakMonth.month - 1] : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 費用類別分布 */}
      <Card>
        <CardHeader>
          <CardTitle>費用類別分布</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">本年度尚無費用報銷記錄</p>
          ) : (
            <div className="space-y-4">
              {categoryStats.map((stat) => {
                const percentage = totalCategoryAmount > 0
                  ? ((stat.totalAmount / totalCategoryAmount) * 100).toFixed(1)
                  : '0'
                return (
                  <div key={stat.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{stat.name}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(stat.totalAmount)} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${(stat.totalAmount / maxCategoryAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 月度費用趨勢 */}
      <Card>
        <CardHeader>
          <CardTitle>月度費用趨勢</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monthlyStats.map((stat) => (
              <div key={stat.month} className="flex items-center gap-4">
                <span className="w-16 text-sm text-muted-foreground">
                  {monthNames[stat.month - 1]}
                </span>
                <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded transition-all flex items-center justify-end pr-2"
                    style={{ width: `${(stat.totalAmount / maxMonthlyAmount) * 100}%`, minWidth: stat.totalAmount > 0 ? '60px' : '0' }}
                  >
                    {stat.totalAmount > 0 && (
                      <span className="text-xs text-white font-medium">{stat.count}</span>
                    )}
                  </div>
                </div>
                <span className="w-28 text-sm text-right text-muted-foreground">
                  {formatCurrency(stat.totalAmount)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
