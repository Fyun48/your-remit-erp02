import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { LeaveRequestDetail } from './leave-request-detail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LeaveRequestDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { id } = await params

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      leaveType: true,
    },
  })

  if (!leaveRequest) {
    notFound()
  }

  // 分開查詢關聯資料（LeaveRequest 沒有這些 relations）
  const [employee, company, approvedBy, rejectedBy] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: leaveRequest.employeeId },
      select: { id: true, name: true, employeeNo: true, email: true },
    }),
    prisma.company.findUnique({
      where: { id: leaveRequest.companyId },
      select: { id: true, name: true },
    }),
    leaveRequest.approvedById
      ? prisma.employee.findUnique({
          where: { id: leaveRequest.approvedById },
          select: { id: true, name: true },
        })
      : null,
    leaveRequest.rejectedById
      ? prisma.employee.findUnique({
          where: { id: leaveRequest.rejectedById },
          select: { id: true, name: true },
        })
      : null,
  ])

  if (!employee || !company) {
    notFound()
  }

  return (
    <LeaveRequestDetail
      request={{
        ...leaveRequest,
        employee,
        company,
        approvedBy,
        rejectedBy,
      }}
      currentUserId={session.user.id}
    />
  )
}
