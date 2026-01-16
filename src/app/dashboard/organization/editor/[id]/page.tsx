import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OrgChartEditorPage } from './editor-page'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrgChartEditorRoute({ params }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  const chart = await prisma.orgChart.findUnique({
    where: { id },
    include: {
      group: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      nodes: true,
      relations: true,
    },
  })

  if (!chart) notFound()

  return (
    <OrgChartEditorPage
      chart={{
        id: chart.id,
        name: chart.name,
        type: chart.type,
        groupId: chart.groupId,
        companyId: chart.companyId,
      }}
      initialNodes={chart.nodes.map((node) => ({
        id: node.id,
        nodeType: node.nodeType,
        referenceId: node.referenceId || undefined,
        label: node.label || undefined,
        posX: node.posX,
        posY: node.posY,
      }))}
      initialEdges={chart.relations.map((rel) => ({
        id: rel.id,
        fromNodeId: rel.fromNodeId,
        toNodeId: rel.toNodeId,
        relationType: rel.relationType,
        includeInApproval: rel.includeInApproval,
      }))}
    />
  )
}
