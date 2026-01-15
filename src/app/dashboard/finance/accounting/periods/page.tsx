import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, Lock, Unlock } from 'lucide-react'

export default async function AccountingPeriodsPage() {
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

  // 取得所有會計期間
  const periods = await prisma.accountingPeriod.findMany({
    where: { companyId },
    orderBy: [{ year: 'desc' }, { period: 'desc' }],
  })

  // 按年度分組
  const periodsByYear = periods.reduce((acc, period) => {
    if (!acc[period.year]) acc[period.year] = []
    acc[period.year].push(period)
    return acc
  }, {} as Record<number, typeof periods>)

  const years = Object.keys(periodsByYear).map(Number).sort((a, b) => b - a)

  const statusConfig: Record<string, { label: string; className: string }> = {
    OPEN: { label: '開放', className: 'bg-green-100 text-green-800' },
    CLOSED: { label: '已關閉', className: 'bg-yellow-100 text-yellow-800' },
    LOCKED: { label: '已鎖定', className: 'bg-red-100 text-red-800' },
  }

  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">會計期間</h1>
          <p className="text-muted-foreground">{employee.assignments[0].company.name}</p>
        </div>
        {!periodsByYear[currentYear] && (
          <form action="/api/accounting/init-periods" method="POST">
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="year" value={currentYear} />
            <Button type="submit">
              <Plus className="h-4 w-4 mr-2" />
              初始化 {currentYear} 年度
            </Button>
          </form>
        )}
      </div>

      {periods.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立會計期間</p>
              <p className="text-sm text-muted-foreground mt-2">
                點擊「初始化 {currentYear} 年度」建立本年度的 12 個會計期間
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <Card key={year}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {year} 年度
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 w-20">期間</th>
                        <th className="text-left py-2 px-2">起始日</th>
                        <th className="text-left py-2 px-2">結束日</th>
                        <th className="text-center py-2 px-2 w-24">狀態</th>
                        <th className="text-left py-2 px-2">關閉時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodsByYear[year]
                        .sort((a, b) => a.period - b.period)
                        .map((period) => {
                          const config = statusConfig[period.status] || statusConfig.OPEN
                          return (
                            <tr key={period.id} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-2 font-medium">{period.period} 月</td>
                              <td className="py-2 px-2">
                                {new Date(period.startDate).toLocaleDateString('zh-TW')}
                              </td>
                              <td className="py-2 px-2">
                                {new Date(period.endDate).toLocaleDateString('zh-TW')}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                                  {period.status === 'OPEN' ? (
                                    <Unlock className="h-3 w-3" />
                                  ) : (
                                    <Lock className="h-3 w-3" />
                                  )}
                                  {config.label}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-muted-foreground">
                                {period.closedAt
                                  ? new Date(period.closedAt).toLocaleString('zh-TW')
                                  : '-'}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
