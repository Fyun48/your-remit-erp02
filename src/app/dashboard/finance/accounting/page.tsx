import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, FileText, Users, Building2, Calendar, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default async function AccountingPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const menuItems = [
    {
      title: '會計科目表',
      description: '管理會計科目，初始化預設科目',
      href: '/dashboard/finance/accounting/chart',
      icon: BookOpen,
    },
    {
      title: '會計期間',
      description: '管理會計年度期間，結帳控制',
      href: '/dashboard/finance/accounting/periods',
      icon: Calendar,
    },
    {
      title: '傳票管理',
      description: '建立、審核、過帳會計傳票',
      href: '/dashboard/finance/accounting/vouchers',
      icon: FileText,
    },
    {
      title: '客戶管理',
      description: '管理客戶資料，應收帳款對象',
      href: '/dashboard/finance/accounting/customers',
      icon: Users,
    },
    {
      title: '供應商管理',
      description: '管理供應商資料，應付帳款對象',
      href: '/dashboard/finance/accounting/vendors',
      icon: Building2,
    },
    {
      title: '財務報表',
      description: '試算表、資產負債表、損益表',
      href: '/dashboard/finance/accounting/reports',
      icon: BarChart3,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">會計管理</h1>
        <p className="text-muted-foreground">財務會計系統設定與操作</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-primary">進入管理 &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
