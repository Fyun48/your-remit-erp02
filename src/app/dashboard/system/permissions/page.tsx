import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { isGroupAdmin } from '@/lib/group-permission'
import { isCompanyManager } from '@/lib/permission'
import { PermissionList } from './permission-list'

export default async function PermissionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // 取得當前工作公司
  const currentCompany = await getCurrentCompany(userId)
  if (!currentCompany) redirect('/dashboard')

  // 檢查是否有權限管理權
  const groupAdmin = await isGroupAdmin(userId)
  const companyManager = await isCompanyManager(userId, currentCompany.id)
  const canManage = groupAdmin || companyManager

  return (
    <PermissionList
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      userId={userId}
      canManage={canManage}
    />
  )
}
