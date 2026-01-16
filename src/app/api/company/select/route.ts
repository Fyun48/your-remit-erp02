import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { isGroupAdmin } from '@/lib/group-permission'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 檢查是否為集團管理員
    const hasAdminPermission = await isGroupAdmin(session.user.id)
    if (!hasAdminPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { companyId } = body

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 })
    }

    // 驗證公司存在且啟用
    const company = await prisma.company.findUnique({
      where: { id: companyId, isActive: true },
      select: { id: true, name: true, code: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // 設定 cookie
    const cookieStore = await cookies()
    cookieStore.set('selectedCompanyId', companyId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/', // 確保 cookie 在所有路徑都有效
    })
    cookieStore.set('selectedCompanyName', company.name, {
      httpOnly: false, // 允許 JS 讀取用於顯示
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    console.log('Cookie set for company:', companyId, company.name)

    return NextResponse.json({ success: true, company })
  } catch (error) {
    console.error('Failed to select company:', error)
    return NextResponse.json({ error: 'Failed to select company' }, { status: 500 })
  }
}
