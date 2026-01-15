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

  if (!companyId) {
    return NextResponse.json({ error: '缺少公司 ID' }, { status: 400 })
  }

  // 檢查是否已有科目
  const existingCount = await prisma.accountChart.count({
    where: { companyId },
  })

  if (existingCount > 0) {
    return NextResponse.redirect(new URL('/dashboard/finance/accounting/chart?error=already-exists', request.url))
  }

  const defaultAccounts = [
    // 資產
    { code: '1', name: '資產', category: 'ASSET', accountType: 'DEBIT', level: 1, isDetail: false, isSystem: true },
    { code: '11', name: '流動資產', category: 'ASSET', accountType: 'DEBIT', level: 2, isDetail: false, isSystem: true, parentCode: '1' },
    { code: '1101', name: '現金及約當現金', category: 'ASSET', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '11' },
    { code: '1102', name: '銀行存款', category: 'ASSET', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '11' },
    { code: '1103', name: '應收帳款', category: 'ASSET', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '11', requiresAux: true },
    { code: '1104', name: '預付款項', category: 'ASSET', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '11' },
    // 負債
    { code: '2', name: '負債', category: 'LIABILITY', accountType: 'CREDIT', level: 1, isDetail: false, isSystem: true },
    { code: '21', name: '流動負債', category: 'LIABILITY', accountType: 'CREDIT', level: 2, isDetail: false, isSystem: true, parentCode: '2' },
    { code: '2101', name: '應付帳款', category: 'LIABILITY', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '21', requiresAux: true },
    { code: '2102', name: '應付薪資', category: 'LIABILITY', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '21' },
    { code: '2103', name: '應付稅捐', category: 'LIABILITY', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '21' },
    // 權益
    { code: '3', name: '權益', category: 'EQUITY', accountType: 'CREDIT', level: 1, isDetail: false, isSystem: true },
    { code: '31', name: '股本', category: 'EQUITY', accountType: 'CREDIT', level: 2, isDetail: true, isSystem: true, parentCode: '3' },
    { code: '32', name: '保留盈餘', category: 'EQUITY', accountType: 'CREDIT', level: 2, isDetail: true, isSystem: true, parentCode: '3' },
    // 收入
    { code: '4', name: '收入', category: 'REVENUE', accountType: 'CREDIT', level: 1, isDetail: false, isSystem: true },
    { code: '41', name: '營業收入', category: 'REVENUE', accountType: 'CREDIT', level: 2, isDetail: false, isSystem: true, parentCode: '4' },
    { code: '4101', name: '銷貨收入', category: 'REVENUE', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '41' },
    { code: '4102', name: '服務收入', category: 'REVENUE', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '41' },
    // 費用
    { code: '5', name: '費用', category: 'EXPENSE', accountType: 'DEBIT', level: 1, isDetail: false, isSystem: true },
    { code: '51', name: '營業成本', category: 'EXPENSE', accountType: 'DEBIT', level: 2, isDetail: true, isSystem: true, parentCode: '5' },
    { code: '52', name: '營業費用', category: 'EXPENSE', accountType: 'DEBIT', level: 2, isDetail: false, isSystem: true, parentCode: '5' },
    { code: '5201', name: '薪資支出', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
    { code: '5202', name: '租金支出', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
    { code: '5203', name: '交通費', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
    { code: '5204', name: '文具用品', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
    { code: '5205', name: '伙食費', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
    { code: '5206', name: '通訊費', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
    { code: '5299', name: '其他費用', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
  ]

  // 先建立所有科目 (不含 parentId)
  const createdAccounts = new Map<string, string>()

  for (const acc of defaultAccounts) {
    const created = await prisma.accountChart.create({
      data: {
        companyId,
        code: acc.code,
        name: acc.name,
        category: acc.category as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
        accountType: acc.accountType as 'DEBIT' | 'CREDIT',
        level: acc.level,
        isDetail: acc.isDetail,
        isSystem: acc.isSystem,
        requiresAux: acc.requiresAux || false,
      },
    })
    createdAccounts.set(acc.code, created.id)
  }

  // 更新 parentId
  for (const acc of defaultAccounts) {
    if (acc.parentCode) {
      const parentId = createdAccounts.get(acc.parentCode)
      const accountId = createdAccounts.get(acc.code)
      if (parentId && accountId) {
        await prisma.accountChart.update({
          where: { id: accountId },
          data: { parentId },
        })
      }
    }
  }

  return NextResponse.redirect(new URL('/dashboard/finance/accounting/chart', request.url))
}
