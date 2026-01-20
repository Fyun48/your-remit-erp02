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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Receipt,
  ShoppingCart,
  Loader2,
  FileText,
  Lock,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { exportInvoiceDetailToPDF } from '@/lib/pdf-export'
import Link from 'next/link'

const PERIODS = [
  { value: '1', label: '第1期 (1-2月)' },
  { value: '2', label: '第2期 (3-4月)' },
  { value: '3', label: '第3期 (5-6月)' },
  { value: '4', label: '第4期 (7-8月)' },
  { value: '5', label: '第5期 (9-10月)' },
  { value: '6', label: '第6期 (11-12月)' },
]

interface InvoiceDetailReportProps {
  assignments: {
    companyId: string
    company: {
      id: string
      name: string
    }
  }[]
  initialCompanyId: string
}

export default function InvoiceDetailReport({ assignments, initialCompanyId }: InvoiceDetailReportProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const currentPeriod = Math.ceil(currentMonth / 2)

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId)
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString())
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod.toString())
  const [selectedType, setSelectedType] = useState<'SALES' | 'PURCHASE' | 'ALL'>('ALL')

  // 取得公司名稱
  const companyName = assignments.find(a => a.companyId === selectedCompanyId)?.company.name || ''

  const { data: report, isLoading } = trpc.financialReport.invoiceDetail.useQuery(
    {
      companyId: selectedCompanyId,
      year: parseInt(selectedYear),
      period: parseInt(selectedPeriod),
      type: selectedType,
    },
    { enabled: !!selectedCompanyId && !!selectedYear && !!selectedPeriod }
  )

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const company = assignments.find(a => a.companyId === selectedCompanyId)?.company

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>進銷項發票明細</title>
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
          .section-title { font-size: 11pt; font-weight: bold; margin: 15px 0 5px; }
          .footer { margin-top: 20px; display: flex; justify-content: space-between; }
          .signature { display: flex; gap: 40px; }
          .signature > div { border-top: 1px solid #000; padding-top: 5px; min-width: 80px; text-align: center; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${company?.name || ''}</h1>
          <h2>進銷項發票明細表</h2>
          <div>民國 ${parseInt(selectedYear) - 1911} 年 第${selectedPeriod}期 (${report?.period.periodLabel})</div>
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

    const company = assignments.find(a => a.companyId === selectedCompanyId)?.company
    const rows: string[][] = []

    // 銷項發票
    if (report.salesInvoices.length > 0) {
      rows.push(['=== 銷項發票明細 ==='])
      rows.push(['日期', '傳票號碼', '發票號碼', '客戶', '說明', '金額', '稅額', '含稅金額'])
      report.salesInvoices.forEach(inv => {
        rows.push([
          formatDate(inv.date),
          inv.voucherNo,
          inv.invoiceNo || '',
          inv.counterparty,
          inv.description,
          inv.amount.toString(),
          inv.tax.toString(),
          inv.total.toString(),
        ])
      })
      rows.push(['銷項合計', '', '', '', '',
        report.salesSummary.totalAmount.toString(),
        report.salesSummary.totalTax.toString(),
        report.salesSummary.grandTotal.toString(),
      ])
      rows.push([])
    }

    // 進項發票
    if (report.purchaseInvoices.length > 0) {
      rows.push(['=== 進項發票明細 ==='])
      rows.push(['日期', '傳票號碼', '發票號碼', '廠商', '說明', '金額', '稅額', '含稅金額'])
      report.purchaseInvoices.forEach(inv => {
        rows.push([
          formatDate(inv.date),
          inv.voucherNo,
          inv.invoiceNo || '',
          inv.counterparty,
          inv.description,
          inv.amount.toString(),
          inv.tax.toString(),
          inv.total.toString(),
        ])
      })
      rows.push(['進項合計', '', '', '', '',
        report.purchaseSummary.totalAmount.toString(),
        report.purchaseSummary.totalTax.toString(),
        report.purchaseSummary.grandTotal.toString(),
      ])
    }

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `進銷項發票明細_${company?.name}_${selectedYear}年第${selectedPeriod}期.csv`
    link.click()
  }

  const handleExportPDF = (type: 'sales' | 'purchase') => {
    if (!report) return

    const company = assignments.find(a => a.companyId === selectedCompanyId)?.company
    const invoices = type === 'sales' ? report.salesInvoices : report.purchaseInvoices

    exportInvoiceDetailToPDF({
      company: company?.name || '',
      period: `${selectedYear}年第${selectedPeriod}期`,
      type,
      invoices: invoices.map(inv => ({
        date: formatDate(inv.date),
        invoiceNo: inv.invoiceNo || '-',
        counterparty: inv.counterparty,
        description: inv.description,
        amount: inv.amount,
        tax: inv.tax,
        total: inv.total,
      })),
      filename: `${type === 'sales' ? '銷項' : '進項'}發票明細_${company?.name}_${selectedYear}年第${selectedPeriod}期`,
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
              進銷項發票明細
            </h1>
            <p className="text-muted-foreground">
              查詢各期間的銷項與進項發票逐筆明細
            </p>
          </div>
        </div>
        <div className="flex gap-2">
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
                      {year} 年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <label className="text-sm font-medium mb-1 block">期別</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map(period => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <label className="text-sm font-medium mb-1 block">類型</label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as typeof selectedType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部</SelectItem>
                  <SelectItem value="SALES">僅銷項</SelectItem>
                  <SelectItem value="PURCHASE">僅進項</SelectItem>
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
                  <Receipt className="h-4 w-4 text-blue-500" />
                  銷項發票數
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {report.salesSummary.count} 張
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-blue-500" />
                  銷項金額
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatAmount(report.salesSummary.grandTotal)}
                </div>
                <div className="text-xs text-muted-foreground">
                  稅額 {formatAmount(report.salesSummary.totalTax)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-green-500" />
                  進項發票數
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {report.purchaseSummary.count} 張
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-green-500" />
                  進項金額
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatAmount(report.purchaseSummary.grandTotal)}
                </div>
                <div className="text-xs text-muted-foreground">
                  稅額 {formatAmount(report.purchaseSummary.totalTax)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 明細表格 */}
          <Card>
            <CardHeader>
              <CardTitle>發票明細</CardTitle>
              <CardDescription>
                {report.period.year} 年第 {report.period.periodNo} 期 ({report.period.periodLabel})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={printRef}>
                <Tabs defaultValue="sales">
                  <TabsList className="mb-4">
                    <TabsTrigger value="sales">
                      銷項發票 <Badge variant="secondary" className="ml-2">{report.salesSummary.count}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="purchase">
                      進項發票 <Badge variant="secondary" className="ml-2">{report.purchaseSummary.count}</Badge>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="sales">
                    {report.salesInvoices.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        本期無銷項發票資料
                      </div>
                    ) : (
                      <>
                      <div className="flex justify-end mb-2">
                        <Button variant="outline" size="sm" onClick={() => handleExportPDF('sales')}>
                          <FileText className="h-4 w-4 mr-2" />
                          匯出 PDF
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">日期</TableHead>
                            <TableHead className="w-[120px]">傳票號碼</TableHead>
                            <TableHead className="w-[120px]">發票號碼</TableHead>
                            <TableHead>客戶/說明</TableHead>
                            <TableHead className="text-right w-[120px]">金額</TableHead>
                            <TableHead className="text-right w-[100px]">稅額</TableHead>
                            <TableHead className="text-right w-[120px]">含稅金額</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.salesInvoices.map((inv, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{formatDate(inv.date)}</TableCell>
                              <TableCell>{inv.voucherNo}</TableCell>
                              <TableCell>{inv.invoiceNo || '-'}</TableCell>
                              <TableCell>
                                <div className="font-medium">{inv.counterparty}</div>
                                {inv.description && (
                                  <div className="text-xs text-muted-foreground">{inv.description}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatAmount(inv.amount)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatAmount(inv.tax)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                {formatAmount(inv.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-blue-50 font-bold">
                            <TableCell colSpan={4}>銷項合計</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(report.salesSummary.totalAmount)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(report.salesSummary.totalTax)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(report.salesSummary.grandTotal)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="purchase">
                    {report.purchaseInvoices.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        本期無進項發票資料
                      </div>
                    ) : (
                      <>
                      <div className="flex justify-end mb-2">
                        <Button variant="outline" size="sm" onClick={() => handleExportPDF('purchase')}>
                          <FileText className="h-4 w-4 mr-2" />
                          匯出 PDF
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">日期</TableHead>
                            <TableHead className="w-[120px]">傳票號碼</TableHead>
                            <TableHead className="w-[120px]">發票號碼</TableHead>
                            <TableHead>廠商/說明</TableHead>
                            <TableHead className="text-right w-[120px]">金額</TableHead>
                            <TableHead className="text-right w-[100px]">稅額</TableHead>
                            <TableHead className="text-right w-[120px]">含稅金額</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.purchaseInvoices.map((inv, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{formatDate(inv.date)}</TableCell>
                              <TableCell>{inv.voucherNo}</TableCell>
                              <TableCell>{inv.invoiceNo || '-'}</TableCell>
                              <TableCell>
                                <div className="font-medium">{inv.counterparty}</div>
                                {inv.description && (
                                  <div className="text-xs text-muted-foreground">{inv.description}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatAmount(inv.amount)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatAmount(inv.tax)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                {formatAmount(inv.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-green-50 font-bold">
                            <TableCell colSpan={4}>進項合計</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(report.purchaseSummary.totalAmount)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(report.purchaseSummary.totalTax)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(report.purchaseSummary.grandTotal)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 無資料提示 */}
      {!selectedCompanyId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            請先選擇公司以查詢發票明細
          </CardContent>
        </Card>
      )}
    </div>
  )
}
