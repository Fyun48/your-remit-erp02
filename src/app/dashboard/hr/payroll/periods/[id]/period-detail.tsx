'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  FileText,
  Loader2,
  Printer,
  FileSpreadsheet,
  Users,
  Wallet,
  TrendingDown,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface PeriodDetailProps {
  periodId: string
  companyName: string
  year: number
  month: number
}

export default function PeriodDetail({ periodId, companyName, year, month }: PeriodDetailProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const { data: period, isLoading } = trpc.payroll.getPeriod.useQuery({ id: periodId })

  const formatAmount = (amount: number | string | { toString(): string } | null) => {
    if (amount === null) return '-'
    const num = typeof amount === 'string' ? parseFloat(amount) :
                typeof amount === 'number' ? amount : parseFloat(amount.toString())
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      DRAFT: { label: '草稿', variant: 'secondary' },
      CALCULATED: { label: '已計算', variant: 'outline' },
      APPROVED: { label: '已核准', variant: 'default' },
      PAID: { label: '已發放', variant: 'default' },
    }
    const c = config[status] || { label: status, variant: 'secondary' as const }
    return <Badge variant={c.variant}>{c.label}</Badge>
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
        <title>薪資明細表</title>
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
          .footer { margin-top: 20px; display: flex; justify-content: space-between; }
          .signature { display: flex; gap: 40px; }
          .signature > div { border-top: 1px solid #000; padding-top: 5px; min-width: 80px; text-align: center; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${companyName}</h1>
          <h2>${year} 年 ${month} 月 薪資明細表</h2>
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
    if (!period?.slips) return

    const rows: string[][] = []

    // 表頭
    rows.push([`${companyName} - ${year} 年 ${month} 月 薪資明細`])
    rows.push([])

    // 欄位標題
    rows.push([
      '員工編號', '姓名', '底薪', '津貼', '加班費', '獎金', '其他', '應發合計',
      '勞保', '健保', '勞退', '所得稅', '其他扣款', '扣除合計', '實發金額'
    ])

    // 資料
    period.slips.forEach(slip => {
      rows.push([
        slip.employee.employeeNo,
        slip.employee.name,
        String(slip.baseSalary),
        String(slip.allowances),
        String(slip.overtimePay),
        String(slip.bonus),
        String(slip.otherIncome),
        String(slip.grossPay),
        String(slip.laborInsurance),
        String(slip.healthInsurance),
        String(slip.laborPension),
        String(slip.incomeTax),
        String(slip.otherDeduction),
        String(slip.totalDeduction),
        String(slip.netPay),
      ])
    })

    // 合計
    const totals = period.slips.reduce((acc, slip) => ({
      baseSalary: acc.baseSalary + Number(slip.baseSalary),
      allowances: acc.allowances + Number(slip.allowances),
      overtimePay: acc.overtimePay + Number(slip.overtimePay),
      bonus: acc.bonus + Number(slip.bonus),
      otherIncome: acc.otherIncome + Number(slip.otherIncome),
      grossPay: acc.grossPay + Number(slip.grossPay),
      laborInsurance: acc.laborInsurance + Number(slip.laborInsurance),
      healthInsurance: acc.healthInsurance + Number(slip.healthInsurance),
      laborPension: acc.laborPension + Number(slip.laborPension),
      incomeTax: acc.incomeTax + Number(slip.incomeTax),
      otherDeduction: acc.otherDeduction + Number(slip.otherDeduction),
      totalDeduction: acc.totalDeduction + Number(slip.totalDeduction),
      netPay: acc.netPay + Number(slip.netPay),
    }), {
      baseSalary: 0, allowances: 0, overtimePay: 0, bonus: 0, otherIncome: 0, grossPay: 0,
      laborInsurance: 0, healthInsurance: 0, laborPension: 0, incomeTax: 0,
      otherDeduction: 0, totalDeduction: 0, netPay: 0
    })

    rows.push([
      '合計', '',
      String(totals.baseSalary),
      String(totals.allowances),
      String(totals.overtimePay),
      String(totals.bonus),
      String(totals.otherIncome),
      String(totals.grossPay),
      String(totals.laborInsurance),
      String(totals.healthInsurance),
      String(totals.laborPension),
      String(totals.incomeTax),
      String(totals.otherDeduction),
      String(totals.totalDeduction),
      String(totals.netPay),
    ])

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `薪資明細_${companyName}_${year}年${month}月.csv`
    link.click()
  }

  if (isLoading || !period) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 計算彙總
  const totals = period.slips.reduce((acc, slip) => ({
    grossPay: acc.grossPay + Number(slip.grossPay),
    totalDeduction: acc.totalDeduction + Number(slip.totalDeduction),
    netPay: acc.netPay + Number(slip.netPay),
    laborInsurance: acc.laborInsurance + Number(slip.laborInsurance),
    healthInsurance: acc.healthInsurance + Number(slip.healthInsurance),
  }), { grossPay: 0, totalDeduction: 0, netPay: 0, laborInsurance: 0, healthInsurance: 0 })

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hr/payroll/periods">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              {year} 年 {month} 月 薪資明細
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{companyName}</span>
              {getStatusBadge(period.status)}
            </div>
          </div>
        </div>
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
      </div>

      {/* 彙總卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">員工人數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{period.slips.length}</div>
            <p className="text-xs text-muted-foreground">位員工</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">應發總額</CardTitle>
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
            <CardTitle className="text-sm font-medium">扣除總額</CardTitle>
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
            <CardTitle className="text-sm font-medium">實發總額</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatAmount(totals.netPay)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 薪資單列表 */}
      <Card>
        <CardHeader>
          <CardTitle>薪資單明細</CardTitle>
          <CardDescription>
            共 {period.slips.length} 張薪資單
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={printRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">員工編號</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead className="text-right">底薪</TableHead>
                  <TableHead className="text-right">津貼</TableHead>
                  <TableHead className="text-right">加班費</TableHead>
                  <TableHead className="text-right">應發</TableHead>
                  <TableHead className="text-right">勞保</TableHead>
                  <TableHead className="text-right">健保</TableHead>
                  <TableHead className="text-right">所得稅</TableHead>
                  <TableHead className="text-right">扣除</TableHead>
                  <TableHead className="text-right font-bold">實發</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {period.slips.map((slip) => (
                  <TableRow key={slip.id}>
                    <TableCell className="font-mono">{slip.employee.employeeNo}</TableCell>
                    <TableCell className="font-medium">{slip.employee.name}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(slip.baseSalary)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(slip.allowances)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(slip.overtimePay)}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{formatAmount(slip.grossPay)}</TableCell>
                    <TableCell className="text-right font-mono text-red-500">{formatAmount(slip.laborInsurance)}</TableCell>
                    <TableCell className="text-right font-mono text-red-500">{formatAmount(slip.healthInsurance)}</TableCell>
                    <TableCell className="text-right font-mono text-red-500">{formatAmount(slip.incomeTax)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{formatAmount(slip.totalDeduction)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-blue-600">{formatAmount(slip.netPay)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-bold">
                  <TableCell colSpan={5}>合計</TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    {formatAmount(totals.grossPay)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-500">
                    {formatAmount(totals.laborInsurance)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-500">
                    {formatAmount(totals.healthInsurance)}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {formatAmount(totals.totalDeduction)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-600">
                    {formatAmount(totals.netPay)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
