import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SealStatistics } from './seal-statistics'

export default async function SealStatisticsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE', isPrimary: true },
        include: { company: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  const assignment = employee.assignments[0]

  return (
    <SealStatistics
      companyId={assignment.companyId}
      companyName={assignment.company.name}
    />
  )
}
