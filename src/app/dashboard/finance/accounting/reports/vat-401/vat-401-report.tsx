'use client'

import { useState, useRef } from 'react'
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
  FileText,
  Receipt,
  Calculator,
  AlertCircle,
  Lock,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

const PERIODS = [
  { value: '1', label: '1-2月 (1期)' },
  { value: '2', label: '3-4月 (2期)' },
  { value: '3', label: '5-6月 (3期)' },
  { value: '4', label: '7-8月 (4期)' },
  { value: '5', label: '9-10月 (5期)' },
  { value: '6', label: '11-12月 (6期)' },
]

interface Vat401ReportProps {
  assignments: {
    companyId: string
    company: {
      id: string
      name: string
    }
  }[]
  initialCompanyId: string
}

export function Vat401Report({ assignments, initialCompanyId }: Vat401ReportProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const currentPeriod = Math.ceil(currentMonth / 2)

  const [selectedCompanyId] = useState<string>(initialCompanyId)
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear))
  const [selectedPeriod, setSelectedPeriod] = useState<string>(String(currentPeriod))

  // 取得公司名稱
  const companyName = assignments.find(a => a.companyId === selectedCompanyId)?.company.name || ''

  // 取得 401 報表資料
  const { data: report, isLoading } = trpc.financialReport.vat401.useQuery(
    {
      companyId: selectedCompanyId,
      year: parseInt(selectedYear),
      period: parseInt(selectedPeriod),
    },
    { enabled: !!selectedCompanyId && !!selectedYear && !!selectedPeriod }
  )

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // 產生年份選項 (近5年)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // 列印功能 (符合財政部格式)
  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>營業人銷售額與稅額申報書(401)</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: 'Microsoft JhengHei', 'SimHei', sans-serif;
            font-size: 10pt;
            line-height: 1.4;
          }
          .form-container {
            border: 2px solid #000;
            padding: 0;
          }
          .form-header {
            text-align: center;
            padding: 10px;
            border-bottom: 2px solid #000;
          }
          .form-title {
            font-size: 16pt;
            font-weight: bold;
            letter-spacing: 3px;
          }
          .form-subtitle {
            font-size: 10pt;
            margin-top: 5px;
          }
          .form-code {
            position: absolute;
            right: 20px;
            top: 10px;
            font-size: 12pt;
            font-weight: bold;
          }
          .company-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-bottom: 1px solid #000;
            padding: 8px;
          }
          .company-info div {
            padding: 3px 0;
          }
          .section {
            border-bottom: 1px solid #000;
          }
          .section-title {
            background: #f0f0f0;
            font-weight: bold;
            padding: 5px 10px;
            border-bottom: 1px solid #000;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
          }
          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 5px 8px;
            text-align: center;
          }
          .data-table th {
            background: #f5f5f5;
            font-weight: normal;
          }
          .data-table td.amount {
            text-align: right;
            font-family: monospace;
          }
          .data-table td.label {
            text-align: left;
          }
          .summary-section {
            padding: 10px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px dotted #999;
          }
          .summary-total {
            font-size: 14pt;
            font-weight: bold;
            background: #fff8e1;
            padding: 10px;
            margin-top: 10px;
          }
          .footer {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            padding: 15px 10px;
            border-top: 2px solid #000;
          }
          .signature-box {
            text-align: center;
            padding-top: 30px;
            border-bottom: 1px solid #000;
            margin: 0 10px;
          }
          .signature-label {
            font-size: 9pt;
          }
          .print-info {
            text-align: right;
            font-size: 8pt;
            color: #666;
            margin-top: 10px;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
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
      ['營業人銷售額與稅額申報書(401)'],
      [`營業人名稱: ${report.company.name}`],
      [`統一編號: ${report.company.taxId}`],
      [`申報期間: 民國${report.period.rocYear}年 ${report.period.periodLabel}`],
      [''],
      ['一、銷項'],
      ['項目', '銷售額', '稅額', '發票張數'],
      ['應稅銷售額(5%)', String(report.sales.taxable), String(report.sales.outputTax), String(report.sales.invoiceCount)],
      ['零稅率銷售額', String(report.sales.zeroRated), '0', '0'],
      ['免稅銷售額', String(report.sales.exempt), '-', '0'],
      ['銷項合計', String(report.sales.total), String(report.summary.outputTax), ''],
      [''],
      ['二、進項'],
      ['項目', '進項額', '稅額', '發票張數'],
      ['進項稅額(可扣抵)', String(report.purchases.deductible), String(report.purchases.inputTax), String(report.purchases.invoiceCount)],
      ['固定資產', String(report.purchases.fixedAssets), '', ''],
      ['不可扣抵', String(report.purchases.nonDeductible), '', ''],
      ['進項合計', String(report.purchases.total), String(report.summary.inputTax), ''],
      [''],
      ['三、稅額計算'],
      ['銷項稅額', String(report.summary.outputTax)],
      ['進項稅額', String(report.summary.inputTax)],
      [report.summary.isRefund ? '本期應退稅額' : '本期應繳稅額', String(Math.abs(report.summary.taxPayable))],
    ]

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `401申報書_${report.company.name}_${report.period.rocYear}年${report.period.periodNo}期.csv`
    link.click()
  }

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
            <h1 className="text-2xl font-bold">401 營業稅申報書</h1>
            <p className="text-muted-foreground">營業人銷售額與稅額申報書 - 每期兩個月申報</p>
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
              列印申報書
            </Button>
          </div>
        )}
      </div>

      {/* 篩選區 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">申報期間</CardTitle>
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

            <div className="w-32">
              <label className="text-sm font-medium mb-2 block">年度</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={String(year)}>
                      {year} ({year - 1911})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <label className="text-sm font-medium mb-2 block">期別</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  <Receipt className="h-4 w-4 text-blue-500" />
                  銷項稅額
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-xl font-bold text-blue-600">
                  {formatAmount(report.summary.outputTax)}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  進項稅額
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-xl font-bold text-green-600">
                  {formatAmount(report.summary.inputTax)}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-purple-500" />
                  稅額差額
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className={`text-xl font-bold ${report.summary.taxPayable >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {report.summary.taxPayable >= 0 ? '' : '-'}{formatAmount(Math.abs(report.summary.taxPayable))}
                </span>
              </CardContent>
            </Card>

            <Card className={report.summary.isRefund ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {report.summary.isRefund ? '應退稅額' : '應繳稅額'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-xl font-bold ${report.summary.isRefund ? 'text-green-600' : 'text-red-600'}`}>
                    {formatAmount(Math.abs(report.summary.taxPayable))}
                  </span>
                  <Badge variant={report.summary.isRefund ? 'default' : 'destructive'}>
                    {report.summary.isRefund ? '退稅' : '繳稅'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 正式申報書格式 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                申報書預覽
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={printRef}>
                <div className="border-2 border-black bg-white">
                  {/* 表頭 */}
                  <div className="text-center py-4 border-b-2 border-black relative">
                    <div className="absolute right-4 top-2 text-lg font-bold">401</div>
                    <div className="text-xl font-bold tracking-widest">
                      營業人銷售額與稅額申報書
                    </div>
                    <div className="text-sm mt-1">
                      (一般稅額計算-專營應稅營業人使用)
                    </div>
                  </div>

                  {/* 公司資訊 */}
                  <div className="grid grid-cols-2 border-b border-black text-sm">
                    <div className="p-2 border-r border-black">
                      <span className="text-muted-foreground">營業人名稱：</span>
                      <span className="font-bold">{report.company.name}</span>
                    </div>
                    <div className="p-2">
                      <span className="text-muted-foreground">統一編號：</span>
                      <span className="font-mono font-bold">{report.company.taxId || '未設定'}</span>
                    </div>
                    <div className="p-2 border-r border-black border-t">
                      <span className="text-muted-foreground">營業地址：</span>
                      <span>{report.company.address || '未設定'}</span>
                    </div>
                    <div className="p-2 border-t">
                      <span className="text-muted-foreground">申報期間：</span>
                      <span className="font-bold">
                        民國 {report.period.rocYear} 年 {report.period.periodLabel}
                      </span>
                    </div>
                  </div>

                  {/* 銷項區塊 */}
                  <div className="border-b border-black">
                    <div className="bg-blue-50 font-bold py-2 px-4 border-b border-black flex items-center gap-2">
                      <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-sm">壹</span>
                      銷項
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border-b border-r border-black p-2 w-8">欄</th>
                          <th className="border-b border-r border-black p-2">項目</th>
                          <th className="border-b border-r border-black p-2 w-32">銷售額</th>
                          <th className="border-b border-r border-black p-2 w-32">稅額</th>
                          <th className="border-b border-black p-2 w-20">發票張數</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border-b border-r border-black p-2 text-center">1</td>
                          <td className="border-b border-r border-black p-2">應稅銷售額 (稅率 5%)</td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.sales.taxable)}
                          </td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.sales.outputTax)}
                          </td>
                          <td className="border-b border-black p-2 text-center">
                            {report.sales.invoiceCount}
                          </td>
                        </tr>
                        <tr>
                          <td className="border-b border-r border-black p-2 text-center">2</td>
                          <td className="border-b border-r border-black p-2">零稅率銷售額</td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.sales.zeroRated)}
                          </td>
                          <td className="border-b border-r border-black p-2 text-center">-</td>
                          <td className="border-b border-black p-2 text-center">0</td>
                        </tr>
                        <tr>
                          <td className="border-b border-r border-black p-2 text-center">3</td>
                          <td className="border-b border-r border-black p-2">免稅銷售額</td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.sales.exempt)}
                          </td>
                          <td className="border-b border-r border-black p-2 text-center">-</td>
                          <td className="border-b border-black p-2 text-center">0</td>
                        </tr>
                        <tr className="bg-blue-50 font-bold">
                          <td className="border-b border-r border-black p-2 text-center">4</td>
                          <td className="border-b border-r border-black p-2">銷項合計 (1+2+3)</td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.sales.total)}
                          </td>
                          <td className="border-b border-r border-black p-2 text-right font-mono text-blue-700">
                            {formatAmount(report.summary.outputTax)}
                          </td>
                          <td className="border-b border-black p-2"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 進項區塊 */}
                  <div className="border-b border-black">
                    <div className="bg-green-50 font-bold py-2 px-4 border-b border-black flex items-center gap-2">
                      <span className="bg-green-600 text-white px-2 py-0.5 rounded text-sm">貳</span>
                      進項
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border-b border-r border-black p-2 w-8">欄</th>
                          <th className="border-b border-r border-black p-2">項目</th>
                          <th className="border-b border-r border-black p-2 w-32">進項額</th>
                          <th className="border-b border-r border-black p-2 w-32">稅額</th>
                          <th className="border-b border-black p-2 w-20">發票張數</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border-b border-r border-black p-2 text-center">5</td>
                          <td className="border-b border-r border-black p-2">進項稅額 (可扣抵)</td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.purchases.deductible)}
                          </td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.purchases.inputTax)}
                          </td>
                          <td className="border-b border-black p-2 text-center">
                            {report.purchases.invoiceCount}
                          </td>
                        </tr>
                        <tr>
                          <td className="border-b border-r border-black p-2 text-center">6</td>
                          <td className="border-b border-r border-black p-2">固定資產</td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.purchases.fixedAssets)}
                          </td>
                          <td className="border-b border-r border-black p-2 text-center">-</td>
                          <td className="border-b border-black p-2 text-center">-</td>
                        </tr>
                        <tr>
                          <td className="border-b border-r border-black p-2 text-center">7</td>
                          <td className="border-b border-r border-black p-2">不可扣抵進項</td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.purchases.nonDeductible)}
                          </td>
                          <td className="border-b border-r border-black p-2 text-center">-</td>
                          <td className="border-b border-black p-2 text-center">-</td>
                        </tr>
                        <tr className="bg-green-50 font-bold">
                          <td className="border-b border-r border-black p-2 text-center">8</td>
                          <td className="border-b border-r border-black p-2">進項合計</td>
                          <td className="border-b border-r border-black p-2 text-right font-mono">
                            {formatAmount(report.purchases.total)}
                          </td>
                          <td className="border-b border-r border-black p-2 text-right font-mono text-green-700">
                            {formatAmount(report.summary.inputTax)}
                          </td>
                          <td className="border-b border-black p-2"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 稅額計算 */}
                  <div className="border-b border-black">
                    <div className="bg-amber-50 font-bold py-2 px-4 border-b border-black flex items-center gap-2">
                      <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-sm">參</span>
                      稅額計算
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-dotted">
                        <span className="flex items-center gap-2">
                          <span className="bg-gray-200 px-2 py-0.5 rounded text-sm">9</span>
                          銷項稅額
                        </span>
                        <span className="font-mono text-lg">{formatAmount(report.summary.outputTax)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-dotted">
                        <span className="flex items-center gap-2">
                          <span className="bg-gray-200 px-2 py-0.5 rounded text-sm">10</span>
                          進項稅額
                        </span>
                        <span className="font-mono text-lg text-green-600">- {formatAmount(report.summary.inputTax)}</span>
                      </div>
                      <div className={`flex justify-between items-center py-3 px-4 rounded-lg ${report.summary.isRefund ? 'bg-green-100' : 'bg-red-100'}`}>
                        <span className="flex items-center gap-2 font-bold">
                          <span className={`${report.summary.isRefund ? 'bg-green-600' : 'bg-red-600'} text-white px-2 py-0.5 rounded text-sm`}>11</span>
                          {report.summary.isRefund ? '本期應退稅額 (10-9)' : '本期應繳稅額 (9-10)'}
                        </span>
                        <span className={`font-mono text-2xl font-bold ${report.summary.isRefund ? 'text-green-700' : 'text-red-700'}`}>
                          {formatAmount(Math.abs(report.summary.taxPayable))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 簽章區 */}
                  <div className="grid grid-cols-4 border-t-2 border-black">
                    <div className="p-4 border-r border-black text-center">
                      <div className="h-16 border-b border-black mb-2"></div>
                      <div className="text-sm text-muted-foreground">負責人簽章</div>
                    </div>
                    <div className="p-4 border-r border-black text-center">
                      <div className="h-16 border-b border-black mb-2"></div>
                      <div className="text-sm text-muted-foreground">記帳人員</div>
                    </div>
                    <div className="p-4 border-r border-black text-center">
                      <div className="h-16 border-b border-black mb-2"></div>
                      <div className="text-sm text-muted-foreground">會計主管</div>
                    </div>
                    <div className="p-4 text-center">
                      <div className="h-16 border-b border-black mb-2"></div>
                      <div className="text-sm text-muted-foreground">稅捐機關收件章</div>
                    </div>
                  </div>
                </div>

                {/* 列印資訊 */}
                <div className="text-right text-sm text-muted-foreground mt-2 no-print">
                  列印日期：{new Date().toLocaleDateString('zh-TW')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 注意事項 */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="h-5 w-5" />
                申報注意事項
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-800 space-y-2">
              <p>1. 營業稅申報期限：每單月 15 日前申報前期（如 3/15 前申報 1-2 月）</p>
              <p>2. 本報表係依據系統傳票資料自動計算，請核對發票及進貨憑證後再行申報</p>
              <p>3. 如有零稅率或免稅銷售，請手動調整相關金額</p>
              <p>4. 申報方式：可透過財政部電子申報繳稅服務或臨櫃申報</p>
              <p>5. 如有疑問，請洽詢會計師或國稅局</p>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedCompanyId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            請選擇公司和申報期間以產生 401 申報書
          </CardContent>
        </Card>
      )}
    </div>
  )
}
