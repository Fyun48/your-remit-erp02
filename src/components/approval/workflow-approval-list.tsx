'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/lib/trpc'
import { CheckCircle, XCircle, Clock, FileText, User, Workflow, UserCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface WorkflowApprovalListProps {
  userId: string
}

const requestTypeLabels: Record<string, string> = {
  EXPENSE: '費用報銷',
  LEAVE: '請假申請',
  SEAL: '用印申請',
  BUSINESS_CARD: '名片申請',
  STATIONERY: '文具領用',
}

export function WorkflowApprovalList({ userId }: WorkflowApprovalListProps) {
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null)

  const { data: pendingApprovals, isLoading, refetch } = trpc.workflow.getPendingApprovals.useQuery({
    approverId: userId,
  })

  const processApproval = trpc.workflow.processApproval.useMutation({
    onSuccess: () => {
      setSelectedRecord(null)
      setComment('')
      setActionType(null)
      refetch()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleAction = (recordId: string, action: 'APPROVE' | 'REJECT') => {
    setSelectedRecord(recordId)
    setActionType(action)
  }

  const confirmAction = () => {
    if (!selectedRecord || !actionType) return

    const record = pendingApprovals?.find(r => r.id === selectedRecord)
    if (!record) return

    processApproval.mutate({
      instanceId: record.instanceId,
      recordId: selectedRecord,
      action: actionType,
      comment: comment || undefined,
      signerId: userId,
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          載入中...
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            工作流程待簽核 ({pendingApprovals?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!pendingApprovals || pendingApprovals.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-3" />
              <p className="text-muted-foreground">目前沒有待簽核的項目</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.map((record) => (
                <div key={record.id} className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${record.isDelegated ? 'bg-purple-100' : 'bg-blue-100'}`}>
                        <FileText className={`h-5 w-5 ${record.isDelegated ? 'text-purple-600' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {requestTypeLabels[record.instance.requestType] || record.instance.requestType}
                          </p>
                          {record.isDelegated && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                              <UserCheck className="h-3 w-3 mr-1" />
                              代理
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {record.instance.definition.name}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {record.node.name || '審批'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>申請人：{record.instance.applicant.name}</span>
                    </div>
                    {record.isDelegated && record.originalApprover && (
                      <div className="flex items-center gap-1 text-purple-600">
                        <UserCheck className="h-4 w-4" />
                        <span>代理：{record.originalApprover.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {formatDistanceToNow(new Date(record.assignedAt), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAction(record.id, 'APPROVE')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      核准
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleAction(record.id, 'REJECT')}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      駁回
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 確認對話框 */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'APPROVE' ? '確認核准' : '確認駁回'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">簽核意見（選填）</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="輸入簽核意見..."
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRecord(null)}>
              取消
            </Button>
            <Button
              variant={actionType === 'REJECT' ? 'destructive' : 'default'}
              onClick={confirmAction}
              disabled={processApproval.isPending}
            >
              {processApproval.isPending ? '處理中...' : '確認'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
