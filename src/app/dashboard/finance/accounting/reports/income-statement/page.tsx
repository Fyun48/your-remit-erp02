import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { IncomeStatementReport } from './income-statement-report'

interface PageProps {
  searchParams: Promise<{ companyId?: string }>
}

export default async function IncomeStatementPage({ searchParams }: PageProps) {
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

  const params = await searchParams
  const primaryAssignment = employee.assignments.find(a => a.isPrimary) || employee.assignments[0]

  // 優先使用 URL 參數中的公司 ID，否則使用主要任務的公司
  const initialCompanyId = params.companyId || primaryAssignment.companyId

  // 準備公司列表給前端選擇
  const assignments = employee.assignments.map(a => ({
    companyId: a.companyId,
    company: {
      id: a.company.id,
      name: a.company.name,
    },
  }))

  return (
    <IncomeStatementReport
      assignments={assignments}
      initialCompanyId={initialCompanyId}
    />
  )
}
