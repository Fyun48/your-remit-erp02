import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { NotificationSettings } from './notification-settings'

export default async function NotificationSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // 檢查是否為超級管理員
  const [hasSuperAdminPermission, hasSuperAdminRole] = await Promise.all([
    prisma.groupPermission.findFirst({
      where: { employeeId: session.user.id, permission: 'SUPER_ADMIN' },
    }).then((r) => !!r),
    prisma.employeeAssignment.findFirst({
      where: {
        employeeId: session.user.id,
        status: 'ACTIVE',
        role: { name: 'SUPER_ADMIN' },
      },
    }).then((r) => !!r),
  ])

  if (!hasSuperAdminPermission && !hasSuperAdminRole) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">通知設定</h1>
        <p className="text-muted-foreground mt-2">您沒有權限存取此頁面</p>
      </div>
    )
  }

  // 取得所有員工列表供選擇
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      employeeNo: true,
    },
    orderBy: { name: 'asc' },
  })

  // 取得目前設定
  const ccSetting = await prisma.systemSetting.findUnique({
    where: { key: 'FLOW_CC_EMPLOYEE_ID' },
  })

  return (
    <NotificationSettings
      employees={employees}
      currentCCEmployeeId={ccSetting?.value || null}
    />
  )
}
