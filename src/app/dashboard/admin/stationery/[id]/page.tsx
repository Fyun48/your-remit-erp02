import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { StationeryRequestDetail } from './stationery-request-detail'

export default async function StationeryRequestDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const request = await prisma.stationeryRequest.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { id: true, name: true } },
      applicant: {
        select: {
          id: true,
          name: true,
          employeeNo: true,
          email: true,
        },
      },
      approvedBy: { select: { id: true, name: true } },
      issuedBy: { select: { id: true, name: true } },
    },
  })

  if (!request) {
    notFound()
  }

  return (
    <StationeryRequestDetail
      request={{
        ...request,
        totalAmount: request.totalAmount.toNumber(),
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        approvedAt: request.approvedAt?.toISOString() || null,
        issuedAt: request.issuedAt?.toISOString() || null,
      }}
      currentUserId={session.user.id}
    />
  )
}
