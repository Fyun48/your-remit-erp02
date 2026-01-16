import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
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

  return (
    <CompanyList
      userId={userId}
      canManage={hasManagePermission}
    />
  )
}
