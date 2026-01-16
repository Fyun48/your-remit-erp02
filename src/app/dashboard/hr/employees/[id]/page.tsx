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

  // 取得當前用戶的公司 ID
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: { company: true },
  })

  if (!assignment) redirect('/dashboard/hr')

  // 取得部門和職位列表供編輯使用
  const [departments, positions, supervisors] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: assignment.companyId, isActive: true },
      orderBy: { code: 'asc' },
    }),
    prisma.position.findMany({
      where: { companyId: assignment.companyId, isActive: true },
      orderBy: { level: 'desc' },
    }),
    prisma.employeeAssignment.findMany({
      where: { companyId: assignment.companyId, status: 'ACTIVE' },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        position: { select: { name: true, level: true } },
      },
      orderBy: { position: { level: 'desc' } },
    }),
  ])

  return (
    <EmployeeDetail
      employee={employee}
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      departments={departments}
      positions={positions}
      supervisors={supervisors.filter((s) => s.employee.id !== id)}
    />
  )
}
