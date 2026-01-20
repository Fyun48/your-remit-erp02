import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hasPermission as checkUserPermission } from '@/lib/permission'
import { VoucherDetail } from './voucher-detail'

interface VoucherDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function VoucherDetailPage({ params }: VoucherDetailPageProps) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const voucher = await prisma.voucher.findUnique({
    where: { id },
    include: {
      company: true,
      period: true,
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      postedBy: { select: { id: true, name: true } },
      lines: {
        include: {
          account: true,
          customer: true,
          vendor: true,
          department: true,
        },
        orderBy: { lineNo: 'asc' },
      },
    },
  })

  if (!voucher) {
    notFound()
  }

  // 檢查是否有傳票管理權限
  const hasPermission = await checkUserPermission(
    session.user.id,
    voucher.companyId,
    'finance.voucher'
  )

  // 取得會計科目（用於編輯）
  const accounts = await prisma.accountChart.findMany({
    where: { companyId: voucher.companyId, isActive: true, isDetail: true },
    orderBy: { code: 'asc' },
  })

  return (
    <VoucherDetail
      voucher={voucher}
      accounts={accounts}
      employeeId={session.user.id}
      hasPermission={hasPermission}
    />
  )
}
