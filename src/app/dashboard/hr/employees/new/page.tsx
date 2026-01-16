import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OnboardForm } from './onboard-form'

export default async function OnboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: { company: true },
  })

  if (!assignment) redirect('/dashboard/hr')

  const [departments, positions, roles, supervisors] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: assignment.companyId, isActive: true },
      orderBy: { code: 'asc' },
    }),
    prisma.position.findMany({
      where: { companyId: assignment.companyId, isActive: true },
      orderBy: { level: 'desc' },
    }),
    prisma.role.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.employeeAssignment.findMany({
      where: { companyId: assignment.companyId, status: 'ACTIVE' },
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
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      departments={departments}
      positions={positions}
      roles={roles}
      supervisors={supervisors}
      suggestedEmployeeNo={nextEmployeeNo}
    />
  )
}
