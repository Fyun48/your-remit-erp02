import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { FlowTemplateForm } from '../flow-template-form'

interface NewFlowTemplatePageProps {
  searchParams: { module?: string }
}

export default async function NewFlowTemplatePage({ searchParams }: NewFlowTemplatePageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">新增審核流程</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  // 取得公司的所有職位
  const positions = await prisma.position.findMany({
    where: {
      companyId: currentCompany.id,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      level: true,
    },
    orderBy: [{ level: 'desc' }, { name: 'asc' }],
  })

  // 取得公司的所有在職員工
  const employees = await prisma.employee.findMany({
    where: {
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

  const formattedEmployees = employees.map((e) => ({
    id: e.id,
    name: e.name,
    employeeNo: e.employeeNo,
    department: e.assignments[0]?.department?.name || '',
    position: e.assignments[0]?.position?.name || '',
  }))

  return (
    <FlowTemplateForm
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      userId={session.user.id}
      positions={positions}
      employees={formattedEmployees}
      defaultModuleType={searchParams.module}
    />
  )
}
