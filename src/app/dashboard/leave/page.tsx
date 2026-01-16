import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Eye } from 'lucide-react'
import { LeaveForm } from '@/components/leave/leave-form'
import { LeaveBalanceCard } from '@/components/leave/leave-balance-card'

export default async function LeavePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id

  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: { company: true },
  })

  if (!assignment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">請假管理</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">尚未指派任職公司</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const companyId = assignment.companyId

  // 取得今年請假紀錄
  const year = new Date().getFullYear()
  const requests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      companyId,
      startDate: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31),
      },
    },
    include: { leaveType: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const statusConfig: Record<string, { label: string; className: string }> = {
    DRAFT: { label: '草稿', className: 'bg-gray-100 text-gray-800' },
    PENDING: { label: '審核中', className: 'bg-yellow-100 text-yellow-800' },
    APPROVED: { label: '已核准', className: 'bg-green-100 text-green-800' },
    REJECTED: { label: '已拒絕', className: 'bg-red-100 text-red-800' },
    CANCELLED: { label: '已取消', className: 'bg-gray-100 text-gray-500' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">請假管理</h1>
        <p className="text-sm text-muted-foreground">{assignment.company.name}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <LeaveForm employeeId={employeeId} companyId={companyId} />
        <LeaveBalanceCard employeeId={employeeId} companyId={companyId} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            我的請假紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">尚無請假紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">單號</th>
                    <th className="text-left py-3 px-2 font-medium">假別</th>
                    <th className="text-left py-3 px-2 font-medium">期間</th>
                    <th className="text-left py-3 px-2 font-medium">時數</th>
                    <th className="text-left py-3 px-2 font-medium">狀態</th>
                    <th className="text-left py-3 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const config = statusConfig[req.status] || statusConfig.DRAFT
                    return (
                      <tr key={req.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-mono text-sm">{req.requestNo}</td>
                        <td className="py-3 px-2">{req.leaveType.name}</td>
                        <td className="py-3 px-2">
                          {new Date(req.startDate).toLocaleDateString('zh-TW')}
                          {req.startDate.getTime() !== req.endDate.getTime() && (
                            <> ~ {new Date(req.endDate).toLocaleDateString('zh-TW')}</>
                          )}
                        </td>
                        <td className="py-3 px-2">{req.totalHours / 8} 天</td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                            {config.label}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <Link href={`/dashboard/leave/${req.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
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
