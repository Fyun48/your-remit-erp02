import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { WorkflowEditorPage } from './editor-page'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WorkflowEditorRoute({ params }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  const definition = await prisma.workflowDefinition.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true } },
      nodes: true,
      edges: true,
    },
  })

  if (!definition) notFound()

  return (
    <WorkflowEditorPage
      definition={{
        id: definition.id,
        name: definition.name,
        scopeType: definition.scopeType,
        companyId: definition.companyId,
        groupId: definition.groupId,
        employeeId: definition.employeeId,
        requestType: definition.requestType,
      }}
      initialNodes={definition.nodes}
      initialEdges={definition.edges}
    />
  )
}
