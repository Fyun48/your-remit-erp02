import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PositionList } from './position-list'

export default async function PositionsPage() {
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
    <PositionList
      companyId={assignment.companyId}
      companyName={assignment.company.name}
    />
  )
}
