'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc'
import { FileText, Receipt, Check, X } from 'lucide-react'

interface PendingListProps {
  approverId: string
}

export function PendingList({ approverId }: PendingListProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)

  // 請假待審核
  const { data: pendingLeaveRequests, refetch: refetchLeave } = trpc.leaveRequest.listPending.useQuery({
    approverId,
  })

  // 費用報銷待審核
  const { data: pendingExpenseRequests, refetch: refetchExpense } = trpc.expenseRequest.listPending.useQuery({
    approverId,
  })

  const leaveApproveMutation = trpc.leaveRequest.approve.useMutation({
    onSuccess: () => refetchLeave(),
  })

  const expenseApproveMutation = trpc.expenseRequest.approve.useMutation({
    onSuccess: () => refetchExpense(),
  })

  const handleLeaveApprove = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setProcessingId(id)
    try {
      await leaveApproveMutation.mutateAsync({
        id,
        action,
        approverId,
      })
    } catch (error) {
      console.error('Leave approve error:', error)
      alert(error instanceof Error ? error.message : '審核失敗')
    } finally {
      setProcessingId(null)
    }
  }

  const handleExpenseApprove = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setProcessingId(id)
    try {
      await expenseApproveMutation.mutateAsync({
        id,
        action,
        approverId,
      })
    } catch (error) {
      console.error('Expense approve error:', error)
      alert(error instanceof Error ? error.message : '審核失敗')
    } finally {
      setProcessingId(null)
    }
  }

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* 待審核請假 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            待審核請假 ({pendingLeaveRequests?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!pendingLeaveRequests?.length ? (
            <p className="text-muted-foreground text-center py-8">目前沒有待審核的請假申請</p>
          ) : (
            <div className="space-y-4">
              {pendingLeaveRequests.map((req) => (
                <div key={req.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{req.requestNo}</p>
                      <p className="text-sm text-muted-foreground">
                        {req.leaveType.name} | {req.totalHours / 8} 天
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {new Date(req.startDate).toLocaleDateString('zh-TW')}
                      {req.startDate.getTime() !== req.endDate.getTime() && (
                        <> ~ {new Date(req.endDate).toLocaleDateString('zh-TW')}</>
                      )}
                    </div>
                  </div>
                  {req.reason && (
                    <p className="text-sm text-muted-foreground mb-3">
                      事由：{req.reason}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleLeaveApprove(req.id, 'APPROVE')}
                      disabled={processingId === req.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      核准
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleLeaveApprove(req.id, 'REJECT')}
                      disabled={processingId === req.id}
                    >
                      <X className="h-4 w-4 mr-1" />
                      拒絕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 待審核費用報銷 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            待審核費用報銷 ({pendingExpenseRequests?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!pendingExpenseRequests?.length ? (
            <p className="text-muted-foreground text-center py-8">目前沒有待審核的費用報銷申請</p>
          ) : (
            <div className="space-y-4">
              {pendingExpenseRequests.map((req) => (
                <div key={req.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{req.requestNo}</p>
                      <p className="text-sm text-muted-foreground">
                        {req.title}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-lg">{formatAmount(req.totalAmount)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(req.periodStart).toLocaleDateString('zh-TW')}
                        {req.periodStart.getTime() !== req.periodEnd.getTime() && (
                          <> ~ {new Date(req.periodEnd).toLocaleDateString('zh-TW')}</>
                        )}
                      </p>
                    </div>
                  </div>
                  {req.items && req.items.length > 0 && (
                    <div className="text-sm text-muted-foreground mb-3">
                      <p>明細：{req.items.length} 筆</p>
                      <ul className="list-disc list-inside mt-1">
                        {req.items.slice(0, 3).map((item) => (
                          <li key={item.id}>
                            {item.category?.name}: {formatAmount(item.amount)}
                          </li>
                        ))}
                        {req.items.length > 3 && (
                          <li>... 還有 {req.items.length - 3} 筆</li>
                        )}
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleExpenseApprove(req.id, 'APPROVE')}
                      disabled={processingId === req.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      核准
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleExpenseApprove(req.id, 'REJECT')}
                      disabled={processingId === req.id}
                    >
                      <X className="h-4 w-4 mr-1" />
                      拒絕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
