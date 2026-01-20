import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { FlowTemplateList } from './flow-template-list'

export default async function FlowTemplatesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">審核流程設定</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  const templates = await prisma.flowTemplate.findMany({
    where: { companyId: currentCompany.id },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: {
          position: { select: { id: true, name: true } },
          specificEmployee: { select: { id: true, name: true, employeeNo: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { moduleType: 'asc' },
  })

  return (
    <FlowTemplateList
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      userId={session.user.id}
      templates={templates}
    />
  )
}
