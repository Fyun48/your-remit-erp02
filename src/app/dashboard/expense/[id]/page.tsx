import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ExpenseDetail } from './expense-detail'

interface ExpenseDetailPageProps {
  params: { id: string }
}

export default async function ExpenseDetailPage({ params }: ExpenseDetailPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const expenseRequest = await prisma.expenseRequest.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { date: 'asc' },
      },
    },
  })

  if (!expenseRequest) {
    notFound()
  }

  // Fetch employee and company separately since relations are not defined
  const [employee, company] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: expenseRequest.employeeId },
      select: { id: true, name: true, employeeNo: true },
    }),
    prisma.company.findUnique({
      where: { id: expenseRequest.companyId },
      select: { id: true, name: true },
    }),
  ])

  if (!employee || !company) {
    notFound()
  }

  // Combine the data
  const expense = {
    ...expenseRequest,
    employee,
    company,
  }

  return (
    <ExpenseDetail
      expense={expense}
      currentUserId={session.user.id}
    />
  )
}
