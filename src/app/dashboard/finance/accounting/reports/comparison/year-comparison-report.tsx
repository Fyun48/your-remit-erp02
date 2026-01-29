'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft,
  Loader2,
  Printer,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Scale,
  Lock,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { exportComparisonToPDF } from '@/lib/pdf-export'

interface YearComparisonReportProps {
  assignments: {
    companyId: string
    company: {
      id: string
      name: string
    }
  }[]
  initialCompanyId: string
}

export default function YearComparisonReport({ assignments, initialCompanyId }: YearComparisonReportProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const currentYear = new Date().getFullYear()

  const [selectedCompanyId] = useState<string>(initialCompanyId)
  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear - 1, currentYear])
  const [reportType, setReportType] = useState<'income' | 'balance'>('income')

  const { data: incomeComparison, isLoading: incomeLoading } = trpc.financialReport.incomeStatementComparison.useQuery(
    { companyId: selectedCompanyId, years: selectedYears.sort((a, b) => a - b) },
    { enabled: !!selectedCompanyId && selectedYears.length >= 2 && reportType === 'income' }
  )

  const { data: balanceComparison, isLoading: balanceLoading } = trpc.financialReport.balanceSheetComparison.useQuery(
    { companyId: selectedCompanyId, years: selectedYears.sort((a, b) => a - b) },
    { enabled: !!selectedCompanyId && selectedYears.length >= 2 && reportType === 'balance' }
  )

  const isLoading = incomeLoading || balanceLoading
  const companyName = assignments.find(a => a.companyId === selectedCompanyId)?.company.name || ''

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('zh-TW').format(amount)
  }

  const formatPercent = (percent: number | null) => {
    if (percent === null) return '-'
    return `${percent > 0 ? '+' : ''}${percent}%`
  }

  const getChangeIcon = (change: number | null) => {
    if (change === null) return <Minus className="h-4 w-4 text-gray-400" />
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getChangeColor = (change: number | null, inverse: boolean = false) => {
    if (change === null) return 'text-gray-400'
    if (inverse) {
      return change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-600'
    }
    return change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'
  }

  const handleYearToggle = (year: number) => {
    if (selectedYears.includes(year)) {
      if (selectedYears.length > 2) {
        setSelectedYears(selectedYears.filter(y => y !== year))
      }
    } else {
      if (selectedYears.length < 3) {
        setSelectedYears([...selectedYears, year])
      }
    }
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
        <title>歷年比較報表 - ${companyName}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body {
            font-family: 'Microsoft JhengHei', sans-serif;
            font-size: 10pt;
            padding: 20px;
          }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 18pt; margin: 0; }
          .header h2 { font-size: 14pt; margin: 5px 0; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #333; padding: 6px 8px; }
          th { background: #f0f0f0; font-weight: bold; }
          td.right { text-align: right; font-family: monospace; }
          .positive { color: green; }
          .negative { color: red; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${companyName}</h1>
          <h2>${reportType === 'income' ? '損益表' : '資產負債表'}歷年比較</h2>
          <p>${selectedYears.sort((a, b) => a - b).join(' / ')} 年度</p>
        </div>
        ${printContent.innerHTML}
        <div style="margin-top: 20px; text-align: right; font-size: 9pt; color: #666;">
          列印日期：${new Date().toLocaleDateString('zh-TW')}
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExportExcel = () => {
    const rows: string[][] = []
    rows.push([`${companyName} - ${reportType === 'income' ? '損益表' : '資產負債表'}歷年比較`])
    rows.push([`年度: ${selectedYears.sort((a, b) => a - b).join(' / ')}`])
    rows.push([])

    if (reportType === 'income' && incomeComparison) {
      rows.push(['項目', ...incomeComparison.data.flatMap(d => [`${d.year}年`, '增減', '增減%'])])
      rows.push(['營業收入', ...incomeComparison.data.flatMap(d => [
        String(d.revenue),
        d.revenueChange !== null ? String(d.revenueChange) : '-',
        d.revenueChangePercent !== null ? `${d.revenueChangePercent}%` : '-'
      ])])
      rows.push(['營業費用', ...incomeComparison.data.flatMap(d => [
        String(d.expenses),
        d.expensesChange !== null ? String(d.expensesChange) : '-',
        d.expensesChangePercent !== null ? `${d.expensesChangePercent}%` : '-'
      ])])
      rows.push(['淨利(損)', ...incomeComparison.data.flatMap(d => [
        String(d.netIncome),
        d.netIncomeChange !== null ? String(d.netIncomeChange) : '-',
        d.netIncomeChangePercent !== null ? `${d.netIncomeChangePercent}%` : '-'
      ])])
    } else if (reportType === 'balance' && balanceComparison) {
      rows.push(['項目', ...balanceComparison.data.flatMap(d => [`${d.year}年`, '增減', '增減%'])])
      rows.push(['資產總額', ...balanceComparison.data.flatMap(d => [
        String(d.assets),
        d.assetsChange !== null ? String(d.assetsChange) : '-',
        d.assetsChangePercent !== null ? `${d.assetsChangePercent}%` : '-'
      ])])
      rows.push(['負債總額', ...balanceComparison.data.flatMap(d => [
        String(d.liabilities),
        d.liabilitiesChange !== null ? String(d.liabilitiesChange) : '-',
        d.liabilitiesChangePercent !== null ? `${d.liabilitiesChangePercent}%` : '-'
      ])])
      rows.push(['股東權益', ...balanceComparison.data.flatMap(d => [
        String(d.equity),
        d.equityChange !== null ? String(d.equityChange) : '-',
        d.equityChangePercent !== null ? `${d.equityChangePercent}%` : '-'
      ])])
    }

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `歷年比較_${companyName}_${selectedYears.join('-')}.csv`
    link.click()
  }

  const handleExportPDF = () => {
    const sortedYears = selectedYears.sort((a, b) => a - b)

    if (reportType === 'income' && incomeComparison) {
      const categories = ['營業收入', '營業費用', '淨利(損)']
      const data = categories.map((category) => {
        const values: Record<number, number> = {}
        const changes: Record<string, { amount: number; percentage: number }> = {}

        incomeComparison.data.forEach((d, i) => {
          if (category === '營業收入') {
            values[d.year] = d.revenue
            if (i > 0 && d.revenueChange !== null && d.revenueChangePercent !== null) {
              changes[`${d.year}_${incomeComparison.data[i-1].year}`] = {
                amount: d.revenueChange,
                percentage: d.revenueChangePercent,
              }
            }
          } else if (category === '營業費用') {
            values[d.year] = d.expenses
            if (i > 0 && d.expensesChange !== null && d.expensesChangePercent !== null) {
              changes[`${d.year}_${incomeComparison.data[i-1].year}`] = {
                amount: d.expensesChange,
                percentage: d.expensesChangePercent,
              }
            }
          } else {
            values[d.year] = d.netIncome
            if (i > 0 && d.netIncomeChange !== null && d.netIncomeChangePercent !== null) {
              changes[`${d.year}_${incomeComparison.data[i-1].year}`] = {
                amount: d.netIncomeChange,
                percentage: d.netIncomeChangePercent,
              }
            }
          }
        })

        return { category, values, changes }
      })

      exportComparisonToPDF({
        company: companyName,
        reportType: 'income-statement',
        years: sortedYears,
        data,
        filename: `損益表比較_${companyName}_${sortedYears.join('-')}`,
      })
    } else if (reportType === 'balance' && balanceComparison) {
      const categories = ['資產總額', '負債總額', '股東權益']
      const data = categories.map((category) => {
        const values: Record<number, number> = {}
        const changes: Record<string, { amount: number; percentage: number }> = {}

        balanceComparison.data.forEach((d, i) => {
          if (category === '資產總額') {
            values[d.year] = d.assets
            if (i > 0 && d.assetsChange !== null && d.assetsChangePercent !== null) {
              changes[`${d.year}_${balanceComparison.data[i-1].year}`] = {
                amount: d.assetsChange,
                percentage: d.assetsChangePercent,
              }
            }
          } else if (category === '負債總額') {
            values[d.year] = d.liabilities
            if (i > 0 && d.liabilitiesChange !== null && d.liabilitiesChangePercent !== null) {
              changes[`${d.year}_${balanceComparison.data[i-1].year}`] = {
                amount: d.liabilitiesChange,
                percentage: d.liabilitiesChangePercent,
              }
            }
          } else {
            values[d.year] = d.equity
            if (i > 0 && d.equityChange !== null && d.equityChangePercent !== null) {
              changes[`${d.year}_${balanceComparison.data[i-1].year}`] = {
                amount: d.equityChange,
                percentage: d.equityChangePercent,
              }
            }
          }
        })

        return { category, values, changes }
      })

      exportComparisonToPDF({
        company: companyName,
        reportType: 'balance-sheet',
        years: sortedYears,
        data,
        filename: `資產負債表比較_${companyName}_${sortedYears.join('-')}`,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/finance/accounting/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              歷年比較報表
            </h1>
            <p className="text-muted-foreground">
              財務報表年度比較分析
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF} disabled={!selectedCompanyId || selectedYears.length < 2}>
            <FileText className="h-4 w-4 mr-2" />
            匯出 PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={!selectedCompanyId || selectedYears.length < 2}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            匯出 Excel
          </Button>
          <Button onClick={handlePrint} disabled={!selectedCompanyId || selectedYears.length < 2}>
            <Printer className="h-4 w-4 mr-2" />
            列印
          </Button>
        </div>
      </div>

      {/* 篩選條件 */}
      <Card>
        <CardHeader>
          <CardTitle>報表設定</CardTitle>
          <CardDescription>選擇比較年度</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">公司</label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted text-sm">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{companyName}</span>
              </div>
              <p className="text-xs text-muted-foreground">如需變更公司請返回報表首頁</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">報表類型</label>
              <Tabs value={reportType} onValueChange={(v) => setReportType(v as 'income' | 'balance')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="income">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    損益表
                  </TabsTrigger>
                  <TabsTrigger value="balance">
                    <Scale className="h-4 w-4 mr-2" />
                    資產負債表
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">比較年度 (選擇 2-3 年)</label>
            <div className="flex flex-wrap gap-4">
              {years.map(year => (
                <label key={year} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={selectedYears.includes(year)}
                    onCheckedChange={() => handleYearToggle(year)}
                    disabled={!selectedYears.includes(year) && selectedYears.length >= 3}
                  />
                  <span className="text-sm">{year} 年</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              已選擇 {selectedYears.length} 年: {selectedYears.sort((a, b) => a - b).join(', ')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 報表內容 */}
      {selectedCompanyId && selectedYears.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {reportType === 'income' ? '損益表' : '資產負債表'}歷年比較
            </CardTitle>
            <CardDescription>
              {companyName} - {selectedYears.sort((a, b) => a - b).join(' / ')} 年度
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div ref={printRef}>
                {reportType === 'income' && incomeComparison && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">項目</TableHead>
                        {incomeComparison.data.map((d, i) => (
                          <TableHead key={d.year} colSpan={i === 0 ? 1 : 3} className="text-center">
                            {d.year} 年 {i > 0 && <span className="text-xs text-muted-foreground">(含增減)</span>}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* 營業收入 */}
                      <TableRow>
                        <TableCell className="font-medium">營業收入</TableCell>
                        {incomeComparison.data.map((d, i) => (
                          i === 0 ? (
                            <TableCell key={d.year} className="text-right font-mono">
                              {formatAmount(d.revenue)}
                            </TableCell>
                          ) : (
                            <>
                              <TableCell key={`${d.year}-value`} className="text-right font-mono">
                                {formatAmount(d.revenue)}
                              </TableCell>
                              <TableCell key={`${d.year}-change`} className={`text-right font-mono ${getChangeColor(d.revenueChange)}`}>
                                <div className="flex items-center justify-end gap-1">
                                  {getChangeIcon(d.revenueChange)}
                                  {formatAmount(d.revenueChange)}
                                </div>
                              </TableCell>
                              <TableCell key={`${d.year}-percent`} className={`text-right font-mono ${getChangeColor(d.revenueChangePercent)}`}>
                                {formatPercent(d.revenueChangePercent)}
                              </TableCell>
                            </>
                          )
                        ))}
                      </TableRow>

                      {/* 營業費用 */}
                      <TableRow>
                        <TableCell className="font-medium">營業費用</TableCell>
                        {incomeComparison.data.map((d, i) => (
                          i === 0 ? (
                            <TableCell key={d.year} className="text-right font-mono text-red-600">
                              {formatAmount(d.expenses)}
                            </TableCell>
                          ) : (
                            <>
                              <TableCell key={`${d.year}-value`} className="text-right font-mono text-red-600">
                                {formatAmount(d.expenses)}
                              </TableCell>
                              <TableCell key={`${d.year}-change`} className={`text-right font-mono ${getChangeColor(d.expensesChange, true)}`}>
                                <div className="flex items-center justify-end gap-1">
                                  {getChangeIcon(d.expensesChange)}
                                  {formatAmount(d.expensesChange)}
                                </div>
                              </TableCell>
                              <TableCell key={`${d.year}-percent`} className={`text-right font-mono ${getChangeColor(d.expensesChangePercent, true)}`}>
                                {formatPercent(d.expensesChangePercent)}
                              </TableCell>
                            </>
                          )
                        ))}
                      </TableRow>

                      {/* 淨利 */}
                      <TableRow className="bg-gray-50 font-bold">
                        <TableCell>淨利(損)</TableCell>
                        {incomeComparison.data.map((d, i) => (
                          i === 0 ? (
                            <TableCell key={d.year} className={`text-right font-mono ${d.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatAmount(d.netIncome)}
                            </TableCell>
                          ) : (
                            <>
                              <TableCell key={`${d.year}-value`} className={`text-right font-mono ${d.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatAmount(d.netIncome)}
                              </TableCell>
                              <TableCell key={`${d.year}-change`} className={`text-right font-mono ${getChangeColor(d.netIncomeChange)}`}>
                                <div className="flex items-center justify-end gap-1">
                                  {getChangeIcon(d.netIncomeChange)}
                                  {formatAmount(d.netIncomeChange)}
                                </div>
                              </TableCell>
                              <TableCell key={`${d.year}-percent`} className={`text-right font-mono ${getChangeColor(d.netIncomeChangePercent)}`}>
                                {formatPercent(d.netIncomeChangePercent)}
                              </TableCell>
                            </>
                          )
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                )}

                {reportType === 'balance' && balanceComparison && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">項目</TableHead>
                        {balanceComparison.data.map((d, i) => (
                          <TableHead key={d.year} colSpan={i === 0 ? 1 : 3} className="text-center">
                            {d.year} 年底 {i > 0 && <span className="text-xs text-muted-foreground">(含增減)</span>}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* 資產 */}
                      <TableRow>
                        <TableCell className="font-medium">資產總額</TableCell>
                        {balanceComparison.data.map((d, i) => (
                          i === 0 ? (
                            <TableCell key={d.year} className="text-right font-mono">
                              {formatAmount(d.assets)}
                            </TableCell>
                          ) : (
                            <>
                              <TableCell key={`${d.year}-value`} className="text-right font-mono">
                                {formatAmount(d.assets)}
                              </TableCell>
                              <TableCell key={`${d.year}-change`} className={`text-right font-mono ${getChangeColor(d.assetsChange)}`}>
                                <div className="flex items-center justify-end gap-1">
                                  {getChangeIcon(d.assetsChange)}
                                  {formatAmount(d.assetsChange)}
                                </div>
                              </TableCell>
                              <TableCell key={`${d.year}-percent`} className={`text-right font-mono ${getChangeColor(d.assetsChangePercent)}`}>
                                {formatPercent(d.assetsChangePercent)}
                              </TableCell>
                            </>
                          )
                        ))}
                      </TableRow>

                      {/* 負債 */}
                      <TableRow>
                        <TableCell className="font-medium">負債總額</TableCell>
                        {balanceComparison.data.map((d, i) => (
                          i === 0 ? (
                            <TableCell key={d.year} className="text-right font-mono text-red-600">
                              {formatAmount(d.liabilities)}
                            </TableCell>
                          ) : (
                            <>
                              <TableCell key={`${d.year}-value`} className="text-right font-mono text-red-600">
                                {formatAmount(d.liabilities)}
                              </TableCell>
                              <TableCell key={`${d.year}-change`} className={`text-right font-mono ${getChangeColor(d.liabilitiesChange, true)}`}>
                                <div className="flex items-center justify-end gap-1">
                                  {getChangeIcon(d.liabilitiesChange)}
                                  {formatAmount(d.liabilitiesChange)}
                                </div>
                              </TableCell>
                              <TableCell key={`${d.year}-percent`} className={`text-right font-mono ${getChangeColor(d.liabilitiesChangePercent, true)}`}>
                                {formatPercent(d.liabilitiesChangePercent)}
                              </TableCell>
                            </>
                          )
                        ))}
                      </TableRow>

                      {/* 權益 */}
                      <TableRow className="bg-gray-50 font-bold">
                        <TableCell>股東權益</TableCell>
                        {balanceComparison.data.map((d, i) => (
                          i === 0 ? (
                            <TableCell key={d.year} className={`text-right font-mono ${d.equity >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {formatAmount(d.equity)}
                            </TableCell>
                          ) : (
                            <>
                              <TableCell key={`${d.year}-value`} className={`text-right font-mono ${d.equity >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {formatAmount(d.equity)}
                              </TableCell>
                              <TableCell key={`${d.year}-change`} className={`text-right font-mono ${getChangeColor(d.equityChange)}`}>
                                <div className="flex items-center justify-end gap-1">
                                  {getChangeIcon(d.equityChange)}
                                  {formatAmount(d.equityChange)}
                                </div>
                              </TableCell>
                              <TableCell key={`${d.year}-percent`} className={`text-right font-mono ${getChangeColor(d.equityChangePercent)}`}>
                                {formatPercent(d.equityChangePercent)}
                              </TableCell>
                            </>
                          )
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 說明 */}
      <Card>
        <CardHeader>
          <CardTitle>說明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span>綠色增減表示正向成長（收入/資產/權益增加，或費用/負債減少）</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span>紅色增減表示負向變化（收入/資產/權益減少，或費用/負債增加）</span>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="h-4 w-4 text-gray-400" />
            <span>第一年無比較基準，故不顯示增減數據</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
