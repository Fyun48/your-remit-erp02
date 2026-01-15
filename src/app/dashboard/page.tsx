import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, Calendar, FileText, Receipt } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
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
        include: { company: true, department: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">歡迎回來</h1>
        <p className="text-muted-foreground mt-2">請聯繫管理員設定您的任職資訊</p>
      </div>
    )
  }

  const assignment = employee.assignments[0]
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const startOfMonth = new Date(year, month, 1)
  const startOfNextMonth = new Date(year, month + 1, 1)
  const startOfYear = new Date(year, 0, 1)

  // 本月出勤天數
  const attendanceCount = await prisma.attendanceRecord.count({
    where: {
      employeeId: employee.id,
      companyId: assignment.companyId,
      date: { gte: startOfMonth, lt: startOfNextMonth },
      status: { in: ['NORMAL', 'LATE', 'EARLY_LEAVE'] },
    },
  })

  // 待審核申請
  const pendingLeave = await prisma.leaveRequest.count({
    where: { employeeId: employee.id, status: 'PENDING' },
  })
  const pendingExpense = await prisma.expenseRequest.count({
    where: { employeeId: employee.id, status: 'PENDING' },
  })

  // 待我審核（主管）
  const subordinates = await prisma.employeeAssignment.findMany({
    where: { supervisorId: assignment.id, status: 'ACTIVE' },
    select: { employeeId: true, companyId: true },
  })

  let pendingForMe = 0
  if (subordinates.length > 0) {
    const pendingLeaveForMe = await prisma.leaveRequest.count({
      where: {
        status: 'PENDING',
        OR: subordinates.map(s => ({ employeeId: s.employeeId, companyId: s.companyId })),
      },
    })
    const pendingExpenseForMe = await prisma.expenseRequest.count({
      where: {
        status: 'PENDING',
        OR: subordinates.map(s => ({ employeeId: s.employeeId, companyId: s.companyId })),
      },
    })
    pendingForMe = pendingLeaveForMe + pendingExpenseForMe
  }

  // 剩餘特休
  const annualLeaveType = await prisma.leaveType.findFirst({ where: { code: 'ANNUAL' } })
  let remainingAnnualDays = 0
  if (annualLeaveType) {
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        employeeId: employee.id,
        companyId: assignment.companyId,
        leaveTypeId: annualLeaveType.id,
        year,
      },
    })
    if (balance) {
      const totalHours = balance.entitledHours + balance.carriedHours + balance.adjustedHours
      const usedHours = balance.usedHours + balance.pendingHours
      remainingAnnualDays = Math.floor((totalHours - usedHours) / 8)
    }
  }

  // 本年度費用報銷
  const expenseTotal = await prisma.expenseRequest.aggregate({
    where: {
      employeeId: employee.id,
      companyId: assignment.companyId,
      status: 'APPROVED',
      periodStart: { gte: startOfYear },
    },
    _sum: { totalAmount: true },
  })

  // 近期活動
  const recentLeave = await prisma.leaveRequest.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { leaveType: true },
  })

  const recentExpense = await prisma.expenseRequest.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })

  const stats = [
    {
      name: '本月出勤',
      value: `${attendanceCount} 天`,
      icon: Clock,
      color: 'text-green-600',
      href: '/dashboard/attendance',
    },
    {
      name: '待審核申請',
      value: `${pendingLeave + pendingExpense}`,
      icon: FileText,
      color: 'text-blue-600',
      href: '/dashboard/leave',
    },
    {
      name: '剩餘特休',
      value: `${remainingAnnualDays} 天`,
      icon: Calendar,
      color: 'text-orange-600',
      href: '/dashboard/leave',
    },
    {
      name: '年度報銷',
      value: `$${(expenseTotal._sum.totalAmount || 0).toLocaleString()}`,
      icon: Receipt,
      color: 'text-purple-600',
      href: '/dashboard/expense',
    },
  ]

  // 如果是主管，加入待審核
  if (pendingForMe > 0) {
    stats.push({
      name: '待我審核',
      value: `${pendingForMe}`,
      icon: Users,
      color: 'text-red-600',
      href: '/dashboard/approval',
    })
  }

  const statusLabels: Record<string, string> = {
    DRAFT: '草稿',
    PENDING: '審核中',
    APPROVED: '已核准',
    REJECTED: '已拒絕',
    CANCELLED: '已取消',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          歡迎回來，{employee.name}
        </h1>
        <p className="text-muted-foreground">
          {assignment.company.name} - {assignment.department?.name || '未分配部門'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.name} href={stat.href}>
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.name}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近請假</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeave.length === 0 ? (
              <p className="text-muted-foreground">暫無請假記錄</p>
            ) : (
              <div className="space-y-3">
                {recentLeave.map((leave) => (
                  <div key={leave.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{leave.leaveType.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(leave.startDate).toLocaleDateString('zh-TW')}
                      </p>
                    </div>
                    <span className="text-sm">{statusLabels[leave.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近報銷</CardTitle>
          </CardHeader>
          <CardContent>
            {recentExpense.length === 0 ? (
              <p className="text-muted-foreground">暫無報銷記錄</p>
            ) : (
              <div className="space-y-3">
                {recentExpense.map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{expense.title}</p>
                      <p className="text-sm text-muted-foreground">
                        ${expense.totalAmount.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-sm">{statusLabels[expense.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
