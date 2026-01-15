import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
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

  // 取得所有集團權限
  const permissions = await prisma.groupPermission.findMany({
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeNo: true,
          email: true,
          assignments: {
            where: { isPrimary: true, status: 'ACTIVE' },
            include: {
              company: { select: { name: true } },
              position: { select: { name: true } },
            },
            take: 1,
          },
        },
      },
      grantedBy: {
        select: { id: true, name: true, employeeNo: true },
      },
    },
    orderBy: [{ permission: 'asc' }, { grantedAt: 'desc' }],
  })

  return <PermissionList userId={userId} permissions={permissions} />
}
