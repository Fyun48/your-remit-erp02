import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { HRDashboard } from './hr-dashboard'

export default async function HRPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // 取得當前選擇的公司（集團管理員可切換）
  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">人事管理</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  // 取得統計資料
  const [totalActive, totalDepartments, totalPositions, recentHires] = await Promise.all([
    prisma.employeeAssignment.count({
      where: { companyId: currentCompany.id, status: 'ACTIVE' },
    }),
    prisma.department.count({
      where: { companyId: currentCompany.id, isActive: true },
    }),
    prisma.position.count({
      where: { companyId: currentCompany.id, isActive: true },
    }),
    prisma.employee.count({
      where: {
        assignments: { some: { companyId: currentCompany.id } },
        hireDate: { gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) },
      },
    }),
  ])

  return (
    <HRDashboard
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      stats={{
        totalActive,
        totalDepartments,
        totalPositions,
        recentHires,
      }}
    />
  )
}
