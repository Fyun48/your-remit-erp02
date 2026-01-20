import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// 擴展 jsPDF 類型以包含 autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable
    lastAutoTable: {
      finalY: number
    }
  }
}

export interface PDFExportOptions {
  title: string
  subtitle?: string
  company: string
  period: string
  headers: string[]
  data: (string | number)[][]
  filename: string
  orientation?: 'portrait' | 'landscape'
  footer?: string
}

export interface PDFTableColumn {
  header: string
  dataKey: string
  width?: number
}

/**
 * 匯出表格資料為 PDF
 * 注意：jsPDF 對中文支援有限，建議使用列印功能或外部 PDF 服務
 */
export function exportTableToPDF(options: PDFExportOptions): void {
  const {
    title,
    subtitle,
    company,
    period,
    headers,
    data,
    filename,
    orientation = 'portrait',
    footer,
  } = options

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  })

  // 頁面尺寸
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  // 標題區域
  let yPosition = margin

  // 公司名稱
  doc.setFontSize(14)
  doc.text(company, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 8

  // 報表標題
  doc.setFontSize(16)
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 6

  // 副標題（期間）
  if (subtitle) {
    doc.setFontSize(10)
    doc.text(subtitle, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 4
  }

  // 期間資訊
  doc.setFontSize(10)
  doc.text(period, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 10

  // 表格
  autoTable(doc, {
    startY: yPosition,
    head: [headers],
    body: data,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2,
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { halign: 'left' },
    },
    margin: { left: margin, right: margin },
  })

  // 頁尾
  const footerY = pageHeight - 15
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)

  // 簽章區域
  const signatureY = footerY - 15
  doc.setDrawColor(0, 0, 0)
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)

  const signatureWidth = (pageWidth - margin * 2) / 4
  const labels = ['製表人', '覆核', '主管', '']

  labels.forEach((label, index) => {
    const x = margin + signatureWidth * index
    if (label) {
      doc.text(`${label}：__________`, x, signatureY)
    }
  })

  // 列印日期
  const now = new Date()
  const dateStr = `列印日期：${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
  doc.text(dateStr, pageWidth - margin, footerY, { align: 'right' })

  // 自訂頁尾
  if (footer) {
    doc.text(footer, margin, footerY)
  }

  // 儲存
  doc.save(`${filename}.pdf`)
}

/**
 * 格式化金額（千分位）
 */
export function formatAmountForPDF(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '0'
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * 民國年轉換
 */
export function toROCYear(year: number): number {
  return year - 1911
}

/**
 * 格式化民國日期
 */
export function formatROCDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const rocYear = d.getFullYear() - 1911
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `民國 ${rocYear} 年 ${month} 月 ${day} 日`
}

/**
 * 匯出薪資單 PDF
 */
export interface PayslipPDFOptions {
  company: string
  employee: {
    name: string
    employeeNo: string
    department: string
    position: string
  }
  period: {
    year: number
    month: number
  }
  earnings: {
    label: string
    amount: number
  }[]
  deductions: {
    label: string
    amount: number
  }[]
  grossPay: number
  totalDeduction: number
  netPay: number
  filename: string
}

export function exportPayslipToPDF(options: PayslipPDFOptions): void {
  const {
    company,
    employee,
    period,
    earnings,
    deductions,
    grossPay,
    totalDeduction,
    netPay,
    filename,
  } = options

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // 標題
  doc.setFontSize(16)
  doc.text(company, pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(14)
  doc.text('薪資明細表', pageWidth / 2, y, { align: 'center' })
  y += 6

  doc.setFontSize(10)
  doc.text(`${period.year} 年 ${period.month} 月`, pageWidth / 2, y, { align: 'center' })
  y += 10

  // 員工資訊
  doc.setFontSize(10)
  doc.text(`姓名：${employee.name}`, margin, y)
  doc.text(`員工編號：${employee.employeeNo}`, pageWidth / 2, y)
  y += 6
  doc.text(`部門：${employee.department}`, margin, y)
  doc.text(`職位：${employee.position}`, pageWidth / 2, y)
  y += 10

  // 應發項目
  const earningsData = earnings.map(e => [e.label, formatAmountForPDF(e.amount)])
  earningsData.push(['應發合計', formatAmountForPDF(grossPay)])

  autoTable(doc, {
    startY: y,
    head: [['應發項目', '金額']],
    body: earningsData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [76, 175, 80], textColor: [255, 255, 255] },
    columnStyles: {
      0: { halign: 'left', cellWidth: 80 },
      1: { halign: 'right', cellWidth: 40 },
    },
    margin: { left: margin, right: pageWidth / 2 + 5 },
  })

  // 扣除項目
  const deductionsData = deductions.map(d => [d.label, formatAmountForPDF(d.amount)])
  deductionsData.push(['扣除合計', formatAmountForPDF(totalDeduction)])

  autoTable(doc, {
    startY: y,
    head: [['扣除項目', '金額']],
    body: deductionsData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [244, 67, 54], textColor: [255, 255, 255] },
    columnStyles: {
      0: { halign: 'left', cellWidth: 80 },
      1: { halign: 'right', cellWidth: 40 },
    },
    margin: { left: pageWidth / 2 + 5, right: margin },
  })

  // 實發金額
  const finalY = Math.max(
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y + 50,
    y + 50
  )

  doc.setFillColor(33, 150, 243)
  doc.rect(margin, finalY + 5, pageWidth - margin * 2, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.text('實發金額', margin + 5, finalY + 13)
  doc.text(formatAmountForPDF(netPay), pageWidth - margin - 5, finalY + 13, { align: 'right' })

  // 重置文字顏色
  doc.setTextColor(0, 0, 0)

  // 儲存
  doc.save(`${filename}.pdf`)
}

/**
 * 匯出發票明細 PDF
 */
export interface InvoiceDetailPDFOptions {
  company: string
  period: string
  type: 'sales' | 'purchase'
  invoices: {
    date: string
    invoiceNo: string
    counterparty: string
    description: string
    amount: number
    tax: number
    total: number
  }[]
  filename: string
}

export function exportInvoiceDetailToPDF(options: InvoiceDetailPDFOptions): void {
  const { company, period, type, invoices, filename } = options

  const title = type === 'sales' ? '銷項發票明細表' : '進項發票明細表'
  const counterpartyLabel = type === 'sales' ? '客戶' : '廠商'

  const headers = ['日期', '發票號碼', counterpartyLabel, '品名/摘要', '金額', '稅額', '總計']

  const data = invoices.map(inv => [
    inv.date,
    inv.invoiceNo,
    inv.counterparty,
    inv.description,
    formatAmountForPDF(inv.amount),
    formatAmountForPDF(inv.tax),
    formatAmountForPDF(inv.total),
  ])

  // 加入合計列
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  const totalTax = invoices.reduce((sum, inv) => sum + inv.tax, 0)
  const totalSum = invoices.reduce((sum, inv) => sum + inv.total, 0)
  data.push(['', '', '', '合計', formatAmountForPDF(totalAmount), formatAmountForPDF(totalTax), formatAmountForPDF(totalSum)])

  exportTableToPDF({
    title,
    company,
    period,
    headers,
    data,
    filename,
    orientation: 'landscape',
  })
}

/**
 * 匯出扣繳憑單彙總 PDF
 */
export interface WithholdingPDFOptions {
  company: string
  year: number
  records: {
    idNumber: string
    name: string
    incomeType: string
    totalPayment: number
    withholdingTax: number
  }[]
  filename: string
}

export function exportWithholdingToPDF(options: WithholdingPDFOptions): void {
  const { company, year, records, filename } = options

  const headers = ['身份證字號', '姓名/名稱', '所得類別', '給付總額', '扣繳稅額']

  const data = records.map(rec => [
    rec.idNumber,
    rec.name,
    rec.incomeType,
    formatAmountForPDF(rec.totalPayment),
    formatAmountForPDF(rec.withholdingTax),
  ])

  // 加入合計列
  const totalPayment = records.reduce((sum, rec) => sum + rec.totalPayment, 0)
  const totalTax = records.reduce((sum, rec) => sum + rec.withholdingTax, 0)
  data.push(['', '', '合計', formatAmountForPDF(totalPayment), formatAmountForPDF(totalTax)])

  exportTableToPDF({
    title: '扣繳憑單彙總表',
    subtitle: `民國 ${toROCYear(year)} 年度`,
    company,
    period: `${year} 年度`,
    headers,
    data,
    filename,
    orientation: 'portrait',
  })
}

/**
 * 匯出歷年比較報表 PDF
 */
export interface ComparisonPDFOptions {
  company: string
  reportType: 'income-statement' | 'balance-sheet'
  years: number[]
  data: {
    category: string
    values: Record<number, number>
    changes?: Record<string, { amount: number; percentage: number }>
  }[]
  filename: string
}

export function exportComparisonToPDF(options: ComparisonPDFOptions): void {
  const { company, reportType, years, data, filename } = options

  const title = reportType === 'income-statement' ? '損益表比較分析' : '資產負債表比較分析'

  // 建立表頭
  const headers: string[] = ['項目']
  years.forEach(year => headers.push(`${year}年`))

  // 加入變動欄位
  if (years.length >= 2) {
    for (let i = 1; i < years.length; i++) {
      headers.push(`${years[i]} vs ${years[i-1]}`)
    }
  }

  // 建立資料列
  const tableData = data.map(item => {
    const row: (string | number)[] = [item.category]

    years.forEach(year => {
      row.push(formatAmountForPDF(item.values[year] || 0))
    })

    if (item.changes && years.length >= 2) {
      for (let i = 1; i < years.length; i++) {
        const key = `${years[i]}_${years[i-1]}`
        const change = item.changes[key]
        if (change) {
          const sign = change.amount >= 0 ? '+' : ''
          row.push(`${sign}${formatAmountForPDF(change.amount)} (${sign}${change.percentage.toFixed(1)}%)`)
        } else {
          row.push('-')
        }
      }
    }

    return row
  })

  exportTableToPDF({
    title,
    company,
    period: `${years.join(' / ')} 年度`,
    headers,
    data: tableData,
    filename,
    orientation: 'landscape',
  })
}

/**
 * 匯出損益表 PDF
 */
export interface IncomeStatementPDFOptions {
  company: string
  period: string
  categories: {
    name: string
    amount: number
    type: 'revenue' | 'expense'
  }[]
  totals: {
    revenue: number
    expenses: number
    netIncome: number
  }
  filename: string
}

export function exportIncomeStatementToPDF(options: IncomeStatementPDFOptions): void {
  const { company, period, categories, totals, filename } = options

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // 標題
  doc.setFontSize(14)
  doc.text(company, pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(16)
  doc.text('損益表', pageWidth / 2, y, { align: 'center' })
  y += 6

  doc.setFontSize(10)
  doc.text(period, pageWidth / 2, y, { align: 'center' })
  y += 10

  // 收入
  const revenueItems = categories.filter(c => c.type === 'revenue')
  if (revenueItems.length > 0) {
    doc.setFontSize(11)
    doc.text('營業收入', margin, y)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [['科目', '金額']],
      body: [
        ...revenueItems.map(c => [c.name, formatAmountForPDF(c.amount)]),
        ['營業收入合計', formatAmountForPDF(totals.revenue)],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [76, 175, 80], textColor: [255, 255, 255] },
      columnStyles: {
        0: { halign: 'left', cellWidth: 100 },
        1: { halign: 'right', cellWidth: 50 },
      },
      margin: { left: margin, right: margin },
    })

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // 費用
  const expenseItems = categories.filter(c => c.type === 'expense')
  if (expenseItems.length > 0) {
    doc.setFontSize(11)
    doc.text('營業費用', margin, y)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [['科目', '金額']],
      body: [
        ...expenseItems.map(c => [c.name, formatAmountForPDF(c.amount)]),
        ['營業費用合計', formatAmountForPDF(totals.expenses)],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [244, 67, 54], textColor: [255, 255, 255] },
      columnStyles: {
        0: { halign: 'left', cellWidth: 100 },
        1: { halign: 'right', cellWidth: 50 },
      },
      margin: { left: margin, right: margin },
    })

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // 本期損益
  doc.setFillColor(33, 150, 243)
  doc.rect(margin, y, pageWidth - margin * 2, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.text('本期淨利', margin + 5, y + 8)
  doc.text(formatAmountForPDF(totals.netIncome), pageWidth - margin - 5, y + 8, { align: 'right' })

  doc.setTextColor(0, 0, 0)
  doc.save(`${filename}.pdf`)
}

/**
 * 匯出資產負債表 PDF
 */
export interface BalanceSheetPDFOptions {
  company: string
  date: string
  assets: { name: string; amount: number }[]
  liabilities: { name: string; amount: number }[]
  equity: { name: string; amount: number }[]
  filename: string
}

export function exportBalanceSheetToPDF(options: BalanceSheetPDFOptions): void {
  const { company, date, assets, liabilities, equity, filename } = options

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // 標題
  doc.setFontSize(14)
  doc.text(company, pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(16)
  doc.text('資產負債表', pageWidth / 2, y, { align: 'center' })
  y += 6

  doc.setFontSize(10)
  doc.text(date, pageWidth / 2, y, { align: 'center' })
  y += 10

  // 資產
  const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0)
  doc.setFontSize(11)
  doc.text('資產', margin, y)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [['科目', '金額']],
    body: [
      ...assets.map(a => [a.name, formatAmountForPDF(a.amount)]),
      ['資產合計', formatAmountForPDF(totalAssets)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [33, 150, 243], textColor: [255, 255, 255] },
    columnStyles: {
      0: { halign: 'left', cellWidth: 100 },
      1: { halign: 'right', cellWidth: 50 },
    },
    margin: { left: margin, right: margin },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // 負債
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0)
  doc.setFontSize(11)
  doc.text('負債', margin, y)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [['科目', '金額']],
    body: [
      ...liabilities.map(l => [l.name, formatAmountForPDF(l.amount)]),
      ['負債合計', formatAmountForPDF(totalLiabilities)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [244, 67, 54], textColor: [255, 255, 255] },
    columnStyles: {
      0: { halign: 'left', cellWidth: 100 },
      1: { halign: 'right', cellWidth: 50 },
    },
    margin: { left: margin, right: margin },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // 權益
  const totalEquity = equity.reduce((sum, e) => sum + e.amount, 0)
  doc.setFontSize(11)
  doc.text('權益', margin, y)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [['科目', '金額']],
    body: [
      ...equity.map(e => [e.name, formatAmountForPDF(e.amount)]),
      ['權益合計', formatAmountForPDF(totalEquity)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [76, 175, 80], textColor: [255, 255, 255] },
    columnStyles: {
      0: { halign: 'left', cellWidth: 100 },
      1: { halign: 'right', cellWidth: 50 },
    },
    margin: { left: margin, right: margin },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // 負債 + 權益 = 資產
  doc.setFillColor(100, 100, 100)
  doc.rect(margin, y, pageWidth - margin * 2, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.text('負債 + 權益', margin + 5, y + 8)
  doc.text(formatAmountForPDF(totalLiabilities + totalEquity), pageWidth - margin - 5, y + 8, { align: 'right' })

  doc.setTextColor(0, 0, 0)
  doc.save(`${filename}.pdf`)
}

/**
 * 匯出薪資報表 PDF
 */
export interface PayrollReportPDFOptions {
  company: string
  period: string
  slips: {
    employeeName: string
    department: string
    baseSalary: number
    allowances: number
    overtimePay: number
    grossPay: number
    laborInsurance: number
    healthInsurance: number
    laborPension: number
    incomeTax: number
    totalDeduction: number
    netPay: number
  }[]
  filename: string
}

export function exportPayrollReportToPDF(options: PayrollReportPDFOptions): void {
  const { company, period, slips, filename } = options

  const headers = [
    '姓名',
    '部門',
    '底薪',
    '津貼',
    '加班費',
    '應發',
    '勞保',
    '健保',
    '勞退',
    '所得稅',
    '扣除',
    '實發',
  ]

  const data = slips.map(slip => [
    slip.employeeName,
    slip.department,
    formatAmountForPDF(slip.baseSalary),
    formatAmountForPDF(slip.allowances),
    formatAmountForPDF(slip.overtimePay),
    formatAmountForPDF(slip.grossPay),
    formatAmountForPDF(slip.laborInsurance),
    formatAmountForPDF(slip.healthInsurance),
    formatAmountForPDF(slip.laborPension),
    formatAmountForPDF(slip.incomeTax),
    formatAmountForPDF(slip.totalDeduction),
    formatAmountForPDF(slip.netPay),
  ])

  // 合計列
  const totals = slips.reduce(
    (acc, slip) => ({
      baseSalary: acc.baseSalary + slip.baseSalary,
      allowances: acc.allowances + slip.allowances,
      overtimePay: acc.overtimePay + slip.overtimePay,
      grossPay: acc.grossPay + slip.grossPay,
      laborInsurance: acc.laborInsurance + slip.laborInsurance,
      healthInsurance: acc.healthInsurance + slip.healthInsurance,
      laborPension: acc.laborPension + slip.laborPension,
      incomeTax: acc.incomeTax + slip.incomeTax,
      totalDeduction: acc.totalDeduction + slip.totalDeduction,
      netPay: acc.netPay + slip.netPay,
    }),
    {
      baseSalary: 0,
      allowances: 0,
      overtimePay: 0,
      grossPay: 0,
      laborInsurance: 0,
      healthInsurance: 0,
      laborPension: 0,
      incomeTax: 0,
      totalDeduction: 0,
      netPay: 0,
    }
  )

  data.push([
    '合計',
    '',
    formatAmountForPDF(totals.baseSalary),
    formatAmountForPDF(totals.allowances),
    formatAmountForPDF(totals.overtimePay),
    formatAmountForPDF(totals.grossPay),
    formatAmountForPDF(totals.laborInsurance),
    formatAmountForPDF(totals.healthInsurance),
    formatAmountForPDF(totals.laborPension),
    formatAmountForPDF(totals.incomeTax),
    formatAmountForPDF(totals.totalDeduction),
    formatAmountForPDF(totals.netPay),
  ])

  exportTableToPDF({
    title: '薪資彙總表',
    company,
    period,
    headers,
    data,
    filename,
    orientation: 'landscape',
  })
}
