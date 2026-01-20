import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import EmployeeSalaryList from './employee-salary-list'

export default async function EmployeeSalariesPage() {
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
    <EmployeeSalaryList
      companyId={assignment.companyId}
      companyName={assignment.company.name}
    />
  )
}
