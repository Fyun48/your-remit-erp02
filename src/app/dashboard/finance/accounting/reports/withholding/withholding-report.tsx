'use client'

import { useState, useRef } from 'react'
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
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Users,
  Building2,
  Loader2,
  FileText,
  Receipt,
  Lock,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { exportWithholdingToPDF } from '@/lib/pdf-export'
import Link from 'next/link'

interface WithholdingReportProps {
  assignments: {
    companyId: string
    company: {
      id: string
      name: string
    }
  }[]
  initialCompanyId: string
}

export default function WithholdingReport({ assignments, initialCompanyId }: WithholdingReportProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const currentYear = new Date().getFullYear()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId)
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString())

  // 取得公司名稱
  const companyName = assignments.find(a => a.companyId === selectedCompanyId)?.company.name || ''

  const { data: report, isLoading } = trpc.financialReport.withholdingSummary.useQuery(
    {
      companyId: selectedCompanyId,
      year: parseInt(selectedYear),
    },
    { enabled: !!selectedCompanyId && !!selectedYear }
  )

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getIncomeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      '50': 'bg-blue-100 text-blue-800',
      '9A': 'bg-purple-100 text-purple-800',
      '9B': 'bg-pink-100 text-pink-800',
      '92': 'bg-orange-100 text-orange-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
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
        <title>扣繳憑單彙總表</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body {
            font-family: 'Microsoft JhengHei', sans-serif;
            font-size: 9pt;
            line-height: 1.4;
          }
          .header { text-align: center; margin-bottom: 15px; }
          .header h1 { font-size: 16pt; margin: 0; }
          .header h2 { font-size: 12pt; margin: 5px 0; color: #666; }
          .company-info { margin: 10px 0; font-size: 10pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
          th { background: #f0f0f0; font-weight: bold; }
          td.left { text-align: left; }
          td.right { text-align: right; font-family: monospace; }
          .summary { background: #e8f4e8; font-weight: bold; }
          .section-title { font-size: 11pt; font-weight: bold; margin: 15px 0 5px; }
          .footer { margin-top: 20px; display: flex; justify-content: space-between; }
          .signature { display: flex; gap: 40px; }
          .signature > div { border-top: 1px solid #000; padding-top: 5px; min-width: 80px; text-align: center; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${report?.company.name || ''}</h1>
          <h2>各類所得扣繳暨免扣繳憑單申報彙總表</h2>
          <div>中華民國 ${report?.rocYear} 年度</div>
        </div>
        <div class="company-info">
          <div>扣繳單位統一編號：${report?.company.taxId || '-'}</div>
        </div>
        ${printContent.innerHTML}
        <div class="footer">
          <div class="signature">
            <div>製表人</div>
            <div>覆核</div>
            <div>主管</div>
          </div>
          <div>列印日期：${new Date().toLocaleDateString('zh-TW')}</div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExportExcel = () => {
    if (!report) return

    const rows: string[][] = []

    // 表頭資訊
    rows.push([`${report.company.name} - 扣繳憑單彙總表`])
    rows.push([`年度：民國 ${report.rocYear} 年 (${report.year})`])
    rows.push([`扣繳單位統一編號：${report.company.taxId || '-'}`])
    rows.push([])

    // 欄位標題
    rows.push(['所得人', '統一編號', '所得類別', '給付總額', '扣繳稅額', '給付次數'])

    // 資料列
    report.records.forEach(record => {
      rows.push([
        record.payeeName,
        record.taxId || '-',
        `${record.incomeType} ${record.incomeTypeName}`,
        record.grossAmount.toString(),
        record.taxWithheld.toString(),
        record.paymentCount.toString(),
      ])
    })

    // 合計
    rows.push([])
    rows.push([
      '合計',
      '',
      `${report.summary.totalPayees} 人`,
      report.summary.totalGross.toString(),
      report.summary.totalTax.toString(),
      '',
    ])

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `扣繳憑單彙總_${report.company.name}_${report.rocYear}年度.csv`
    link.click()
  }

  const handleExportPDF = () => {
    if (!report) return

    exportWithholdingToPDF({
      company: report.company.name,
      year: report.year,
      records: report.records.map(rec => ({
        idNumber: rec.taxId || '-',
        name: rec.payeeName,
        incomeType: `${rec.incomeType} ${rec.incomeTypeName}`,
        totalPayment: rec.grossAmount,
        withholdingTax: rec.taxWithheld,
      })),
      filename: `扣繳憑單彙總_${report.company.name}_${report.rocYear}年度`,
    })
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
              <FileText className="h-6 w-6" />
              扣繳憑單彙總表
            </h1>
            <p className="text-muted-foreground">
              依年度彙總各所得人扣繳資料，用於年度申報
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF} disabled={!report}>
            <FileText className="h-4 w-4 mr-2" />
            匯出 PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={!report}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            匯出 Excel
          </Button>
          <Button onClick={handlePrint} disabled={!report}>
            <Printer className="h-4 w-4 mr-2" />
            列印
          </Button>
        </div>
      </div>

      {/* 篩選條件 */}
      <Card>
        <CardHeader>
          <CardTitle>篩選條件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="w-[200px]">
              <label className="text-sm font-medium mb-1 block">公司</label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted text-sm">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{companyName}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">如需變更請返回報表首頁</p>
            </div>
            <div className="w-[120px]">
              <label className="text-sm font-medium mb-1 block">年度</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      民國 {year - 1911} 年
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
      {report && !isLoading && (
        <>
          {/* 摘要卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  所得人數
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {report.summary.totalPayees} 人
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-green-500" />
                  給付總額
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatAmount(report.summary.totalGross)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-red-500" />
                  扣繳稅額
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatAmount(report.summary.totalTax)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-purple-500" />
                  實付淨額
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatAmount(report.summary.totalNet)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 所得類別彙總 */}
          {report.summary.byIncomeType.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>各類所得彙總</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {report.summary.byIncomeType.map(item => (
                    <div key={item.incomeType} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getIncomeTypeColor(item.incomeType)}>
                          {item.incomeType}
                        </Badge>
                        <span className="text-sm font-medium">{item.incomeTypeName}</span>
                      </div>
                      <div className="text-lg font-bold">{formatAmount(item.grossAmount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.count} 人 / 扣繳 {formatAmount(item.taxWithheld)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 明細表格 */}
          <Card>
            <CardHeader>
              <CardTitle>扣繳明細</CardTitle>
              <CardDescription>
                中華民國 {report.rocYear} 年度 ({report.year})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={printRef}>
                {report.records.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    本年度無扣繳資料
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">所得類別</TableHead>
                        <TableHead>所得人</TableHead>
                        <TableHead className="w-[120px]">統一編號</TableHead>
                        <TableHead className="text-right w-[120px]">給付總額</TableHead>
                        <TableHead className="text-right w-[100px]">扣繳稅額</TableHead>
                        <TableHead className="text-right w-[100px]">實付淨額</TableHead>
                        <TableHead className="text-center w-[80px]">給付次數</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.records.map((record, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge className={getIncomeTypeColor(record.incomeType)}>
                              {record.incomeType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{record.payeeName}</div>
                            <div className="text-xs text-muted-foreground">
                              {record.payeeType === 'EMPLOYEE' ? '員工' : '廠商'}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {record.taxId || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAmount(record.grossAmount)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {formatAmount(record.taxWithheld)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAmount(record.netAmount)}
                          </TableCell>
                          <TableCell className="text-center">
                            {record.paymentCount}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50 font-bold">
                        <TableCell colSpan={3}>
                          合計 ({report.summary.totalPayees} 人)
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(report.summary.totalGross)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {formatAmount(report.summary.totalTax)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(report.summary.totalNet)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 無資料提示 */}
      {!selectedCompanyId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            請先選擇公司以查詢扣繳憑單彙總資料
          </CardContent>
        </Card>
      )}
    </div>
  )
}
