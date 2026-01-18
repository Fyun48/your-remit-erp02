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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  PieChart,
  BarChart3,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

type ChartType = 'pie' | 'bar'

export function BalanceSheetReport() {
  const { data: session } = useSession()
  const userId = (session?.user as { id?: string })?.id || ''
  const printRef = useRef<HTMLDivElement>(null)

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [chartType, setChartType] = useState<ChartType>('pie')

  // 取得公司列表
  const { data: companies } = trpc.company.listAll.useQuery(
    { userId },
    { enabled: !!userId }
  )

  // 取得資產負債表資料
  const { data: report, isLoading } = trpc.financialReport.balanceSheet.useQuery(
    { companyId: selectedCompanyId, asOfDate: new Date(asOfDate) },
    { enabled: !!selectedCompanyId && !!asOfDate }
  )

  const companyName = companies?.find(c => c.id === selectedCompanyId)?.name || ''

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // 計算百分比
  const calcPercentage = (value: number, total: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  // 民國年轉換
  const toROCDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const year = date.getFullYear() - 1911
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `民國 ${year} 年 ${month} 月 ${day} 日`
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
              <span className="text-sm text-muted-foreground">
                ({calcPercentage(Math.abs(item.value), total)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 長條圖元件
  const BarChartComponent = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
    const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 1)

    return (
      <div className="space-y-3 py-4">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 text-sm text-right">{item.label}</div>
            <div className="flex-1 h-8 bg-muted rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${(Math.abs(item.value) / maxValue) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <div className="w-28 text-sm text-right font-mono">
              {formatAmount(item.value)}
            </div>
          </div>
        ))}
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
        <title>資產負債表 - ${companyName}</title>
        <style>
          body { font-family: 'Microsoft JhengHei', sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 18px; font-weight: bold; }
          .report-title { font-size: 24px; font-weight: bold; margin: 10px 0; }
          .as-of-date { font-size: 14px; color: #666; }
          .section { margin: 20px 0; }
          .section-title { font-size: 16px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 10px; }
          .item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
          .item-name { }
          .item-amount { font-family: monospace; }
          .total { font-weight: bold; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature { border-top: 1px solid #333; width: 120px; text-align: center; padding-top: 5px; }
          .print-date { text-align: right; margin-top: 20px; font-size: 12px; color: #666; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companyName}</div>
          <div class="report-title">資 產 負 債 表</div>
          <div class="as-of-date">${toROCDate(asOfDate)}</div>
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
      ['資產負債表'],
      [companyName],
      [toROCDate(asOfDate)],
      [''],
      ['資產'],
      ...report.assets.details.map(d => [d.account, String(d.balance)]),
      ['資產合計', String(report.assets.total)],
      [''],
      ['負債'],
      ...report.liabilities.details.map(d => [d.account, String(d.balance)]),
      ['負債合計', String(report.liabilities.total)],
      [''],
      ['權益'],
      ...report.equity.details.map(d => [d.account, String(d.balance)]),
      ['權益合計', String(report.equity.total)],
      [''],
      ['負債及權益合計', String(report.liabilities.total + report.equity.total)],
    ]

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `資產負債表_${companyName}_${asOfDate}.csv`
    link.click()
  }

  const chartData = report ? [
    { label: '資產', value: report.assets.total, color: '#22c55e' },
    { label: '負債', value: report.liabilities.total, color: '#ef4444' },
    { label: '權益', value: report.equity.total, color: '#3b82f6' },
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
            <h1 className="text-2xl font-bold">資產負債表</h1>
            <p className="text-muted-foreground">Balance Sheet - 財務狀況報表</p>
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

            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">截止日期</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
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
          {/* 圖表區 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>財務結構圖</CardTitle>
                <Badge variant={report.isBalanced ? 'default' : 'destructive'}>
                  {report.isBalanced ? (
                    <><CheckCircle2 className="h-4 w-4 mr-1" /> 資產 = 負債 + 權益</>
                  ) : (
                    <><XCircle className="h-4 w-4 mr-1" /> 會計等式不平衡</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {chartType === 'pie' ? (
                <PieChartComponent data={chartData} />
              ) : (
                <BarChartComponent data={chartData} />
              )}
            </CardContent>
          </Card>

          {/* 詳細報表 */}
          <Card>
            <CardHeader>
              <CardTitle>報表明細</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={printRef}>
                <Tabs defaultValue="all" className="w-full">
                  <TabsList>
                    <TabsTrigger value="all">完整報表</TabsTrigger>
                    <TabsTrigger value="assets">資產</TabsTrigger>
                    <TabsTrigger value="liabilities">負債</TabsTrigger>
                    <TabsTrigger value="equity">權益</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="space-y-6 mt-4">
                    {/* 資產 */}
                    <div className="section">
                      <h3 className="section-title font-bold text-lg border-b-2 border-green-500 pb-2 mb-3 text-green-700">
                        資產
                      </h3>
                      {report.assets.details.map((item, i) => (
                        <div key={i} className="item flex justify-between py-1 border-b border-dotted">
                          <span>{item.account}</span>
                          <span className="font-mono">{formatAmount(item.balance)}</span>
                        </div>
                      ))}
                      <div className="total flex justify-between py-2 font-bold border-t-2 mt-2">
                        <span>資產合計</span>
                        <span className="font-mono text-green-600">{formatAmount(report.assets.total)}</span>
                      </div>
                    </div>

                    {/* 負債 */}
                    <div className="section">
                      <h3 className="section-title font-bold text-lg border-b-2 border-red-500 pb-2 mb-3 text-red-700">
                        負債
                      </h3>
                      {report.liabilities.details.map((item, i) => (
                        <div key={i} className="item flex justify-between py-1 border-b border-dotted">
                          <span>{item.account}</span>
                          <span className="font-mono">{formatAmount(item.balance)}</span>
                        </div>
                      ))}
                      <div className="total flex justify-between py-2 font-bold border-t-2 mt-2">
                        <span>負債合計</span>
                        <span className="font-mono text-red-600">{formatAmount(report.liabilities.total)}</span>
                      </div>
                    </div>

                    {/* 權益 */}
                    <div className="section">
                      <h3 className="section-title font-bold text-lg border-b-2 border-blue-500 pb-2 mb-3 text-blue-700">
                        權益
                      </h3>
                      {report.equity.details.map((item, i) => (
                        <div key={i} className="item flex justify-between py-1 border-b border-dotted">
                          <span>{item.account}</span>
                          <span className="font-mono">{formatAmount(item.balance)}</span>
                        </div>
                      ))}
                      <div className="total flex justify-between py-2 font-bold border-t-2 mt-2">
                        <span>權益合計</span>
                        <span className="font-mono text-blue-600">{formatAmount(report.equity.total)}</span>
                      </div>
                    </div>

                    {/* 負債及權益合計 */}
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex justify-between font-bold text-lg">
                        <span>負債及權益合計</span>
                        <span className="font-mono">
                          {formatAmount(report.liabilities.total + report.equity.total)}
                        </span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="assets" className="mt-4">
                    <div className="section">
                      <h3 className="font-bold text-lg mb-4 text-green-700">資產明細</h3>
                      {report.assets.details.map((item, i) => (
                        <div key={i} className="flex justify-between py-2 border-b">
                          <span>{item.account}</span>
                          <span className="font-mono">{formatAmount(item.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-3 font-bold text-lg border-t-2 mt-2">
                        <span>資產合計</span>
                        <span className="font-mono text-green-600">{formatAmount(report.assets.total)}</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="liabilities" className="mt-4">
                    <div className="section">
                      <h3 className="font-bold text-lg mb-4 text-red-700">負債明細</h3>
                      {report.liabilities.details.map((item, i) => (
                        <div key={i} className="flex justify-between py-2 border-b">
                          <span>{item.account}</span>
                          <span className="font-mono">{formatAmount(item.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-3 font-bold text-lg border-t-2 mt-2">
                        <span>負債合計</span>
                        <span className="font-mono text-red-600">{formatAmount(report.liabilities.total)}</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="equity" className="mt-4">
                    <div className="section">
                      <h3 className="font-bold text-lg mb-4 text-blue-700">權益明細</h3>
                      {report.equity.details.map((item, i) => (
                        <div key={i} className="flex justify-between py-2 border-b">
                          <span>{item.account}</span>
                          <span className="font-mono">{formatAmount(item.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-3 font-bold text-lg border-t-2 mt-2">
                        <span>權益合計</span>
                        <span className="font-mono text-blue-600">{formatAmount(report.equity.total)}</span>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedCompanyId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            請選擇公司和日期以查看資產負債表
          </CardContent>
        </Card>
      )}
    </div>
  )
}
