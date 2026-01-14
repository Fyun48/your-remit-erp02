import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Users, AlertTriangle, TrendingUp } from 'lucide-react'

export default async function AttendanceReportPage() {
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
  const month = now.getMonth()
  const startOfMonth = new Date(year, month, 1)
  const startOfNextMonth = new Date(year, month + 1, 1)

  // 取得所有員工任職
  const assignments = await prisma.employeeAssignment.findMany({
    where: { companyId: assignment.companyId, status: 'ACTIVE' },
    include: { employee: true, department: true },
  })

  // 取得本月出勤記錄
  const records = await prisma.attendanceRecord.findMany({
    where: {
      companyId: assignment.companyId,
      date: { gte: startOfMonth, lt: startOfNextMonth },
    },
  })

  // 建立員工記錄 Map
  const recordsByEmployee = new Map<string, typeof records>()
  records.forEach(r => {
    const existing = recordsByEmployee.get(r.employeeId) || []
    existing.push(r)
    recordsByEmployee.set(r.employeeId, existing)
  })

  // 統計
  const report = assignments.map(a => {
    const empRecords = recordsByEmployee.get(a.employeeId) || []
    const statusCounts = empRecords.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      acc.overtimeMinutes += r.overtimeMinutes
      return acc
    }, { NORMAL: 0, LATE: 0, EARLY_LEAVE: 0, ABSENT: 0, LEAVE: 0, overtimeMinutes: 0 } as Record<string, number>)

    return {
      employeeId: a.employeeId,
      employeeName: a.employee.name,
      employeeNo: a.employee.employeeNo,
      department: a.department?.name || '-',
      normalDays: statusCounts.NORMAL,
      lateDays: statusCounts.LATE,
      earlyLeaveDays: statusCounts.EARLY_LEAVE,
      absentDays: statusCounts.ABSENT,
      overtimeHours: (statusCounts.overtimeMinutes / 60).toFixed(1),
    }
  })

  const summary = {
    totalEmployees: report.length,
    avgNormalDays: report.length > 0
      ? (report.reduce((sum, r) => sum + r.normalDays, 0) / report.length).toFixed(1)
      : '0',
    totalLateDays: report.reduce((sum, r) => sum + r.lateDays, 0),
    totalOvertimeHours: report.reduce((sum, r) => sum + parseFloat(r.overtimeHours), 0).toFixed(1),
  }

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                      '七月', '八月', '九月', '十月', '十一月', '十二月']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">出勤報表</h1>
        <p className="text-muted-foreground">
          {year}年{monthNames[month]} - {assignment.company.name}
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              員工人數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalEmployees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              平均出勤
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.avgNormalDays} 天</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              總遲到次數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{summary.totalLateDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              總加班時數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalOvertimeHours} hr</p>
          </CardContent>
        </Card>
      </div>

      {/* 員工列表 */}
      <Card>
        <CardHeader>
          <CardTitle>員工出勤明細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">員工編號</th>
                  <th className="text-left py-3 px-2">姓名</th>
                  <th className="text-left py-3 px-2">部門</th>
                  <th className="text-center py-3 px-2">正常</th>
                  <th className="text-center py-3 px-2">遲到</th>
                  <th className="text-center py-3 px-2">早退</th>
                  <th className="text-center py-3 px-2">缺勤</th>
                  <th className="text-center py-3 px-2">加班(hr)</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr key={row.employeeId} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">{row.employeeNo}</td>
                    <td className="py-3 px-2 font-medium">{row.employeeName}</td>
                    <td className="py-3 px-2">{row.department}</td>
                    <td className="py-3 px-2 text-center">{row.normalDays}</td>
                    <td className="py-3 px-2 text-center text-orange-600">{row.lateDays || '-'}</td>
                    <td className="py-3 px-2 text-center text-yellow-600">{row.earlyLeaveDays || '-'}</td>
                    <td className="py-3 px-2 text-center text-red-600">{row.absentDays || '-'}</td>
                    <td className="py-3 px-2 text-center">{row.overtimeHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
