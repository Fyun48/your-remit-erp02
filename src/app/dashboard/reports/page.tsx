import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Calendar, Receipt } from 'lucide-react'
import Link from 'next/link'

export default async function ReportsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const reportItems = [
    {
      title: '出勤報表',
      description: '查看員工出勤記錄、遲到早退、加班統計',
      href: '/dashboard/reports/attendance',
      icon: Clock,
    },
    {
      title: '請假統計',
      description: '各類假別使用統計、年度趨勢分析',
      href: '/dashboard/reports/leave',
      icon: Calendar,
    },
    {
      title: '費用分析',
      description: '費用類別分布、月度趨勢、部門比較',
      href: '/dashboard/reports/expense',
      icon: Receipt,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">報表中心</h1>
        <p className="text-muted-foreground">查看各項統計報表與分析數據</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportItems.map((item) => (
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
                <span className="text-sm text-primary">查看報表 &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
