import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SystemDashboard } from './system-dashboard'
import { isGroupAdmin, canManageCompany, canViewAuditLog } from '@/lib/group-permission'

export default async function SystemPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // 檢查是否有任何系統管理權限
  // 同時檢查 GroupPermission 和 Role（系統角色）
  const [hasGroupAdmin, hasCompanyMgmt, hasAuditView, hasSuperAdminPermission, hasSuperAdminRole] = await Promise.all([
    isGroupAdmin(userId),
    canManageCompany(userId),
    canViewAuditLog(userId),
    // 檢查 GroupPermission 表的 SUPER_ADMIN
    prisma.groupPermission.findFirst({
      where: { employeeId: userId, permission: 'SUPER_ADMIN' },
    }).then((r) => !!r),
    // 檢查系統角色是否為 SUPER_ADMIN（集團最高管理員）
    prisma.employeeAssignment.findFirst({
      where: {
        employeeId: userId,
        status: 'ACTIVE',
        role: { name: 'SUPER_ADMIN' },
      },
    }).then((r) => !!r),
  ])

  const isSuperAdmin = hasSuperAdminPermission || hasSuperAdminRole

  const hasAnyPermission = hasGroupAdmin || hasCompanyMgmt || hasAuditView || isSuperAdmin

  if (!hasAnyPermission) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">系統管理</h1>
        <p className="text-muted-foreground mt-2">您沒有系統管理權限</p>
      </div>
    )
  }

  // 取得統計資料
  const [totalGroups, totalCompanies, totalEmployees, recentAuditLogs] = await Promise.all([
    prisma.group.count({ where: { isActive: true } }),
    prisma.company.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { isActive: true } }),
    hasAuditView || isSuperAdmin
      ? prisma.auditLog.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        })
      : 0,
  ])

  return (
    <SystemDashboard
      userId={userId}
      permissions={{
        isGroupAdmin: hasGroupAdmin || isSuperAdmin, // SUPER_ADMIN 擁有所有權限
        canManageCompany: hasCompanyMgmt || isSuperAdmin,
        canViewAuditLog: hasAuditView || isSuperAdmin,
        isSuperAdmin,
      }}
      stats={{
        totalGroups,
        totalCompanies,
        totalEmployees,
        recentAuditLogs,
      }}
    />
  )
}
