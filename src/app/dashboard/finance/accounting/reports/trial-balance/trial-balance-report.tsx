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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, Printer, FileSpreadsheet, CheckCircle2, XCircle, Lock } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

interface TrialBalanceReportProps {
  assignments: {
    companyId: string
    company: {
      id: string
      name: string
    }
  }[]
  initialCompanyId: string
}

export function TrialBalanceReport({ assignments, initialCompanyId }: TrialBalanceReportProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const [selectedCompanyId] = useState<string>(initialCompanyId)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')

  // 取得會計期間
  const { data: periods } = trpc.accountingPeriod.list.useQuery(
    { companyId: selectedCompanyId },
    { enabled: !!selectedCompanyId }
  )

  // 取得試算表資料
  const { data: report, isLoading } = trpc.financialReport.trialBalance.useQuery(
    { companyId: selectedCompanyId, periodId: selectedPeriodId },
    { enabled: !!selectedCompanyId && !!selectedPeriodId }
  )

  // 取得公司名稱
  const companyName = assignments.find(a => a.companyId === selectedCompanyId)?.company.name || ''
  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const periodName = selectedPeriod ? `${selectedPeriod.year}年第${selectedPeriod.period}期` : ''

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
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
        <title>試算表 - ${companyName}</title>
        <style>
          body { font-family: 'Microsoft JhengHei', sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .company-name { font-size: 18px; font-weight: bold; }
          .report-title { font-size: 24px; font-weight: bold; margin: 10px 0; }
          .period { font-size: 14px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: right; }
          th { background-color: #f0f0f0; }
          td:first-child, th:first-child { text-align: left; }
          td:nth-child(2), th:nth-child(2) { text-align: left; }
          .total-row { font-weight: bold; background-color: #f5f5f5; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; }
          .signature { border-top: 1px solid #333; width: 120px; text-align: center; padding-top: 5px; }
          .print-date { text-align: right; margin-top: 20px; font-size: 12px; color: #666; }
          .balanced { color: green; }
          .unbalanced { color: red; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companyName}</div>
          <div class="report-title">試 算 表</div>
          <div class="period">${periodName}</div>
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

    const headers = ['科目代碼', '科目名稱', '類別', '借方金額', '貸方金額', '餘額']
    const rows = report.data.map(item => [
      item.accountCode,
      item.accountName,
      item.category,
      item.debitTotal,
      item.creditTotal,
      item.balance,
    ])

    // 加入合計列
    rows.push(['', '合計', '', report.summary.totalDebit, report.summary.totalCredit, ''])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `試算表_${companyName}_${periodName}.csv`
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
            <h1 className="text-2xl font-bold">試算表</h1>
            <p className="text-muted-foreground">Trial Balance - 確認借貸平衡</p>
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

            <div className="w-64">
              <label className="text-sm font-medium mb-2 block">會計期間</label>
              <Select
                value={selectedPeriodId}
                onValueChange={setSelectedPeriodId}
                disabled={!selectedCompanyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇期間" />
                </SelectTrigger>
                <SelectContent>
                  {periods?.map(period => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.year}年第{period.period}期
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 報表內容 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {report && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>報表結果</CardTitle>
              <Badge variant={report.summary.isBalanced ? 'default' : 'destructive'}>
                {report.summary.isBalanced ? (
                  <><CheckCircle2 className="h-4 w-4 mr-1" /> 借貸平衡</>
                ) : (
                  <><XCircle className="h-4 w-4 mr-1" /> 借貸不平衡</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={printRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">科目代碼</TableHead>
                    <TableHead>科目名稱</TableHead>
                    <TableHead className="w-24">類別</TableHead>
                    <TableHead className="text-right w-36">借方金額</TableHead>
                    <TableHead className="text-right w-36">貸方金額</TableHead>
                    <TableHead className="text-right w-36">餘額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.data.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{item.accountCode}</TableCell>
                      <TableCell>{item.accountName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.category === 'ASSET' ? '資產' :
                           item.category === 'LIABILITY' ? '負債' :
                           item.category === 'EQUITY' ? '權益' :
                           item.category === 'REVENUE' ? '收入' : '費用'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.debitTotal > 0 ? formatAmount(item.debitTotal) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.creditTotal > 0 ? formatAmount(item.creditTotal) : '-'}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${item.balance < 0 ? 'text-red-600' : ''}`}>
                        {formatAmount(item.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* 合計列 */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>合計</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(report.summary.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(report.summary.totalCredit)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${!report.summary.isBalanced ? 'text-red-600' : ''}`}>
                      {report.summary.isBalanced ? '-' : formatAmount(report.summary.totalDebit - report.summary.totalCredit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {report.data.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                此期間沒有已過帳的傳票資料
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedCompanyId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            請選擇公司和會計期間以查看試算表
          </CardContent>
        </Card>
      )}
    </div>
  )
}
