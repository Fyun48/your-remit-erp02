import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canManageCompany, canViewCrossCompany } from '@/lib/group-permission'
import { CompanyList } from './company-list'

export default async function CompaniesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // 檢查權限
  const [hasManagePermission, hasViewPermission] = await Promise.all([
    canManageCompany(userId),
    canViewCrossCompany(userId),
  ])

  if (!hasManagePermission && !hasViewPermission) {
    redirect('/dashboard/system')
  }

  // 取得所有公司資料
  const [groups, companies] = await Promise.all([
    prisma.group.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.company.findMany({
      include: {
        group: true,
        _count: {
          select: {
            departments: { where: { isActive: true } },
            positions: { where: { isActive: true } },
            employees: { where: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
    }),
  ])

  return (
    <CompanyList
      userId={userId}
      groups={groups}
      companies={companies}
      canManage={hasManagePermission}
    />
  )
}
