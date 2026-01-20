'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  Users,
  Calculator,
  FileText,
  BarChart3,
  Calendar,
  Wallet,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface PayrollDashboardProps {
  companyId: string
  companyName: string
}

export default function PayrollDashboard({ companyId, companyName }: PayrollDashboardProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const { data: setting, isLoading: settingLoading } = trpc.payroll.getSetting.useQuery({ companyId })
  const { data: periods, isLoading: periodsLoading } = trpc.payroll.listPeriods.useQuery({
    companyId,
    year: currentYear,
  })
  const { data: salaries, isLoading: salariesLoading } = trpc.payroll.listEmployeeSalaries.useQuery({
    companyId,
    isActive: true,
  })

  const isLoading = settingLoading || periodsLoading || salariesLoading

  // 取得當月薪資期間
  const currentPeriod = periods?.find(p => p.year === currentYear && p.month === currentMonth)

  // 功能選單
  const menuItems = [
    {
      title: '薪資設定',
      description: '勞健保費率、加班倍率設定',
      icon: Settings,
      href: '/dashboard/hr/payroll/settings',
      color: 'text-blue-500',
    },
    {
      title: '員工薪資',
      description: '管理員工薪資檔案',
      icon: Users,
      href: '/dashboard/hr/payroll/employees',
      color: 'text-green-500',
    },
    {
      title: '投保級距',
      description: '查看勞健保投保級距表',
      icon: BarChart3,
      href: '/dashboard/hr/payroll/grades',
      color: 'text-purple-500',
    },
    {
      title: '薪資計算',
      description: '計算月薪資與薪資單',
      icon: Calculator,
      href: '/dashboard/hr/payroll/periods',
      color: 'text-orange-500',
    },
    {
      title: '薪資報表',
      description: '薪資統計與申報資料',
      icon: FileText,
      href: '/dashboard/hr/payroll/reports',
      color: 'text-indigo-500',
    },
  ]

  const formatAmount = (amount: number | string | { toString(): string } | null | undefined) => {
    if (amount === null || amount === undefined) return '0'
    const num = typeof amount === 'string' ? parseFloat(amount) :
                typeof amount === 'number' ? amount : parseFloat(amount.toString())
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      DRAFT: { label: '草稿', variant: 'secondary' },
      CALCULATED: { label: '已計算', variant: 'outline' },
      APPROVED: { label: '已核准', variant: 'default' },
      PAID: { label: '已發放', variant: 'default' },
    }
    const config = statusMap[status] || { label: status, variant: 'secondary' as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          薪資管理
        </h1>
        <p className="text-muted-foreground">{companyName}</p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已建檔員工</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salaries?.length || 0}</div>
            <p className="text-xs text-muted-foreground">位員工</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">基本工資</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(setting?.minimumWage)}
            </div>
            <p className="text-xs text-muted-foreground">元</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">勞保費率</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {setting ? (Number(setting.laborInsuranceRate) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              員工自付 {setting ? (Number(setting.laborInsuranceEmpShare) * 100).toFixed(0) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">健保費率</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {setting ? (Number(setting.healthInsuranceRate) * 100).toFixed(2) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              員工自付 {setting ? (Number(setting.healthInsuranceEmpShare) * 100).toFixed(0) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 當月薪資期間 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {currentYear} 年 {currentMonth} 月 薪資
              </CardTitle>
              <CardDescription>當月薪資處理狀態</CardDescription>
            </div>
            {currentPeriod ? (
              getStatusBadge(currentPeriod.status)
            ) : (
              <Badge variant="outline">尚未建立</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentPeriod ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                已產生 {currentPeriod._count.slips} 張薪資單
              </div>
              <Link href={`/dashboard/hr/payroll/periods/${currentPeriod.id}`}>
                <Button variant="outline" size="sm">
                  查看詳情
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                尚未建立本月薪資期間
              </div>
              <Link href="/dashboard/hr/payroll/periods">
                <Button size="sm">
                  前往建立
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 功能選單 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <item.icon className={`h-6 w-6 ${item.color}`} />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 最近薪資期間 */}
      {periods && periods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>最近薪資期間</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {periods.slice(0, 6).map((period) => (
                <Link
                  key={period.id}
                  href={`/dashboard/hr/payroll/periods/${period.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {period.year} 年 {period.month} 月
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {period._count.slips} 張薪資單
                    </span>
                    {getStatusBadge(period.status)}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
