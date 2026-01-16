'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { trpc } from '@/lib/trpc'
import { CheckCircle, XCircle, Clock, User, MessageSquare, Workflow } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface WorkflowStatusProps {
  requestType: string
  requestId: string
}

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待處理', color: 'bg-yellow-100 text-yellow-800' },
  IN_PROGRESS: { label: '簽核中', color: 'bg-blue-100 text-blue-800' },
  APPROVED: { label: '已核准', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: '已駁回', color: 'bg-red-100 text-red-800' },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-800' },
}

const recordStatusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4 text-yellow-500" />,
  APPROVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  REJECTED: <XCircle className="h-4 w-4 text-red-500" />,
}

export function WorkflowStatus({ requestType, requestId }: WorkflowStatusProps) {
  const { data: instance, isLoading } = trpc.workflow.getInstanceByRequest.useQuery({
    requestType,
    requestId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          載入流程狀態...
        </CardContent>
      </Card>
    )
  }

  if (!instance) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          此申請單尚未進入流程簽核
        </CardContent>
      </Card>
    )
  }

  const status = statusLabels[instance.status] || { label: instance.status, color: 'bg-gray-100' }
  const approvedCount = instance.approvalRecords.filter(r => r.status === 'APPROVED').length
  const totalCount = instance.approvalRecords.length
  const progress = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            流程簽核狀態
          </CardTitle>
          <Badge className={status.color}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 流程資訊 */}
        <div className="text-sm text-muted-foreground">
          流程：{instance.definition.name}
        </div>

        {/* 進度條 */}
        {instance.status === 'IN_PROGRESS' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>簽核進度</span>
              <span>{approvedCount} / {totalCount}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 簽核紀錄 */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">簽核紀錄</h4>
          <div className="space-y-2">
            {instance.approvalRecords.map((record, index) => (
              <div
                key={record.id}
                className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {recordStatusIcons[record.status] || <Clock className="h-4 w-4 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {record.node.name || `簽核 ${index + 1}`}
                    </span>
                    {record.status === 'PENDING' && (
                      <Badge variant="outline" className="text-xs">待簽核</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <User className="h-3 w-3" />
                    <span>
                      {record.actualSigner?.name || record.approver.name}
                      {record.actualSigner && record.actualSigner.id !== record.approver.id && (
                        <span className="text-xs">（代簽）</span>
                      )}
                    </span>
                  </div>
                  {record.comment && (
                    <div className="flex items-start gap-1 text-sm mt-2 p-2 bg-white rounded border">
                      <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground" />
                      <span>{record.comment}</span>
                    </div>
                  )}
                  {record.actionAt && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(record.actionAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                      （{formatDistanceToNow(new Date(record.actionAt), { addSuffix: true, locale: zhTW })}）
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 完成資訊 */}
        {instance.completedAt && (
          <div className="pt-4 border-t text-sm text-muted-foreground">
            完成時間：{format(new Date(instance.completedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
