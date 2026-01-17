import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ApprovalFlowsList } from './approval-flows-list'

export default async function ApprovalFlowsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得所有審核流程
  const flows = await prisma.approvalFlow.findMany({
    where: { isActive: true },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
      company: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }],
  })

  // 取得所有公司供選擇
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <ApprovalFlowsList flows={flows} companies={companies} />
}
