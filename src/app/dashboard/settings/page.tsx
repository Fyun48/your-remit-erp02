import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Shield, Users } from 'lucide-react'

export default function SettingsPage() {
  const settingsItems = [
    {
      title: '班別設定',
      description: '管理公司班別，設定上下班時間與遲到早退寬限',
      href: '/dashboard/settings/shifts',
      icon: Clock,
    },
    {
      title: '角色權限',
      description: '管理系統角色與權限設定',
      href: '/dashboard/settings/roles',
      icon: Shield,
    },
    {
      title: '員工管理',
      description: '管理員工資料與任職資訊',
      href: '/dashboard/hr',
      icon: Users,
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系統設定</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsItems.map((item) => (
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
                <span className="text-sm text-primary">前往設定 &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
