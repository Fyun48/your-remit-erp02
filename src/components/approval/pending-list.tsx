'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc'
import { FileText, Check, X } from 'lucide-react'

interface PendingListProps {
  approverId: string
}

export function PendingList({ approverId }: PendingListProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)

  const { data: pendingRequests, refetch } = trpc.leaveRequest.listPending.useQuery({
    approverId,
  })

  const approveMutation = trpc.leaveRequest.approve.useMutation({
    onSuccess: () => refetch(),
  })

  const handleApprove = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setProcessingId(id)
    try {
      await approveMutation.mutateAsync({
        id,
        action,
        approverId,
      })
    } catch (error) {
      console.error('Approve error:', error)
      alert(error instanceof Error ? error.message : '審核失敗')
    } finally {
      setProcessingId(null)
    }
  }

  if (!pendingRequests?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            待審核請假
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">目前沒有待審核的請假申請</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          待審核請假 ({pendingRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingRequests.map((req) => (
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
                  onClick={() => handleApprove(req.id, 'APPROVE')}
                  disabled={processingId === req.id}
                >
                  <Check className="h-4 w-4 mr-1" />
                  核准
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleApprove(req.id, 'REJECT')}
                  disabled={processingId === req.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  拒絕
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
