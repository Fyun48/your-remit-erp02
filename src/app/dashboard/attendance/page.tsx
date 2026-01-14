import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClockCard } from '@/components/attendance/clock-card'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Clock, Calendar, CheckCircle, AlertCircle, MinusCircle } from 'lucide-react'

export default async function AttendancePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id

  // 取得員工的主要任職公司
  const primaryAssignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: {
      company: true,
      department: true,
    },
  })

  if (!primaryAssignment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">出勤管理</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">尚未指派任職公司，請聯繫管理員。</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const companyId = primaryAssignment.companyId

  // 取得本月出勤紀錄
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const monthlyRecords = await prisma.attendanceRecord.findMany({
    where: {
      employeeId,
      companyId,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    orderBy: {
      date: 'desc',
    },
  })

  // 計算本月統計
  const stats = {
    total: monthlyRecords.length,
    normal: monthlyRecords.filter(r => r.status === 'NORMAL').length,
    late: monthlyRecords.filter(r => r.status === 'LATE').length,
    earlyLeave: monthlyRecords.filter(r => r.status === 'EARLY_LEAVE').length,
    absent: monthlyRecords.filter(r => r.status === 'ABSENT').length,
  }

  // 狀態顯示配置
  const statusConfig: Record<string, { label: string; className: string }> = {
    PENDING: { label: '待確認', className: 'bg-yellow-100 text-yellow-800' },
    NORMAL: { label: '正常', className: 'bg-green-100 text-green-800' },
    LATE: { label: '遲到', className: 'bg-red-100 text-red-800' },
    EARLY_LEAVE: { label: '早退', className: 'bg-orange-100 text-orange-800' },
    ABSENT: { label: '曠職', className: 'bg-red-200 text-red-900' },
    LEAVE: { label: '請假', className: 'bg-blue-100 text-blue-800' },
    EXEMPT: { label: '免打卡', className: 'bg-gray-100 text-gray-800' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">出勤管理</h1>
        <p className="text-sm text-muted-foreground">
          {primaryAssignment.company.name} - {primaryAssignment.department.name}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 打卡卡片 */}
        <ClockCard employeeId={employeeId} companyId={companyId} />

        {/* 本月出勤統計 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              本月出勤統計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">出勤天數</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-600">正常</p>
                </div>
                <p className="text-3xl font-bold text-green-700">{stats.normal}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-600">遲到</p>
                </div>
                <p className="text-3xl font-bold text-red-700">{stats.late}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-orange-50">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <MinusCircle className="h-4 w-4 text-orange-600" />
                  <p className="text-sm text-orange-600">早退</p>
                </div>
                <p className="text-3xl font-bold text-orange-700">{stats.earlyLeave}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 本月出勤紀錄列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            本月出勤紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyRecords.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">本月尚無出勤紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">日期</th>
                    <th className="text-left py-3 px-2 font-medium">上班時間</th>
                    <th className="text-left py-3 px-2 font-medium">下班時間</th>
                    <th className="text-left py-3 px-2 font-medium">工時</th>
                    <th className="text-left py-3 px-2 font-medium">狀態</th>
                    <th className="text-left py-3 px-2 font-medium">備註</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRecords.map((record) => {
                    const config = statusConfig[record.status] || statusConfig.PENDING

                    return (
                      <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2">
                          {new Date(record.date).toLocaleDateString('zh-TW', {
                            month: 'numeric',
                            day: 'numeric',
                            weekday: 'short',
                          })}
                        </td>
                        <td className="py-3 px-2">
                          {record.clockInTime
                            ? new Date(record.clockInTime).toLocaleTimeString('zh-TW', { hour12: false })
                            : '-'}
                        </td>
                        <td className="py-3 px-2">
                          {record.clockOutTime
                            ? new Date(record.clockOutTime).toLocaleTimeString('zh-TW', { hour12: false })
                            : '-'}
                        </td>
                        <td className="py-3 px-2">
                          {record.workHours ? `${record.workHours.toFixed(1)}h` : '-'}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                            {config.label}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-muted-foreground">
                          {record.lateMinutes > 0 && <span className="text-red-600">遲到{record.lateMinutes}分 </span>}
                          {record.earlyLeaveMinutes > 0 && <span className="text-orange-600">早退{record.earlyLeaveMinutes}分</span>}
                          {record.isAmended && <span className="text-blue-600">(補登)</span>}
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
