import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DepartmentList } from './department-list'

export default async function DepartmentsPage() {
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

  return (
    <DepartmentList
      companyId={assignment.companyId}
      companyName={assignment.company.name}
    />
  )
}
