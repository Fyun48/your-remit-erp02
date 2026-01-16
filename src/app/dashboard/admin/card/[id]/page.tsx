import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CardRequestDetail } from './card-request-detail'

export default async function CardRequestDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const request = await prisma.businessCardRequest.findUnique({
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
    },
  })

  if (!request) {
    notFound()
  }

  return (
    <CardRequestDetail
      request={{
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        approvedAt: request.approvedAt?.toISOString() || null,
        printedAt: request.printedAt?.toISOString() || null,
      }}
      currentUserId={session.user.id}
    />
  )
}
