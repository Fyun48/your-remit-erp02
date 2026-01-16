import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isGroupAdmin } from '@/lib/group-permission'
import { PermissionList } from './permission-list'

export default async function PermissionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // 只有集團管理員可以管理權限
  const hasPermission = await isGroupAdmin(userId)
  if (!hasPermission) {
    redirect('/dashboard/system')
  }

  return <PermissionList userId={userId} />
}
