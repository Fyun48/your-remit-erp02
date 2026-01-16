import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isGroupAdmin } from '@/lib/group-permission'
import { getCurrentCompany } from '@/lib/use-current-company'
import { OnboardForm } from './onboard-form'

export default async function OnboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // 檢查是否為集團管理員
  const hasAdminPermission = await isGroupAdmin(userId)

  // 取得當前工作公司（集團管理員可能選擇了不同公司）
  const currentCompany = await getCurrentCompany(userId)
  if (!currentCompany) redirect('/dashboard/hr')

  // 如果是集團管理員，載入所有公司；否則只載入當前公司
  let companies: { id: string; name: string; code: string }[] = []
  if (hasAdminPermission) {
    companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    })
  }

  const [departments, positions, roles, supervisors] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: currentCompany.id, isActive: true },
      orderBy: { code: 'asc' },
    }),
    prisma.position.findMany({
      where: { companyId: currentCompany.id, isActive: true },
      orderBy: { level: 'desc' },
    }),
    prisma.role.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.employeeAssignment.findMany({
      where: { companyId: currentCompany.id, status: 'ACTIVE' },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        position: { select: { name: true, level: true } },
      },
      orderBy: { position: { level: 'desc' } },
    }),
  ])

  // 取得下一個員工編號
  const lastEmployee = await prisma.employee.findFirst({
    orderBy: { employeeNo: 'desc' },
    select: { employeeNo: true },
  })

  let nextEmployeeNo = 'EMP001'
  if (lastEmployee) {
    const match = lastEmployee.employeeNo.match(/^EMP(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10) + 1
      nextEmployeeNo = `EMP${String(num).padStart(3, '0')}`
    }
  }

  return (
    <OnboardForm
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      departments={departments}
      positions={positions}
      roles={roles}
      supervisors={supervisors}
      suggestedEmployeeNo={nextEmployeeNo}
      isGroupAdmin={hasAdminPermission}
      allCompanies={companies}
    />
  )
}
