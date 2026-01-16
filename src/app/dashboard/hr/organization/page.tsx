import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OrganizationChart } from './organization-chart'

export default async function OrganizationPage() {
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

  // 取得部門結構
  const departments = await prisma.department.findMany({
    where: { companyId: assignment.companyId, isActive: true },
    include: {
      parent: { select: { id: true, name: true, code: true } },
      _count: {
        select: {
          employees: { where: { status: 'ACTIVE' } },
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  })

  // 取得部門主管
  const departmentHeads = await prisma.employeeAssignment.findMany({
    where: {
      companyId: assignment.companyId,
      status: 'ACTIVE',
      position: { level: { gte: 5 } }, // 主管級以上
    },
    include: {
      employee: { select: { id: true, name: true, employeeNo: true } },
      department: { select: { id: true } },
      position: { select: { name: true, level: true } },
    },
    orderBy: { position: { level: 'desc' } },
  })

  return (
    <OrganizationChart
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      departments={departments}
      departmentHeads={departmentHeads}
    />
  )
}
