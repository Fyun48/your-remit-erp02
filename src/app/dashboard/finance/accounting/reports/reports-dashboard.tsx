'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  FileText,
  Scale,
  Wallet,
  Receipt,
  ArrowLeft,
  Building2,
  ClipboardList,
  Users,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

interface ReportsDashboardProps {
  companyId: string
  companyName: string
}

export function ReportsDashboard({ companyId, companyName }: ReportsDashboardProps) {
  const reportItems = [
    {
      title: '試算表',
      description: '各科目借貸餘額，確認借貸平衡',
      href: '/dashboard/finance/accounting/reports/trial-balance',
      icon: Scale,
    },
    {
      title: '資產負債表',
      description: '資產、負債、權益彙總報表',
      href: '/dashboard/finance/accounting/reports/balance-sheet',
      icon: BarChart3,
    },
    {
      title: '損益表',
      description: '收入、費用、淨利報表',
      href: '/dashboard/finance/accounting/reports/income-statement',
      icon: FileText,
    },
    {
      title: '現金流量表',
      description: '營業、投資、籌資活動現金流',
      href: '/dashboard/finance/accounting/reports/cash-flow',
      icon: Wallet,
    },
    {
      title: '401 營業稅申報書',
      description: '營業人銷售額與稅額申報',
      href: '/dashboard/finance/accounting/reports/vat-401',
      icon: Receipt,
    },
    {
      title: '進銷項發票明細',
      description: '逐筆查詢銷項與進項發票明細',
      href: '/dashboard/finance/accounting/reports/invoice-detail',
      icon: ClipboardList,
    },
    {
      title: '扣繳憑單彙總',
      description: '年度扣繳資料彙總，申報用',
      href: '/dashboard/finance/accounting/reports/withholding',
      icon: Users,
    },
    {
      title: '歷年比較報表',
      description: '損益表、資產負債表歷年比較',
      href: '/dashboard/finance/accounting/reports/comparison',
      icon: TrendingUp,
    },
  ]

  // 將公司 ID 附加到 URL
  const getReportUrl = (href: string) => {
    return `${href}?companyId=${companyId}`
  }

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/finance/accounting">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">財務報表</h1>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              <span>目前公司：</span>
              <span className="font-medium text-foreground">{companyName}</span>
              <span className="text-xs">（可透過頂部選單切換公司）</span>
            </div>
          </div>
        </div>
      </div>

      {/* 報表列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportItems.map((item) => (
          <Link key={item.href} href={getReportUrl(item.href)}>
            <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <span className="text-sm text-primary mt-4 block">查看報表 &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
