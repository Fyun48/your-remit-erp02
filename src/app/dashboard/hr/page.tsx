import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { HRDashboard } from './hr-dashboard'

export default async function HRPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // 取得員工的主要任職公司
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: { company: true },
  })

  if (!assignment) {
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
      where: { companyId: assignment.companyId, status: 'ACTIVE' },
    }),
    prisma.department.count({
      where: { companyId: assignment.companyId, isActive: true },
    }),
    prisma.position.count({
      where: { companyId: assignment.companyId, isActive: true },
    }),
    prisma.employee.count({
      where: {
        assignments: { some: { companyId: assignment.companyId } },
        hireDate: { gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) },
      },
    }),
  ])

  return (
    <HRDashboard
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      stats={{
        totalActive,
        totalDepartments,
        totalPositions,
        recentHires,
      }}
    />
  )
}
