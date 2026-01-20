import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { DelegationForm } from './delegation-form'

export default async function NewDelegationPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">新增職務代理</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  // 取得公司內所有在職員工（排除自己）
  const employees = await prisma.employee.findMany({
    where: {
      id: { not: session.user.id },
      assignments: {
        some: {
          companyId: currentCompany.id,
          status: 'ACTIVE',
        },
      },
    },
    select: {
      id: true,
      name: true,
      employeeNo: true,
      assignments: {
        where: {
          companyId: currentCompany.id,
          status: 'ACTIVE',
        },
        include: {
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  // 格式化員工資料
  const formattedEmployees = employees.map((e) => ({
    id: e.id,
    name: e.name,
    employeeNo: e.employeeNo,
    department: e.assignments[0]?.department?.name || '',
    position: e.assignments[0]?.position?.name || '',
  }))

  return (
    <DelegationForm
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      currentUserId={session.user.id}
      employees={formattedEmployees}
    />
  )
}
