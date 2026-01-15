import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canViewAuditLog } from '@/lib/group-permission'
import { AuditLogList } from './audit-log-list'

export default async function AuditLogsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // 檢查權限
  const hasPermission = await canViewAuditLog(userId)
  if (!hasPermission) {
    redirect('/dashboard/system')
  }

  return <AuditLogList userId={userId} />
}
