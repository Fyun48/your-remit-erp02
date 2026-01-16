import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { StationeryStatistics } from './stationery-statistics'

export default async function StationeryStatisticsPage() {
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
    <StationeryStatistics
      companyId={assignment.companyId}
      companyName={assignment.company.name}
    />
  )
}
