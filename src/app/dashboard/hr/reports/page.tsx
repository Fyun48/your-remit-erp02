import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { HRReports } from './hr-reports'

export default async function HRReportsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: { company: true },
  })

  if (!assignment) redirect('/dashboard/hr')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  // 取得各項統計資料
  const [
    totalActive,
    totalOnLeave,
    totalResigned,
    newHiresThisMonth,
    newHiresThisYear,
    resignedThisMonth,
    resignedThisYear,
    byDepartment,
    byPosition,
    byGender,
    recentHires,
    recentResigns,
  ] = await Promise.all([
    // 在職人數
    prisma.employeeAssignment.count({
      where: { companyId: assignment.companyId, status: 'ACTIVE' },
    }),
    // 留停人數
    prisma.employeeAssignment.count({
      where: { companyId: assignment.companyId, status: 'ON_LEAVE' },
    }),
    // 離職人數
    prisma.employeeAssignment.count({
      where: { companyId: assignment.companyId, status: 'RESIGNED' },
    }),
    // 本月新進
    prisma.employee.count({
      where: {
        assignments: { some: { companyId: assignment.companyId } },
        hireDate: { gte: startOfMonth },
      },
    }),
    // 本年新進
    prisma.employee.count({
      where: {
        assignments: { some: { companyId: assignment.companyId } },
        hireDate: { gte: startOfYear },
      },
    }),
    // 本月離職
    prisma.employee.count({
      where: {
        assignments: { some: { companyId: assignment.companyId } },
        resignDate: { gte: startOfMonth },
      },
    }),
    // 本年離職
    prisma.employee.count({
      where: {
        assignments: { some: { companyId: assignment.companyId } },
        resignDate: { gte: startOfYear },
      },
    }),
    // 各部門人數
    prisma.employeeAssignment.groupBy({
      by: ['departmentId'],
      where: { companyId: assignment.companyId, status: 'ACTIVE' },
      _count: true,
    }),
    // 各職位人數
    prisma.employeeAssignment.groupBy({
      by: ['positionId'],
      where: { companyId: assignment.companyId, status: 'ACTIVE' },
      _count: true,
    }),
    // 性別統計
    prisma.employee.groupBy({
      by: ['gender'],
      where: {
        assignments: { some: { companyId: assignment.companyId, status: 'ACTIVE' } },
      },
      _count: true,
    }),
    // 最近新進員工
    prisma.employee.findMany({
      where: {
        assignments: { some: { companyId: assignment.companyId } },
      },
      orderBy: { hireDate: 'desc' },
      take: 10,
      select: {
        id: true,
        employeeNo: true,
        name: true,
        hireDate: true,
        assignments: {
          where: { companyId: assignment.companyId, isPrimary: true },
          include: {
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
          take: 1,
        },
      },
    }),
    // 最近離職員工
    prisma.employee.findMany({
      where: {
        assignments: { some: { companyId: assignment.companyId } },
        resignDate: { not: null },
      },
      orderBy: { resignDate: 'desc' },
      take: 10,
      select: {
        id: true,
        employeeNo: true,
        name: true,
        resignDate: true,
        assignments: {
          where: { companyId: assignment.companyId },
          include: {
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
          take: 1,
        },
      },
    }),
  ])

  // 取得部門和職位名稱
  const [departments, positions] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: assignment.companyId },
      select: { id: true, name: true, code: true },
    }),
    prisma.position.findMany({
      where: { companyId: assignment.companyId },
      select: { id: true, name: true },
    }),
  ])

  // 組裝部門統計資料
  const departmentStats = byDepartment.map((item) => {
    const dept = departments.find((d) => d.id === item.departmentId)
    return {
      name: dept?.name || '未知',
      code: dept?.code || '',
      count: item._count,
    }
  }).sort((a, b) => b.count - a.count)

  // 組裝職位統計資料
  const positionStats = byPosition.map((item) => {
    const pos = positions.find((p) => p.id === item.positionId)
    return {
      name: pos?.name || '未知',
      count: item._count,
    }
  }).sort((a, b) => b.count - a.count)

  // 組裝性別統計資料
  const genderStats = byGender.map((item) => ({
    gender: item.gender,
    count: item._count,
  }))

  return (
    <HRReports
      companyName={assignment.company.name}
      stats={{
        totalActive,
        totalOnLeave,
        totalResigned,
        newHiresThisMonth,
        newHiresThisYear,
        resignedThisMonth,
        resignedThisYear,
      }}
      departmentStats={departmentStats}
      positionStats={positionStats}
      genderStats={genderStats}
      recentHires={recentHires}
      recentResigns={recentResigns}
    />
  )
}
