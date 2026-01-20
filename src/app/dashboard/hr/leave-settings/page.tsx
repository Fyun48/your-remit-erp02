import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { hasPermission } from '@/lib/permission'
import { LeaveSettingsPage } from './leave-settings-page'

export default async function LeaveSettings() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) redirect('/dashboard/hr')

  // 檢查權限
  const canManage = await hasPermission(
    session.user.id,
    currentCompany.id,
    'leave.type'
  )
  if (!canManage) {
    redirect('/dashboard/leave')
  }

  return (
    <LeaveSettingsPage
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      userId={session.user.id}
    />
  )
}
