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

  const expense = await prisma.expenseRequest.findUnique({
    where: { id: params.id },
    include: {
      employee: { select: { id: true, name: true, employeeNo: true } },
      company: { select: { id: true, name: true } },
      items: {
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { expenseDate: 'asc' },
      },
    },
  })

  if (!expense) {
    notFound()
  }

  return (
    <ExpenseDetail
      expense={expense}
      currentUserId={session.user.id}
    />
  )
}
