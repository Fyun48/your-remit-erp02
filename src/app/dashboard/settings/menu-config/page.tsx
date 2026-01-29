import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { MenuConfigList } from './menu-config-list'

export default async function MenuConfigPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得啟用的公司列表
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">選單設定</h1>
        <p className="text-muted-foreground">
          配置公司的選單結構，可調整主選單排序與子選單歸屬
        </p>
      </div>

      <MenuConfigList companies={companies} />
    </div>
  )
}
