import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PayrollPeriods from './payroll-periods'

export default async function PayrollPeriodsPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  // 取得使用者的主要公司
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      status: 'ACTIVE',
      isPrimary: true,
    },
    include: {
      company: true,
    },
  })

  if (!assignment) {
    redirect('/dashboard')
  }

  return (
    <PayrollPeriods
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      userId={session.user.id}
    />
  )
}
