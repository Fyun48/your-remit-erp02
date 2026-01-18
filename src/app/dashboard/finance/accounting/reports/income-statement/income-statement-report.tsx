'use client'

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

type ChartType = 'pie' | 'bar'

export function IncomeStatementReport() {
  const { data: session } = useSession()
  const userId = (session?.user as { id?: string })?.id || ''
  const printRef = useRef<HTMLDivElement>(null)

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-01-01`
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [chartType, setChartType] = useState<ChartType>('bar')

  // 取得公司列表
  const { data: companies } = trpc.company.listAll.useQuery(
    { userId },
    { enabled: !!userId }
  )

  // 取得損益表資料
  const { data: report, isLoading } = trpc.financialReport.incomeStatement.useQuery(
    {
      companyId: selectedCompanyId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
    { enabled: !!selectedCompanyId && !!startDate && !!endDate }
  )

  const companyName = companies?.find(c => c.id === selectedCompanyId)?.name || ''

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // 計算百分比（相對於收入）
  const calcPercentage = (value: number, revenue: number) => {
    if (revenue === 0) return 0
    return Math.round((value / revenue) * 100)
  }

  // 民國年轉換
  const toROCDateRange = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const startYear = start.getFullYear() - 1911
    const endYear = end.getFullYear() - 1911
    return `民國 ${startYear} 年 ${start.getMonth() + 1} 月 ${start.getDate()} 日 至 ${endYear} 年 ${end.getMonth() + 1} 月 ${end.getDate()} 日`
  }

  // 圓餅圖元件
  const PieChartComponent = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
    const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0)
    if (total === 0) return <div className="text-center text-muted-foreground py-8">無資料</div>

    let cumulativePercent = 0

    return (
      <div className="flex items-center justify-center gap-8">
        <svg viewBox="0 0 100 100" className="w-48 h-48">
          {data.map((item, i) => {
            const percent = (Math.abs(item.value) / total) * 100
            const startAngle = cumulativePercent * 3.6
            const endAngle = (cumulativePercent + percent) * 3.6
            cumulativePercent += percent

            const largeArc = percent > 50 ? 1 : 0
            const startX = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180)
            const startY = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180)
            const endX = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180)
            const endY = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180)

            return (
              <path
                key={i}
                d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`}
                fill={item.color}
                stroke="white"
                strokeWidth="0.5"
              />
            )
          })}
        </svg>
        <div className="space-y-2">
          {data.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
              <span className="text-sm">{item.label}</span>
              <span className="text-sm font-mono">{formatAmount(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 長條圖元件（水平對比）
  const BarChartComponent = ({ revenue, expenses, netIncome }: { revenue: number; expenses: number; netIncome: number }) => {
    const maxValue = Math.max(revenue, expenses, Math.abs(netIncome), 1)

    const items = [
      { label: '營業收入', value: revenue, color: '#22c55e' },
      { label: '營業費用', value: expenses, color: '#ef4444' },
      { label: '淨利(損)', value: netIncome, color: netIncome >= 0 ? '#3b82f6' : '#f97316' },
    ]

    return (
      <div className="space-y-4 py-4">
        {items.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{item.label}</span>
              <span className="font-mono" style={{ color: item.color }}>
                {formatAmount(item.value)}
              </span>
            </div>
            <div className="h-6 bg-muted rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${(Math.abs(item.value) / maxValue) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}

        {/* 利潤率指標 */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">淨利率</span>
            <Badge variant={netIncome >= 0 ? 'default' : 'destructive'}>
              {calcPercentage(netIncome, revenue)}%
            </Badge>
          </div>
        </div>
      </div>
    )
  }

  // 列印功能
  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>損益表 - ${companyName}</title>
        <style>
          body { font-family: 'Microsoft JhengHei', sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 18px; font-weight: bold; }
          .report-title { font-size: 24px; font-weight: bold; margin: 10px 0; }
          .period { font-size: 14px; color: #666; }
          .section { margin: 20px 0; }
          .section-title { font-size: 16px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 10px; }
          .item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
          .total { font-weight: bold; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; }
          .net-income { font-size: 18px; background: #f0f0f0; padding: 15px; margin-top: 20px; }
          .positive { color: green; }
          .negative { color: red; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature { border-top: 1px solid #333; width: 120px; text-align: center; padding-top: 5px; }
          .print-date { text-align: right; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companyName}</div>
          <div class="report-title">損 益 表</div>
          <div class="period">${toROCDateRange()}</div>
        </div>
        ${printContent.innerHTML}
        <div class="footer">
          <div class="signature">製表人</div>
          <div class="signature">覆核</div>
          <div class="signature">主管</div>
        </div>
        <div class="print-date">列印日期：${new Date().toLocaleDateString('zh-TW')}</div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  // 匯出 Excel
  const handleExportExcel = () => {
    if (!report) return

    const rows: string[][] = [
      ['損益表'],
      [companyName],
      [toROCDateRange()],
      [''],
      ['營業收入'],
      ...report.revenue.details.map(d => [d.account, String(d.amount)]),
      ['營業收入合計', String(report.revenue.total)],
      [''],
      ['營業費用'],
      ...report.expenses.details.map(d => [d.account, String(d.amount)]),
      ['營業費用合計', String(report.expenses.total)],
      [''],
      ['本期淨利(損)', String(report.netIncome)],
    ]

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `損益表_${companyName}_${startDate}_${endDate}.csv`
    link.click()
  }

  const pieData = report ? [
    ...report.revenue.details.map((d, i) => ({
      label: d.account.split('-')[1] || d.account,
      value: d.amount,
      color: `hsl(${120 + i * 30}, 70%, 50%)`,
    })),
    ...report.expenses.details.map((d, i) => ({
      label: d.account.split('-')[1] || d.account,
      value: d.amount,
      color: `hsl(${0 + i * 20}, 70%, 50%)`,
    })),
  ] : []

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/finance/accounting/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">損益表</h1>
            <p className="text-muted-foreground">Income Statement - 經營績效報表</p>
          </div>
        </div>

        {report && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              匯出 Excel
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              列印
            </Button>
          </div>
        )}
      </div>

      {/* 篩選區 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">報表條件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="w-64">
              <label className="text-sm font-medium mb-2 block">公司</label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇公司" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <label className="text-sm font-medium mb-2 block">起始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="w-40">
              <label className="text-sm font-medium mb-2 block">結束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            {report && (
              <div className="flex items-end">
                <div className="flex border rounded-md">
                  <Button
                    variant={chartType === 'pie' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setChartType('pie')}
                    className="rounded-r-none"
                  >
                    <PieChart className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={chartType === 'bar' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setChartType('bar')}
                    className="rounded-l-none"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 載入中 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 報表內容 */}
      {report && (
        <>
          {/* 摘要卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  營業收入
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-2xl font-bold text-green-600">
                    {formatAmount(report.revenue.total)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  營業費用
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <TrendingDown className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-2xl font-bold text-red-600">
                    {formatAmount(report.expenses.total)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className={report.netIncome >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  本期淨利(損)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${report.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatAmount(report.netIncome)}
                  </span>
                  <Badge variant={report.netIncome >= 0 ? 'default' : 'destructive'}>
                    {calcPercentage(report.netIncome, report.revenue.total)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 圖表區 */}
          <Card>
            <CardHeader>
              <CardTitle>損益結構圖</CardTitle>
            </CardHeader>
            <CardContent>
              {chartType === 'pie' ? (
                <PieChartComponent data={pieData} />
              ) : (
                <BarChartComponent
                  revenue={report.revenue.total}
                  expenses={report.expenses.total}
                  netIncome={report.netIncome}
                />
              )}
            </CardContent>
          </Card>

          {/* 詳細報表 */}
          <Card>
            <CardHeader>
              <CardTitle>報表明細</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={printRef} className="space-y-6">
                {/* 營業收入 */}
                <div className="section">
                  <h3 className="font-bold text-lg border-b-2 border-green-500 pb-2 mb-3 text-green-700">
                    營業收入
                  </h3>
                  {report.revenue.details.length > 0 ? (
                    report.revenue.details.map((item, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-dotted">
                        <span>{item.account}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {calcPercentage(item.amount, report.revenue.total)}%
                          </span>
                          <span className="font-mono w-32 text-right">{formatAmount(item.amount)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground py-2">無收入資料</div>
                  )}
                  <div className="flex justify-between py-3 font-bold border-t-2 mt-2">
                    <span>營業收入合計</span>
                    <span className="font-mono text-green-600">{formatAmount(report.revenue.total)}</span>
                  </div>
                </div>

                {/* 營業費用 */}
                <div className="section">
                  <h3 className="font-bold text-lg border-b-2 border-red-500 pb-2 mb-3 text-red-700">
                    營業費用
                  </h3>
                  {report.expenses.details.length > 0 ? (
                    report.expenses.details.map((item, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-dotted">
                        <span>{item.account}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {calcPercentage(item.amount, report.revenue.total)}%
                          </span>
                          <span className="font-mono w-32 text-right">{formatAmount(item.amount)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground py-2">無費用資料</div>
                  )}
                  <div className="flex justify-between py-3 font-bold border-t-2 mt-2">
                    <span>營業費用合計</span>
                    <span className="font-mono text-red-600">{formatAmount(report.expenses.total)}</span>
                  </div>
                </div>

                {/* 本期淨利 */}
                <div className={`net-income p-4 rounded-lg ${report.netIncome >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">本期淨利(損)</span>
                    <span className={`font-mono text-2xl font-bold ${report.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatAmount(report.netIncome)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedCompanyId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            請選擇公司和期間以查看損益表
          </CardContent>
        </Card>
      )}
    </div>
  )
}
