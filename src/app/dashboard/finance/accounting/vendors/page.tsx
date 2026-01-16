import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { VendorDashboard } from './vendor-list'

export default async function VendorsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: { company: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  const companyId = employee.assignments[0].companyId
  const companyName = employee.assignments[0].company.name

  return <VendorDashboard companyId={companyId} companyName={companyName} />
}
