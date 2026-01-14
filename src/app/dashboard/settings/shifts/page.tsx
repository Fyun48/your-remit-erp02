import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import { ShiftList } from './shift-list'

export default async function ShiftsPage() {
  // 驗證登入
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得員工的主要任職公司
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  if (!assignment) {
    redirect('/dashboard')
  }

  // 檢查權限（只有 SUPER_ADMIN 和 COMPANY_ADMIN 可以存取）
  const roleName = assignment.role?.name
  const isAdmin = roleName === 'SUPER_ADMIN' || roleName === 'COMPANY_ADMIN'

  if (!isAdmin) {
    redirect('/dashboard')
  }

  // 取得現有班別列表
  const shifts = await prisma.workShift.findMany({
    where: {
      companyId: assignment.companyId,
      isActive: true,
    },
    include: {
      breaks: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">班別管理</h1>
      </div>

      <ShiftList initialShifts={shifts} companyId={assignment.companyId} />

      {/* 班別說明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            班別說明
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>班別設定用於定義員工的工作時間規則，包括：</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>上班時間：員工應到達的時間</li>
            <li>下班時間：員工可離開的時間</li>
            <li>遲到寬限：允許遲到的分鐘數，超過才計為遲到</li>
            <li>早退寬限：允許提早下班的分鐘數，超過才計為早退</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
