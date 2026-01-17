import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmployeeDetail } from './employee-detail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

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
  const employeePrimaryAssignment = employee.assignments.find(
    (a) => a.status === 'ACTIVE' && a.isPrimary
  )

  if (!employeePrimaryAssignment) {
    // 如果沒有主要任職，使用第一個有效任職
    const anyActiveAssignment = employee.assignments.find((a) => a.status === 'ACTIVE')
    if (!anyActiveAssignment) redirect('/dashboard/hr')
  }

  const targetCompanyId = employeePrimaryAssignment?.company.id || employee.assignments[0]?.company.id
  const targetCompanyName = employeePrimaryAssignment?.company.name || employee.assignments[0]?.company.name || '未知公司'

  // 取得部門、職位、主管和角色列表供編輯使用（使用員工所屬公司）
  const [departments, positions, supervisors, roles] = await Promise.all([
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
  ])

  return (
    <EmployeeDetail
      employee={employee}
      companyId={targetCompanyId}
      companyName={targetCompanyName}
      departments={departments}
      positions={positions}
      supervisors={supervisors.filter((s) => s.employee.id !== id)}
      roles={roles}
    />
  )
}
