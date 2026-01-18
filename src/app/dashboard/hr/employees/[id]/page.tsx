import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmployeeDetail } from './employee-detail'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ showResigned?: string }>
}

export default async function EmployeeDetailPage({ params, searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params
  const query = await searchParams
  const showResigned = query.showResigned === 'true'

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          company: true,
          department: true,
          position: true,
          role: true,
          supervisor: {
            include: {
              employee: { select: { id: true, name: true, employeeNo: true } },
            },
          },
        },
        orderBy: { startDate: 'desc' },
      },
    },
  })

  if (!employee) notFound()

  // 取得被查看員工的主要任職公司
  // 優先找 ACTIVE 且 isPrimary，其次找任何 isPrimary，最後用第一個
  const employeePrimaryAssignment = employee.assignments.find(
    (a) => a.status === 'ACTIVE' && a.isPrimary
  ) || employee.assignments.find(
    (a) => a.isPrimary
  ) || employee.assignments[0]

  if (!employeePrimaryAssignment) {
    redirect('/dashboard/hr')
  }

  const targetCompanyId = employeePrimaryAssignment.company.id
  const targetCompanyName = employeePrimaryAssignment.company.name

  // 取得部門、職位、主管和角色列表供編輯使用（使用員工所屬公司）
  const [departments, positions, supervisors, roles, companyEmployees] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: targetCompanyId, isActive: true },
      orderBy: { code: 'asc' },
    }),
    prisma.position.findMany({
      where: { companyId: targetCompanyId, isActive: true },
      orderBy: { level: 'desc' },
    }),
    prisma.employeeAssignment.findMany({
      where: { companyId: targetCompanyId, status: 'ACTIVE' },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        position: { select: { name: true, level: true } },
      },
      orderBy: { position: { level: 'desc' } },
    }),
    prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
      },
    }),
    // 取得同公司的所有員工（用於導航）
    // 根據 showResigned 決定是否包含離職員工
    prisma.employeeAssignment.findMany({
      where: {
        companyId: targetCompanyId,
        isPrimary: true,
        ...(showResigned
          ? {} // 顯示全部狀態
          : { status: { in: ['ACTIVE', 'ON_LEAVE'] } } // 只顯示在職和留停
        ),
      },
      include: {
        employee: {
          select: { id: true, name: true, employeeNo: true },
        },
      },
      orderBy: { employee: { employeeNo: 'asc' } },
    }),
  ])

  // 計算上一位/下一位員工
  const employeeList = companyEmployees.map((a) => ({
    id: a.employee.id,
    name: a.employee.name,
    employeeNo: a.employee.employeeNo,
  }))
  const currentIndex = employeeList.findIndex((e) => e.id === id)
  const prevEmployee = currentIndex > 0 ? employeeList[currentIndex - 1] : null
  const nextEmployee = currentIndex < employeeList.length - 1 ? employeeList[currentIndex + 1] : null

  return (
    <EmployeeDetail
      employee={employee}
      companyId={targetCompanyId}
      companyName={targetCompanyName}
      departments={departments}
      positions={positions}
      supervisors={supervisors.filter((s) => s.employee.id !== id)}
      roles={roles}
      prevEmployee={prevEmployee}
      nextEmployee={nextEmployee}
      currentPosition={currentIndex + 1}
      totalEmployees={employeeList.length}
      showResigned={showResigned}
    />
  )
}
