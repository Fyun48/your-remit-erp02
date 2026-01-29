import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Calendar, Receipt, BookOpen, FileSpreadsheet, TrendingUp, Scale, Banknote, FileCheck } from 'lucide-react'
import Link from 'next/link'

export default async function ReportsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const hrReportItems = [
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

  const financeReportItems = [
    {
      title: '試算表',
      description: '會計科目借貸餘額試算',
      href: '/dashboard/finance/accounting/reports/trial-balance',
      icon: FileSpreadsheet,
    },
    {
      title: '損益表',
      description: '收入、支出及淨利分析',
      href: '/dashboard/finance/accounting/reports/income-statement',
      icon: TrendingUp,
    },
    {
      title: '資產負債表',
      description: '資產、負債及權益狀況',
      href: '/dashboard/finance/accounting/reports/balance-sheet',
      icon: Scale,
    },
    {
      title: '現金流量表',
      description: '營運、投資及融資活動現金流量',
      href: '/dashboard/finance/accounting/reports/cash-flow',
      icon: Banknote,
    },
    {
      title: '年度比較報表',
      description: '多期間財務數據比較分析',
      href: '/dashboard/finance/accounting/reports/comparison',
      icon: BookOpen,
    },
    {
      title: '營業稅申報 (401)',
      description: '營業稅申報表 401 表',
      href: '/dashboard/finance/accounting/reports/vat-401',
      icon: FileCheck,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">報表中心</h1>
        <p className="text-muted-foreground">查看各項統計報表與分析數據</p>
      </div>

      {/* 人事報表 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-muted-foreground">人事報表</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hrReportItems.map((item) => (
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

      {/* 財務報表 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-muted-foreground">財務報表</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {financeReportItems.map((item) => (
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
    </div>
  )
}
