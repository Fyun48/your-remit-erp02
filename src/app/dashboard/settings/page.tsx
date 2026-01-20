import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Sparkles, Plug } from 'lucide-react'

export default function SettingsPage() {
  const settingsItems = [
    {
      title: '帳號設定',
      description: '管理個人帳號、LINE 連動等設定',
      href: '/dashboard/settings/account',
      icon: User,
    },
    {
      title: 'AI 助手設定',
      description: '設定 AI 助手的行為與偏好',
      href: '/dashboard/settings/ai',
      icon: Sparkles,
    },
    {
      title: '外部整合',
      description: '設定 LINE、API 等外部服務整合',
      href: '/dashboard/settings/integrations',
      icon: Plug,
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
