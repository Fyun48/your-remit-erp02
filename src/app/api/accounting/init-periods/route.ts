import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const formData = await request.formData()
  const companyId = formData.get('companyId') as string
  const yearStr = formData.get('year') as string
  const year = parseInt(yearStr, 10)

  if (!companyId || !year) {
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
  }

  // 檢查是否已有該年度期間
  const existing = await prisma.accountingPeriod.findFirst({
    where: { companyId, year },
  })

  if (existing) {
    return NextResponse.redirect(new URL('/dashboard/finance/accounting/periods?error=already-exists', request.url))
  }

  // 建立 12 個月的期間
  const periods = []
  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // 該月最後一天
    endDate.setHours(23, 59, 59, 999)

    periods.push({
      companyId,
      year,
      period: month,
      startDate,
      endDate,
      status: 'OPEN' as const,
    })
  }

  await prisma.accountingPeriod.createMany({ data: periods })

  return NextResponse.redirect(new URL('/dashboard/finance/accounting/periods', request.url))
}
