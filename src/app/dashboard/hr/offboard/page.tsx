import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OffboardPage } from './offboard-page'

export default async function HROffboardPage() {
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
    <OffboardPage
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      currentUserId={session.user.id}
    />
  )
}
