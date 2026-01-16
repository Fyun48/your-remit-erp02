import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SealRequestDetail } from './seal-request-detail'

export default async function SealRequestDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const request = await prisma.sealRequest.findUnique({
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
      processedBy: { select: { id: true, name: true } },
    },
  })

  if (!request) {
    notFound()
  }

  return (
    <SealRequestDetail
      request={{
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        expectedReturn: request.expectedReturn?.toISOString() || null,
        actualReturn: request.actualReturn?.toISOString() || null,
        processedAt: request.processedAt?.toISOString() || null,
        completedAt: request.completedAt?.toISOString() || null,
      }}
      currentUserId={session.user.id}
    />
  )
}
