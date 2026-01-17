import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ApprovalFlowsList } from './approval-flows-list'

export default async function ApprovalFlowsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 並行查詢所有需要的資料
  const [flows, companies, groups, leaveTypes] = await Promise.all([
    // 取得所有審核流程（包含啟用和停用）
    prisma.approvalFlow.findMany({
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
        company: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    // 取得所有公司供選擇
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    // 取得集團資訊
    prisma.group.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // 取得所有假別（用於條件設定）
    prisma.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ])

  return (
    <ApprovalFlowsList
      flows={flows}
      companies={companies}
      groups={groups}
      leaveTypes={leaveTypes}
    />
  )
}
