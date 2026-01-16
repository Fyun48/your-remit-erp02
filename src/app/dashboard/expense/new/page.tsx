import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { ExpenseForm } from './expense-form'

export default async function NewExpensePage() {
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
        <h1 className="text-2xl font-bold">新增費用報銷</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">尚未指派任職公司</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 檢查是否可選擇公司 (集團管理員或多公司任職)
  const [groupPermission, allAssignments] = await Promise.all([
    prisma.groupPermission.findFirst({
      where: {
        employeeId,
        permissionType: 'GROUP_ADMIN',
      },
    }),
    prisma.employeeAssignment.findMany({
      where: {
        employeeId,
        status: 'ACTIVE',
      },
      select: { companyId: true },
    }),
  ])

  const uniqueCompanyIds = [...new Set(allAssignments.map(a => a.companyId))]
  const canSelectCompany = !!groupPermission || uniqueCompanyIds.length > 1

  return (
    <ExpenseForm
      employeeId={employeeId}
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      canSelectCompany={canSelectCompany}
    />
  )
}
