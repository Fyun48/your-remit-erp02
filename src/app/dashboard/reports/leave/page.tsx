import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, FileText, Tag, TrendingUp } from 'lucide-react'

export default async function LeaveReportPage() {
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

  // 取得該公司所有已核准的請假記錄（本年度）
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year + 1, 0, 1)

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      companyId: assignment.companyId,
      status: 'APPROVED',
      startDate: { gte: startOfYear, lt: endOfYear },
    },
    include: {
      leaveType: true,
    },
  })

  // 取得假別列表
  const leaveTypes = await prisma.leaveType.findMany({
    where: {
      OR: [
        { companyId: assignment.companyId },
        { companyId: null },
      ],
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  })

  // 計算總請假天數（每8小時算1天）
  const totalLeaveDays = leaveRequests.reduce((sum, r) => sum + r.totalHours / 8, 0)

  // 請假筆數
  const totalLeaveCount = leaveRequests.length

  // 假別使用統計
  const leaveTypeStats = leaveTypes.map(lt => {
    const requests = leaveRequests.filter(r => r.leaveTypeId === lt.id)
    const totalHours = requests.reduce((sum, r) => sum + r.totalHours, 0)
    return {
      id: lt.id,
      name: lt.name,
      code: lt.code,
      count: requests.length,
      totalHours,
      totalDays: totalHours / 8,
    }
  }).filter(stat => stat.count > 0)

  // 最常使用假別
  const mostUsedLeaveType = leaveTypeStats.length > 0
    ? leaveTypeStats.reduce((max, curr) => curr.count > max.count ? curr : max)
    : null

  // 月度請假統計
  const monthlyStats = Array.from({ length: 12 }, (_, i) => {
    const monthRequests = leaveRequests.filter(r => {
      const month = new Date(r.startDate).getMonth()
      return month === i
    })
    return {
      month: i + 1,
      count: monthRequests.length,
      totalHours: monthRequests.reduce((sum, r) => sum + r.totalHours, 0),
    }
  })

  // 請假高峰月
  const peakMonth = monthlyStats.reduce((max, curr) => curr.count > max.count ? curr : max)

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                      '七月', '八月', '九月', '十月', '十一月', '十二月']

  // 計算最大值用於進度條
  const maxMonthlyCount = Math.max(...monthlyStats.map(m => m.count), 1)
  const maxLeaveTypeCount = leaveTypeStats.length > 0
    ? Math.max(...leaveTypeStats.map(s => s.count), 1)
    : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">請假報表</h1>
        <p className="text-muted-foreground">
          {year}年度 - {assignment.company.name}
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              總請假天數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalLeaveDays.toFixed(1)} 天</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              請假筆數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalLeaveCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              最常使用假別
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {mostUsedLeaveType?.name || '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              請假高峰月
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {peakMonth.count > 0 ? monthNames[peakMonth.month - 1] : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 假別使用統計 */}
      <Card>
        <CardHeader>
          <CardTitle>假別使用統計</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveTypeStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">本年度尚無請假記錄</p>
          ) : (
            <div className="space-y-4">
              {leaveTypeStats.map((stat) => (
                <div key={stat.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{stat.name}</span>
                    <span className="text-muted-foreground">
                      {stat.count} 筆 / {stat.totalDays.toFixed(1)} 天
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(stat.count / maxLeaveTypeCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 月度請假趨勢 */}
      <Card>
        <CardHeader>
          <CardTitle>月度請假趨勢</CardTitle>
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
                    style={{ width: `${(stat.count / maxMonthlyCount) * 100}%`, minWidth: stat.count > 0 ? '40px' : '0' }}
                  >
                    {stat.count > 0 && (
                      <span className="text-xs text-white font-medium">{stat.count}</span>
                    )}
                  </div>
                </div>
                <span className="w-20 text-sm text-right text-muted-foreground">
                  {(stat.totalHours / 8).toFixed(1)} 天
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
