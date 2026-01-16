import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { WorkflowList } from './workflow-list'

export default async function WorkflowPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">流程管理</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  const workflows = await prisma.workflowDefinition.findMany({
    where: {
      OR: [
        { companyId: currentCompany.id },
        { groupId: currentCompany.groupId },
      ],
    },
    include: {
      company: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true, employeeNo: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { nodes: true, instances: true } },
    },
    orderBy: [{ scopeType: 'asc' }, { updatedAt: 'desc' }],
  })

  return (
    <WorkflowList
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      userId={session.user.id}
      workflows={workflows}
    />
  )
}
