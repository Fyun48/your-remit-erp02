'use client'

import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  FileText,
  Loader2,
  Printer,
  FileSpreadsheet,
  Calendar,
  Users,
  Wallet,
  TrendingDown,
  BarChart3,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { exportTableToPDF, formatAmountForPDF } from '@/lib/pdf-export'

interface PayrollReportsProps {
  companyId: string
  companyName: string
}

export default function PayrollReports({ companyId, companyName }: PayrollReportsProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const currentYear = new Date().getFullYear()

  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [selectedTab, setSelectedTab] = useState('monthly')

  const { data: monthlyData, isLoading } = trpc.payroll.getSummaryReport.useQuery({
    companyId,
    year: parseInt(selectedYear),
  })

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // 計算年度總計
  const totals = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) {
      return {
        employeeCount: 0,
        grossPay: 0,
        totalDeduction: 0,
        netPay: 0,
        laborInsurance: 0,
        healthInsurance: 0,
        incomeTax: 0,
      }
    }

    return monthlyData.reduce((acc, m) => ({
      employeeCount: Math.max(acc.employeeCount, m.employeeCount),
      grossPay: acc.grossPay + m.totalGrossPay,
      totalDeduction: acc.totalDeduction + m.totalDeduction,
      netPay: acc.netPay + m.totalNetPay,
      laborInsurance: acc.laborInsurance + m.totalLaborInsurance,
      healthInsurance: acc.healthInsurance + m.totalHealthInsurance,
      incomeTax: acc.incomeTax + m.totalIncomeTax,
    }), {
      employeeCount: 0,
      grossPay: 0,
      totalDeduction: 0,
      netPay: 0,
      laborInsurance: 0,
      healthInsurance: 0,
      incomeTax: 0,
    })
  }, [monthlyData])

  const formatAmount = (amount: number | string | { toString(): string } | null | undefined) => {
    if (amount === null || amount === undefined) return '0'
    const num = typeof amount === 'string' ? parseFloat(amount) :
                typeof amount === 'number' ? amount : parseFloat(amount.toString())
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>薪資報表</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body {
            font-family: 'Microsoft JhengHei', sans-serif;
            font-size: 9pt;
            line-height: 1.4;
          }
          .header { text-align: center; margin-bottom: 15px; }
          .header h1 { font-size: 16pt; margin: 0; }
          .header h2 { font-size: 12pt; margin: 5px 0; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
          th { background: #f0f0f0; font-weight: bold; }
          td.left { text-align: left; }
          td.right { text-align: right; font-family: monospace; }
          .summary { background: #e8f4e8; font-weight: bold; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${companyName}</h1>
          <h2>${selectedYear} 年度薪資報表</h2>
        </div>
        ${printContent.innerHTML}
        <div style="margin-top: 20px; text-align: right;">
          列印日期：${new Date().toLocaleDateString('zh-TW')}
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExportExcel = () => {
    if (!monthlyData) return

    const rows: string[][] = []
    rows.push([`${companyName} - ${selectedYear} 年度薪資報表`])
    rows.push([])

    // 月度彙總
    rows.push(['月度薪資彙總'])
    rows.push(['月份', '人數', '應發總額', '扣除總額', '實發總額'])

    monthlyData.forEach(m => {
      rows.push([
        `${m.month}月`,
        String(m.employeeCount),
        String(m.totalGrossPay),
        String(m.totalDeduction),
        String(m.totalNetPay),
      ])
    })

    rows.push([])
    rows.push(['年度合計', '', String(totals.grossPay), String(totals.totalDeduction), String(totals.netPay)])

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `薪資報表_${companyName}_${selectedYear}年度.csv`
    link.click()
  }

  const handleExportPDF = () => {
    if (!monthlyData) return

    const headers = ['月份', '人數', '應發總額', '勞保', '健保', '所得稅', '扣除總額', '實發總額']
    const data = monthlyData.map(m => [
      `${m.month}月`,
      String(m.employeeCount),
      formatAmountForPDF(m.totalGrossPay),
      formatAmountForPDF(m.totalLaborInsurance),
      formatAmountForPDF(m.totalHealthInsurance),
      formatAmountForPDF(m.totalIncomeTax),
      formatAmountForPDF(m.totalDeduction),
      formatAmountForPDF(m.totalNetPay),
    ])

    // 加入合計列
    data.push([
      '年度合計',
      '',
      formatAmountForPDF(totals.grossPay),
      formatAmountForPDF(totals.laborInsurance),
      formatAmountForPDF(totals.healthInsurance),
      formatAmountForPDF(totals.incomeTax),
      formatAmountForPDF(totals.totalDeduction),
      formatAmountForPDF(totals.netPay),
    ])

    exportTableToPDF({
      title: '薪資彙總報表',
      company: companyName,
      period: `${selectedYear} 年度`,
      headers,
      data,
      filename: `薪資報表_${companyName}_${selectedYear}年度`,
      orientation: 'landscape',
    })
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
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hr/payroll">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              薪資報表
            </h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText className="h-4 w-4 mr-2" />
            匯出 PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            匯出 Excel
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            列印
          </Button>
        </div>
      </div>

      {/* 年度彙總卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總員工人數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.employeeCount}</div>
            <p className="text-xs text-muted-foreground">位員工</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">年度應發總額</CardTitle>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatAmount(totals.grossPay)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">年度扣除總額</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatAmount(totals.totalDeduction)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">年度實發總額</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatAmount(totals.netPay)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 報表內容 */}
      <Card>
        <CardHeader>
          <CardTitle>{selectedYear} 年度薪資彙總</CardTitle>
          <CardDescription>
            各月份薪資發放統計
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="monthly">
                <Calendar className="h-4 w-4 mr-2" />
                月度彙總
              </TabsTrigger>
              <TabsTrigger value="deductions">
                <BarChart3 className="h-4 w-4 mr-2" />
                扣除項明細
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monthly">
              <div ref={printRef}>
                {monthlyData && monthlyData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>月份</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead className="text-center">人數</TableHead>
                        <TableHead className="text-right">應發總額</TableHead>
                        <TableHead className="text-right">勞保</TableHead>
                        <TableHead className="text-right">健保</TableHead>
                        <TableHead className="text-right">所得稅</TableHead>
                        <TableHead className="text-right">扣除總額</TableHead>
                        <TableHead className="text-right font-bold">實發總額</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyData.map((m) => (
                        <TableRow key={m.month}>
                          <TableCell className="font-medium">{m.month} 月</TableCell>
                          <TableCell>
                            <Badge variant={m.status === 'PAID' ? 'default' : 'secondary'}>
                              {m.status === 'PAID' ? '已發放' :
                               m.status === 'APPROVED' ? '已核准' :
                               m.status === 'CALCULATED' ? '已計算' : '草稿'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{m.employeeCount}</TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatAmount(m.totalGrossPay)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-500">
                            {formatAmount(m.totalLaborInsurance)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-500">
                            {formatAmount(m.totalHealthInsurance)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-500">
                            {formatAmount(m.totalIncomeTax)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {formatAmount(m.totalDeduction)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-blue-600">
                            {formatAmount(m.totalNetPay)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50 font-bold">
                        <TableCell colSpan={3}>年度合計</TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {formatAmount(totals.grossPay)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-500">
                          {formatAmount(totals.laborInsurance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-500">
                          {formatAmount(totals.healthInsurance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-500">
                          {formatAmount(totals.incomeTax)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {formatAmount(totals.totalDeduction)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600">
                          {formatAmount(totals.netPay)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">尚無薪資資料</h3>
                    <p className="text-muted-foreground">
                      選定年度尚無已計算的薪資期間
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="deductions">
              {totals.grossPay > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">勞保費用</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          {formatAmount(totals.laborInsurance)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          佔扣除 {totals.totalDeduction > 0 ? ((totals.laborInsurance / totals.totalDeduction) * 100).toFixed(1) : '0'}%
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">健保費用</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          {formatAmount(totals.healthInsurance)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          佔扣除 {totals.totalDeduction > 0 ? ((totals.healthInsurance / totals.totalDeduction) * 100).toFixed(1) : '0'}%
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">所得稅代扣</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          {formatAmount(totals.incomeTax)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          佔扣除 {totals.totalDeduction > 0 ? ((totals.incomeTax / totals.totalDeduction) * 100).toFixed(1) : '0'}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">扣除項比例</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>勞保</span>
                            <span>{totals.totalDeduction > 0 ? ((totals.laborInsurance / totals.totalDeduction) * 100).toFixed(1) : '0'}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-blue-500 rounded-full"
                              style={{ width: `${totals.totalDeduction > 0 ? (totals.laborInsurance / totals.totalDeduction) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>健保</span>
                            <span>{totals.totalDeduction > 0 ? ((totals.healthInsurance / totals.totalDeduction) * 100).toFixed(1) : '0'}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-green-500 rounded-full"
                              style={{ width: `${totals.totalDeduction > 0 ? (totals.healthInsurance / totals.totalDeduction) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>所得稅</span>
                            <span>{totals.totalDeduction > 0 ? ((totals.incomeTax / totals.totalDeduction) * 100).toFixed(1) : '0'}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-orange-500 rounded-full"
                              style={{ width: `${totals.totalDeduction > 0 ? (totals.incomeTax / totals.totalDeduction) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">尚無扣除資料</h3>
                  <p className="text-muted-foreground">
                    選定年度尚無已計算的薪資期間
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
