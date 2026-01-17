import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OrgChartViewPage } from './view-page'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrgChartViewRoute({ params }: PageProps) {
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
    <OrgChartViewPage
      chart={{
        id: chart.id,
        name: chart.name,
        description: chart.description,
        type: chart.type,
        groupId: chart.groupId,
        companyId: chart.companyId,
        groupName: chart.group?.name,
        companyName: chart.company?.name,
      }}
      nodes={chart.nodes.map((node) => ({
        id: node.id,
        nodeType: node.nodeType,
        referenceId: node.referenceId || undefined,
        label: node.label || undefined,
        posX: node.posX,
        posY: node.posY,
      }))}
      edges={chart.relations.map((rel) => ({
        id: rel.id,
        fromNodeId: rel.fromNodeId,
        toNodeId: rel.toNodeId,
        relationType: rel.relationType,
        includeInApproval: rel.includeInApproval,
      }))}
    />
  )
}
