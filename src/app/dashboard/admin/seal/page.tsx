import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SealRequestList } from './seal-request-list'

export default async function SealPage() {
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

  if (!assignment) {
    redirect('/dashboard')
  }

  return (
    <SealRequestList
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      currentUserId={session.user.id}
    />
  )
}
