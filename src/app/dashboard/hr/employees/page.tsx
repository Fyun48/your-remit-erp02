import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { EmployeeList } from './employee-list'

interface PageProps {
  searchParams: Promise<{ showResigned?: string }>
}

export default async function HREmployeesPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // 取得當前工作公司（集團管理員可能選擇了不同公司）
  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) redirect('/dashboard/hr')

  const params = await searchParams
  const showResigned = params.showResigned === 'true'

  // 根據是否顯示離職員工決定查詢條件
  const statusFilter = showResigned
    ? undefined // 顯示全部狀態
    : { in: ['ACTIVE' as const, 'ON_LEAVE' as const] } // 只顯示在職和留停

  const [employees, departments, positions] = await Promise.all([
    prisma.employeeAssignment.findMany({
      where: {
        companyId: currentCompany.id,
        ...(statusFilter && { status: statusFilter }),
      },
      include: {
        employee: {
          include: {
            // 包含該員工的所有任職紀錄（用於顯示兼任）
            assignments: {
              where: { status: 'ACTIVE', isPrimary: false },
              include: {
                company: { select: { id: true, name: true } },
                department: { select: { name: true } },
                position: { select: { name: true } },
              },
            },
          },
        },
        department: true,
        position: true,
        supervisor: {
          include: {
            employee: { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { employeeNo: 'asc' } },
    }),
    prisma.department.findMany({
      where: { companyId: currentCompany.id, isActive: true },
      orderBy: { code: 'asc' },
    }),
    prisma.position.findMany({
      where: { companyId: currentCompany.id, isActive: true },
      orderBy: { level: 'desc' },
    }),
  ])

  return (
    <EmployeeList
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      employees={employees}
      departments={departments}
      positions={positions}
      showResigned={showResigned}
    />
  )
}
