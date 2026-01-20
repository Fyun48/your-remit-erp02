import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PeriodDetail from './period-detail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PeriodDetailPage({ params }: Props) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const { id } = await params

  // 驗證期間是否存在
  const period = await prisma.payrollPeriod.findUnique({
    where: { id },
    include: {
      company: true,
    },
  })

  if (!period) {
    notFound()
  }

  return (
    <PeriodDetail
      periodId={id}
      companyName={period.company.name}
      year={period.year}
      month={period.month}
    />
  )
}
