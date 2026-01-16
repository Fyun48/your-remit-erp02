'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkflowStatus } from '@/components/workflow/workflow-status'
import { ArrowLeft, Receipt, Calendar, Building, User } from 'lucide-react'
import { format } from 'date-fns'

interface ExpenseItem {
  id: string
  expenseDate: Date
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
                        {format(new Date(item.expenseDate), 'yyyy/MM/dd')}
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
