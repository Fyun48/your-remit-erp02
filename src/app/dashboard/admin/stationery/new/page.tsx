import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { StationeryRequestForm } from './stationery-request-form'

export default async function NewStationeryRequestPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // 取得員工及其所有任職公司
  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: {
          company: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  // 取得各公司的文具品項
  const companyIds = employee.assignments.map((a) => a.company.id)
  const items = await prisma.stationeryItem.findMany({
    where: {
      companyId: { in: companyIds },
      isActive: true,
    },
    orderBy: { code: 'asc' },
  })

  // 整理公司列表
  const companies = employee.assignments.map((a) => ({
    id: a.company.id,
    name: a.company.name,
  }))

  // 依公司分組品項
  const itemsByCompany: Record<string, typeof items> = {}
  for (const item of items) {
    if (!itemsByCompany[item.companyId]) {
      itemsByCompany[item.companyId] = []
    }
    itemsByCompany[item.companyId].push(item)
  }

  return (
    <StationeryRequestForm
      applicantId={session.user.id}
      applicantName={employee.name}
      companies={companies}
      itemsByCompany={Object.fromEntries(
        Object.entries(itemsByCompany).map(([companyId, companyItems]) => [
          companyId,
          companyItems.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toNumber(),
          })),
        ])
      )}
    />
  )
}
