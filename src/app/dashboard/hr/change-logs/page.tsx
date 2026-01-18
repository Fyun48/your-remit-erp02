import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasGroupPermission } from '@/lib/group-permission'
import { ChangeLogList } from './change-log-list'

export default async function ChangeLogsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // 檢查是否為集團管理員或超級管理員
  const isGroupAdmin = await hasGroupPermission(session.user.id, 'GROUP_ADMIN')
  const isSuperAdmin = await hasGroupPermission(session.user.id, 'SUPER_ADMIN')

  if (!isGroupAdmin && !isSuperAdmin) {
    redirect('/dashboard')
  }

  // 檢查是否有刪除權限
  const canDelete = isSuperAdmin || await hasGroupPermission(session.user.id, 'DELETE_CHANGE_LOG')

  return (
    <ChangeLogList userId={session.user.id} canDelete={canDelete} />
  )
}
