import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { OrgChartList } from './org-chart-list'

export default async function OrganizationPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">組織圖管理</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  const orgCharts = await prisma.orgChart.findMany({
    where: {
      OR: [
        { companyId: currentCompany.id },
        { type: 'GROUP' },
      ],
      isActive: true,
    },
    include: {
      group: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      _count: { select: { nodes: true, relations: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <OrgChartList
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      orgCharts={orgCharts}
    />
  )
}
