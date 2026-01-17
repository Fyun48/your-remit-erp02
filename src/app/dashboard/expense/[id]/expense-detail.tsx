'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkflowStatus } from '@/components/workflow/workflow-status'
import { ArrowLeft, Receipt, Calendar, Building, User, Printer } from 'lucide-react'
import { format } from 'date-fns'

interface ExpenseItem {
  id: string
  date: Date
  description: string
  amount: number
  vendorName: string | null
  receiptNo: string | null
  category: { id: string; name: string }
}

interface Expense {
  id: string
  requestNo: string
  title: string
  description: string | null
  status: string
  totalAmount: number
  periodStart: Date
  periodEnd: Date
  createdAt: Date
  submittedAt: Date | null
  employee: { id: string; name: string; employeeNo: string }
  company: { id: string; name: string }
  items: ExpenseItem[]
}

interface ExpenseDetailProps {
  expense: Expense
  currentUserId: string
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: '草稿', variant: 'secondary' },
  PENDING: { label: '待審核', variant: 'outline' },
  APPROVED: { label: '已核准', variant: 'default' },
  REJECTED: { label: '已駁回', variant: 'destructive' },
  CANCELLED: { label: '已取消', variant: 'secondary' },
}

export function ExpenseDetail({ expense }: ExpenseDetailProps) {
  const status = statusConfig[expense.status] || { label: expense.status, variant: 'outline' as const }
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>費用報銷單 - ${expense.requestNo}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif;
              padding: 20mm;
              font-size: 12pt;
              line-height: 1.5;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .company-name { font-size: 18pt; font-weight: bold; margin-bottom: 5px; }
            .document-title { font-size: 16pt; font-weight: bold; margin-top: 10px; }
            .request-no { font-size: 10pt; color: #666; margin-top: 5px; }
            .info-section {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              margin-bottom: 20px;
              padding: 10px;
              background: #f9f9f9;
              border-radius: 4px;
            }
            .info-item { flex: 1; min-width: 200px; }
            .info-label { color: #666; font-size: 10pt; }
            .info-value { font-weight: 500; }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .items-table th, .items-table td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            .items-table th {
              background: #f5f5f5;
              font-weight: bold;
            }
            .items-table td.amount { text-align: right; font-family: monospace; }
            .total-row {
              display: flex;
              justify-content: flex-end;
              align-items: center;
              gap: 20px;
              padding: 15px;
              background: #f0f0f0;
              border-radius: 4px;
              margin-bottom: 30px;
            }
            .total-label { font-size: 14pt; font-weight: 500; }
            .total-amount { font-size: 18pt; font-weight: bold; color: #1a56db; }
            .signature-section {
              display: flex;
              justify-content: space-between;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
            }
            .signature-box {
              width: 150px;
              text-align: center;
            }
            .signature-line {
              border-bottom: 1px solid #333;
              height: 40px;
              margin-bottom: 5px;
            }
            .signature-label { font-size: 10pt; color: #666; }
            .description {
              padding: 10px;
              background: #f9f9f9;
              border-radius: 4px;
              margin-bottom: 15px;
            }
            .description-label { color: #666; font-size: 10pt; margin-bottom: 5px; }
            @media print {
              body { padding: 10mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${expense.company.name}</div>
            <div class="document-title">費用報銷單</div>
            <div class="request-no">單號：${expense.requestNo}</div>
          </div>

          <div class="info-section">
            <div class="info-item">
              <div class="info-label">申請人</div>
              <div class="info-value">${expense.employee.name} (${expense.employee.employeeNo})</div>
            </div>
            <div class="info-item">
              <div class="info-label">報銷期間</div>
              <div class="info-value">${format(new Date(expense.periodStart), 'yyyy/MM/dd')} - ${format(new Date(expense.periodEnd), 'yyyy/MM/dd')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">申請日期</div>
              <div class="info-value">${format(new Date(expense.createdAt), 'yyyy/MM/dd')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">狀態</div>
              <div class="info-value">${status.label}</div>
            </div>
          </div>

          ${expense.description ? `
          <div class="description">
            <div class="description-label">說明</div>
            <div>${expense.description}</div>
          </div>
          ` : ''}

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th style="width: 100px;">日期</th>
                <th style="width: 100px;">類別</th>
                <th>說明</th>
                <th style="width: 120px;">廠商</th>
                <th style="width: 100px;">發票號碼</th>
                <th style="width: 100px;">金額</th>
              </tr>
            </thead>
            <tbody>
              ${expense.items.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${format(new Date(item.date), 'yyyy/MM/dd')}</td>
                  <td>${item.category.name}</td>
                  <td>${item.description}</td>
                  <td>${item.vendorName || '-'}</td>
                  <td>${item.receiptNo || '-'}</td>
                  <td class="amount">$${item.amount.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total-row">
            <span class="total-label">總金額：</span>
            <span class="total-amount">$${expense.totalAmount.toLocaleString()} TWD</span>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-label">申請人</div>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-label">部門主管</div>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-label">財務</div>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-label">核准</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/expense">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{expense.title}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {expense.requestNo} | {expense.company.name}
          </p>
        </div>
        {expense.status === 'APPROVED' && (
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            列印
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 左側：基本資訊 */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                報銷資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">申請人：</span>
                  <span>{expense.employee.name} ({expense.employee.employeeNo})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">報銷公司：</span>
                  <span>{expense.company.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">報銷期間：</span>
                  <span>
                    {format(new Date(expense.periodStart), 'yyyy/MM/dd')} - {format(new Date(expense.periodEnd), 'yyyy/MM/dd')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">申請日期：</span>
                  <span>{format(new Date(expense.createdAt), 'yyyy/MM/dd HH:mm')}</span>
                </div>
              </div>

              {expense.description && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">說明</p>
                  <p className="text-sm">{expense.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 費用明細 */}
          <Card>
            <CardHeader>
              <CardTitle>費用明細</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expense.items.map((item, index) => (
                  <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        <Badge variant="outline">{item.category.name}</Badge>
                      </div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(item.date), 'yyyy/MM/dd')}
                        {item.vendorName && ` | ${item.vendorName}`}
                        {item.receiptNo && ` | 發票：${item.receiptNo}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${item.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end items-center gap-4 pt-4 mt-4 border-t">
                <span className="text-lg font-medium">總金額：</span>
                <span className="text-2xl font-bold text-primary">
                  ${expense.totalAmount.toLocaleString()} TWD
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右側：簽核狀態 */}
        <div className="space-y-6">
          <WorkflowStatus
            requestType="EXPENSE"
            requestId={expense.id}
          />
        </div>
      </div>
    </div>
  )
}
