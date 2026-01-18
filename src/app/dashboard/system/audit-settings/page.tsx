import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hasSuperAdminRole } from '@/lib/group-permission'
import { AuditSettingsList } from './audit-settings-list'

export default async function AuditSettingsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 檢查是否為 SUPER_ADMIN（GroupPermission 或 Role）
  const [hasSuperAdminPermission, hasSuperAdminRoleResult] = await Promise.all([
    prisma.groupPermission.findFirst({
      where: { employeeId: session.user.id, permission: 'SUPER_ADMIN' },
    }),
    hasSuperAdminRole(session.user.id),
  ])

  if (!hasSuperAdminPermission && !hasSuperAdminRoleResult) {
    redirect('/dashboard')
  }

  return <AuditSettingsList userId={session.user.id} />
}
