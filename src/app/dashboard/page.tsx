import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, Calendar, FileText, Receipt } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const userId = session.user.id

  // === Batch 1: 並行取得員工和公司資訊 ===
  const [employee, currentCompany] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    }),
    getCurrentCompany(userId),
  ])

  if (!employee) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">歡迎回來</h1>
        <p className="text-muted-foreground mt-2">請聯繫管理員設定您的任職資訊</p>
      </div>
    )
  }

  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">歡迎回來，{employee.name}</h1>
        <p className="text-muted-foreground mt-2">請聯繫管理員設定您的任職資訊</p>
      </div>
    )
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const startOfMonth = new Date(year, month, 1)
  const startOfNextMonth = new Date(year, month + 1, 1)
  const startOfYear = new Date(year, 0, 1)

  // === Batch 2: 並行取得所有統計資料 ===
  const [
    assignment,
    attendanceCount,
    pendingLeave,
    pendingExpense,
    annualLeaveType,
    expenseTotal,
    recentLeave,
    recentExpense,
  ] = await Promise.all([
    // 任職資訊
    prisma.employeeAssignment.findFirst({
      where: {
        employeeId: userId,
        companyId: currentCompany.id,
        status: 'ACTIVE',
      },
      include: { company: true, department: true },
    }),
    // 本月出勤天數
    prisma.attendanceRecord.count({
      where: {
        employeeId: employee.id,
        companyId: currentCompany.id,
        date: { gte: startOfMonth, lt: startOfNextMonth },
        status: { in: ['NORMAL', 'LATE', 'EARLY_LEAVE'] },
      },
    }),
    // 待審核請假
    prisma.leaveRequest.count({
      where: { employeeId: employee.id, status: 'PENDING' },
    }),
    // 待審核費用
    prisma.expenseRequest.count({
      where: { employeeId: employee.id, status: 'PENDING' },
    }),
    // 特休假別
    prisma.leaveType.findFirst({ where: { code: 'ANNUAL' } }),
    // 本年度費用報銷
    prisma.expenseRequest.aggregate({
      where: {
        employeeId: employee.id,
        companyId: currentCompany.id,
        status: 'APPROVED',
        periodStart: { gte: startOfYear },
      },
      _sum: { totalAmount: true },
    }),
    // 近期請假
    prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { leaveType: true },
    }),
    // 近期費用
    prisma.expenseRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ])

  const displayDepartment = assignment?.department?.name || '（無部門資訊）'

  // === Batch 3: 並行取得需要 assignment 的資料 ===
  const [subordinates, leaveBalance] = await Promise.all([
    // 下屬
    assignment
      ? prisma.employeeAssignment.findMany({
          where: { supervisorId: assignment.id, status: 'ACTIVE' },
          select: { employeeId: true, companyId: true },
        })
      : Promise.resolve([]),
    // 特休餘額
    annualLeaveType
      ? prisma.leaveBalance.findFirst({
          where: {
            employeeId: employee.id,
            companyId: currentCompany.id,
            leaveTypeId: annualLeaveType.id,
            year,
          },
        })
      : Promise.resolve(null),
  ])

  // 計算剩餘特休
  let remainingAnnualDays = 0
  if (leaveBalance) {
    const totalHours = leaveBalance.entitledHours + leaveBalance.carriedHours + leaveBalance.adjustedHours
    const usedHours = leaveBalance.usedHours + leaveBalance.pendingHours
    remainingAnnualDays = Math.floor((totalHours - usedHours) / 8)
  }

  // === Batch 4: 待我審核（主管）===
  let pendingForMe = 0
  if (subordinates.length > 0) {
    const [pendingLeaveForMe, pendingExpenseForMe] = await Promise.all([
      prisma.leaveRequest.count({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({ employeeId: s.employeeId, companyId: s.companyId })),
        },
      }),
      prisma.expenseRequest.count({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({ employeeId: s.employeeId, companyId: s.companyId })),
        },
      }),
    ])
    pendingForMe = pendingLeaveForMe + pendingExpenseForMe
  }

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
          {currentCompany.name} - {displayDepartment}
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
