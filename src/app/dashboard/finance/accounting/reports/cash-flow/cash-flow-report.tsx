'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  Wallet,
  Building2,
  Landmark,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

type ChartType = 'pie' | 'bar'

interface CashFlowReportProps {
  assignments: {
    companyId: string
    company: {
      id: string
      name: string
    }
  }[]
  initialCompanyId: string
}

export function CashFlowReport({ assignments, initialCompanyId }: CashFlowReportProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const [selectedCompanyId] = useState<string>(initialCompanyId)
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-01-01`
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [chartType, setChartType] = useState<ChartType>('bar')

  // 取得現金流量表資料
  const { data: report, isLoading } = trpc.financialReport.cashFlow.useQuery(
    {
      companyId: selectedCompanyId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
    { enabled: !!selectedCompanyId && !!startDate && !!endDate }
  )

  const companyName = assignments.find(a => a.companyId === selectedCompanyId)?.company.name || ''

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // 民國年轉換
  const toROCDateRange = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const startYear = start.getFullYear() - 1911
    const endYear = end.getFullYear() - 1911
    return `民國 ${startYear} 年 ${start.getMonth() + 1} 月 ${start.getDate()} 日 至 ${endYear} 年 ${end.getMonth() + 1} 月 ${end.getDate()} 日`
  }

  // 圓餅圖元件（顯示三大類現金流量佔比）
  const PieChartComponent = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
    const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0)
    if (total === 0) return <div className="text-center text-muted-foreground py-8">無現金流量資料</div>

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
        <div className="space-y-3">
          {data.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className={`font-mono text-sm ${item.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.value >= 0 ? '+' : ''}{formatAmount(item.value)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 長條圖元件（水平對比）
  const BarChartComponent = () => {
    if (!report) return null

    const items = [
      { label: '營業活動', value: report.operating.netCash, color: '#22c55e', icon: Wallet },
      { label: '投資活動', value: report.investing.netCash, color: '#3b82f6', icon: Building2 },
      { label: '籌資活動', value: report.financing.netCash, color: '#8b5cf6', icon: Landmark },
    ]

    const maxValue = Math.max(...items.map(i => Math.abs(i.value)), 1)

    return (
      <div className="space-y-6 py-4">
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" style={{ color: item.color }} />
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.value >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`font-mono font-bold ${item.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.value >= 0 ? '+' : ''}{formatAmount(item.value)}
                  </span>
                </div>
              </div>
              <div className="h-8 bg-muted rounded-lg overflow-hidden relative">
                {/* 中心線 */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
                {/* 數值條 */}
                <div
                  className="absolute top-1 bottom-1 rounded transition-all duration-500"
                  style={{
                    backgroundColor: item.color,
                    width: `${(Math.abs(item.value) / maxValue) * 45}%`,
                    left: item.value >= 0 ? '50%' : undefined,
                    right: item.value < 0 ? '50%' : undefined,
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          )
        })}

        {/* 現金變動總結 */}
        <div className="pt-4 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">期初現金</span>
            <span className="font-mono">{formatAmount(report.summary.beginningCash)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">本期淨變動</span>
            <span className={`font-mono ${report.summary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {report.summary.netChange >= 0 ? '+' : ''}{formatAmount(report.summary.netChange)}
            </span>
          </div>
          <div className="flex justify-between font-bold">
            <span>期末現金</span>
            <span className="font-mono">{formatAmount(report.summary.endingCash)}</span>
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
        <title>現金流量表 - ${companyName}</title>
        <style>
          body { font-family: 'Microsoft JhengHei', sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 18px; font-weight: bold; }
          .report-title { font-size: 24px; font-weight: bold; margin: 10px 0; }
          .period { font-size: 14px; color: #666; }
          .section { margin: 20px 0; page-break-inside: avoid; }
          .section-title { font-size: 16px; font-weight: bold; background: #f5f5f5; padding: 8px; margin-bottom: 10px; }
          .item { display: flex; justify-content: space-between; padding: 4px 0; padding-left: 20px; }
          .item.inflow { color: green; }
          .item.outflow { color: red; }
          .subtotal { font-weight: bold; border-top: 1px solid #999; margin-top: 10px; padding-top: 5px; }
          .summary { margin-top: 30px; background: #e8f5e9; padding: 15px; }
          .summary-item { display: flex; justify-content: space-between; padding: 5px 0; }
          .summary-total { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature { border-top: 1px solid #333; width: 120px; text-align: center; padding-top: 5px; }
          .print-date { text-align: right; margin-top: 20px; font-size: 12px; color: #666; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companyName}</div>
          <div class="report-title">現 金 流 量 表</div>
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
      ['現金流量表'],
      [companyName],
      [toROCDateRange()],
      [''],
      ['一、營業活動之現金流量'],
      ['現金流入'],
      ...report.operating.inflows.map(d => ['  ' + d.description, String(d.amount)]),
      ['現金流出'],
      ...report.operating.outflows.map(d => ['  ' + d.description, String(-d.amount)]),
      ['營業活動淨現金流量', String(report.operating.netCash)],
      [''],
      ['二、投資活動之現金流量'],
      ['現金流入'],
      ...report.investing.inflows.map(d => ['  ' + d.description, String(d.amount)]),
      ['現金流出'],
      ...report.investing.outflows.map(d => ['  ' + d.description, String(-d.amount)]),
      ['投資活動淨現金流量', String(report.investing.netCash)],
      [''],
      ['三、籌資活動之現金流量'],
      ['現金流入'],
      ...report.financing.inflows.map(d => ['  ' + d.description, String(d.amount)]),
      ['現金流出'],
      ...report.financing.outflows.map(d => ['  ' + d.description, String(-d.amount)]),
      ['籌資活動淨現金流量', String(report.financing.netCash)],
      [''],
      ['期初現金及約當現金', String(report.summary.beginningCash)],
      ['本期現金及約當現金淨增(減)', String(report.summary.netChange)],
      ['期末現金及約當現金', String(report.summary.endingCash)],
    ]

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `現金流量表_${companyName}_${startDate}_${endDate}.csv`
    link.click()
  }

  const pieData = report ? [
    { label: '營業活動', value: report.operating.netCash, color: '#22c55e' },
    { label: '投資活動', value: report.investing.netCash, color: '#3b82f6' },
    { label: '籌資活動', value: report.financing.netCash, color: '#8b5cf6' },
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
            <h1 className="text-2xl font-bold">現金流量表</h1>
            <p className="text-muted-foreground">Cash Flow Statement - 資金流動分析</p>
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
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted text-sm">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{companyName}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">如需變更公司請返回報表首頁</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-500" />
                  營業活動
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className={`text-xl font-bold ${report.operating.netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {report.operating.netCash >= 0 ? '+' : ''}{formatAmount(report.operating.netCash)}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  投資活動
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className={`text-xl font-bold ${report.investing.netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {report.investing.netCash >= 0 ? '+' : ''}{formatAmount(report.investing.netCash)}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-purple-500" />
                  籌資活動
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className={`text-xl font-bold ${report.financing.netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {report.financing.netCash >= 0 ? '+' : ''}{formatAmount(report.financing.netCash)}
                </span>
              </CardContent>
            </Card>

            <Card className={report.summary.netChange >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  期末現金
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-xl font-bold ${report.summary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatAmount(report.summary.endingCash)}
                  </span>
                  <Badge variant={report.summary.netChange >= 0 ? 'default' : 'destructive'}>
                    {report.summary.netChange >= 0 ? '+' : ''}{formatAmount(report.summary.netChange)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 圖表區 */}
          <Card>
            <CardHeader>
              <CardTitle>現金流量結構圖</CardTitle>
            </CardHeader>
            <CardContent>
              {chartType === 'pie' ? (
                <PieChartComponent data={pieData} />
              ) : (
                <BarChartComponent />
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
                {/* 營業活動 */}
                <div className="section">
                  <h3 className="font-bold text-lg bg-green-100 p-3 rounded-t flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-green-600" />
                    一、營業活動之現金流量
                  </h3>
                  <div className="border border-t-0 rounded-b p-4 space-y-2">
                    {report.operating.inflows.length > 0 && (
                      <>
                        <div className="text-sm font-medium text-green-600">現金流入</div>
                        {report.operating.inflows.map((item, i) => (
                          <div key={i} className="flex justify-between py-1 pl-4 text-green-700">
                            <span>{item.description}</span>
                            <span className="font-mono">+{formatAmount(item.amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {report.operating.outflows.length > 0 && (
                      <>
                        <div className="text-sm font-medium text-red-600 mt-2">現金流出</div>
                        {report.operating.outflows.map((item, i) => (
                          <div key={i} className="flex justify-between py-1 pl-4 text-red-700">
                            <span>{item.description}</span>
                            <span className="font-mono">-{formatAmount(item.amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {report.operating.inflows.length === 0 && report.operating.outflows.length === 0 && (
                      <div className="text-muted-foreground text-center py-2">無營業活動現金流量</div>
                    )}
                    <div className="flex justify-between py-2 font-bold border-t mt-2">
                      <span>營業活動淨現金流量</span>
                      <span className={`font-mono ${report.operating.netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {report.operating.netCash >= 0 ? '+' : ''}{formatAmount(report.operating.netCash)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 投資活動 */}
                <div className="section">
                  <h3 className="font-bold text-lg bg-blue-100 p-3 rounded-t flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    二、投資活動之現金流量
                  </h3>
                  <div className="border border-t-0 rounded-b p-4 space-y-2">
                    {report.investing.inflows.length > 0 && (
                      <>
                        <div className="text-sm font-medium text-green-600">現金流入</div>
                        {report.investing.inflows.map((item, i) => (
                          <div key={i} className="flex justify-between py-1 pl-4 text-green-700">
                            <span>{item.description}</span>
                            <span className="font-mono">+{formatAmount(item.amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {report.investing.outflows.length > 0 && (
                      <>
                        <div className="text-sm font-medium text-red-600 mt-2">現金流出</div>
                        {report.investing.outflows.map((item, i) => (
                          <div key={i} className="flex justify-between py-1 pl-4 text-red-700">
                            <span>{item.description}</span>
                            <span className="font-mono">-{formatAmount(item.amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {report.investing.inflows.length === 0 && report.investing.outflows.length === 0 && (
                      <div className="text-muted-foreground text-center py-2">無投資活動現金流量</div>
                    )}
                    <div className="flex justify-between py-2 font-bold border-t mt-2">
                      <span>投資活動淨現金流量</span>
                      <span className={`font-mono ${report.investing.netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {report.investing.netCash >= 0 ? '+' : ''}{formatAmount(report.investing.netCash)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 籌資活動 */}
                <div className="section">
                  <h3 className="font-bold text-lg bg-purple-100 p-3 rounded-t flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-purple-600" />
                    三、籌資活動之現金流量
                  </h3>
                  <div className="border border-t-0 rounded-b p-4 space-y-2">
                    {report.financing.inflows.length > 0 && (
                      <>
                        <div className="text-sm font-medium text-green-600">現金流入</div>
                        {report.financing.inflows.map((item, i) => (
                          <div key={i} className="flex justify-between py-1 pl-4 text-green-700">
                            <span>{item.description}</span>
                            <span className="font-mono">+{formatAmount(item.amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {report.financing.outflows.length > 0 && (
                      <>
                        <div className="text-sm font-medium text-red-600 mt-2">現金流出</div>
                        {report.financing.outflows.map((item, i) => (
                          <div key={i} className="flex justify-between py-1 pl-4 text-red-700">
                            <span>{item.description}</span>
                            <span className="font-mono">-{formatAmount(item.amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {report.financing.inflows.length === 0 && report.financing.outflows.length === 0 && (
                      <div className="text-muted-foreground text-center py-2">無籌資活動現金流量</div>
                    )}
                    <div className="flex justify-between py-2 font-bold border-t mt-2">
                      <span>籌資活動淨現金流量</span>
                      <span className={`font-mono ${report.financing.netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {report.financing.netCash >= 0 ? '+' : ''}{formatAmount(report.financing.netCash)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 現金變動摘要 */}
                <div className={`summary p-4 rounded-lg ${report.summary.netChange >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <h3 className="font-bold text-lg mb-4">現金及約當現金變動</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-dotted">
                      <span>期初現金及約當現金</span>
                      <span className="font-mono">{formatAmount(report.summary.beginningCash)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dotted">
                      <span>本期現金及約當現金淨增(減)</span>
                      <span className={`font-mono font-bold ${report.summary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {report.summary.netChange >= 0 ? '+' : ''}{formatAmount(report.summary.netChange)}
                      </span>
                    </div>
                    <div className="flex justify-between py-3 font-bold text-lg border-t-2">
                      <span>期末現金及約當現金</span>
                      <span className="font-mono">{formatAmount(report.summary.endingCash)}</span>
                    </div>
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
            請選擇公司和期間以查看現金流量表
          </CardContent>
        </Card>
      )}
    </div>
  )
}
