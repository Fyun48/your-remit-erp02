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
  const [hasGroupAdmin, hasCompanyMgmt, hasAuditView] = await Promise.all([
    isGroupAdmin(userId),
    canManageCompany(userId),
    canViewAuditLog(userId),
  ])

  const hasAnyPermission = hasGroupAdmin || hasCompanyMgmt || hasAuditView

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
    hasAuditView
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
        isGroupAdmin: hasGroupAdmin,
        canManageCompany: hasCompanyMgmt,
        canViewAuditLog: hasAuditView,
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
