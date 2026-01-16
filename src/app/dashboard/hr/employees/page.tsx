import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmployeeList } from './employee-list'

export default async function HREmployeesPage() {
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

  const [employees, departments, positions] = await Promise.all([
    prisma.employeeAssignment.findMany({
      where: { companyId: assignment.companyId },
      include: {
        employee: true,
        department: true,
        position: true,
        supervisor: {
          include: {
            employee: { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { employeeNo: 'asc' } },
    }),
    prisma.department.findMany({
      where: { companyId: assignment.companyId, isActive: true },
      orderBy: { code: 'asc' },
    }),
    prisma.position.findMany({
      where: { companyId: assignment.companyId, isActive: true },
      orderBy: { level: 'desc' },
    }),
  ])

  return (
    <EmployeeList
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      employees={employees}
      departments={departments}
      positions={positions}
    />
  )
}
