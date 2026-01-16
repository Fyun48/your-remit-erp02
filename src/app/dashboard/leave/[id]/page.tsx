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
      employee: {
        select: { id: true, name: true, employeeNo: true, email: true },
      },
      company: {
        select: { id: true, name: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
      rejectedBy: {
        select: { id: true, name: true },
      },
    },
  })

  if (!leaveRequest) {
    notFound()
  }

  return (
    <LeaveRequestDetail
      request={leaveRequest}
      currentUserId={session.user.id}
    />
  )
}
