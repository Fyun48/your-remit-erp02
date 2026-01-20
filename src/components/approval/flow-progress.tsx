'use client'

import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle,
  XCircle,
  Clock,
  Circle,
  User,
  GitBranch,
  AlertCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import type { FlowModuleType, FlowExecutionStatus, FlowApprovalDecision } from '@prisma/client'

interface FlowProgressProps {
  moduleType: FlowModuleType
  referenceId: string
  showTitle?: boolean
}

const statusConfig: Record<
  FlowExecutionStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: '審核中',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: <Clock className="h-4 w-4" />,
  },
  APPROVED: {
    label: '已核准',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  REJECTED: {
    label: '已駁回',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: <XCircle className="h-4 w-4" />,
  },
  CANCELLED: {
    label: '已取消',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: <AlertCircle className="h-4 w-4" />,
  },
}

const decisionConfig: Record<
  FlowApprovalDecision,
  { label: string; color: string; icon: React.ReactNode }
> = {
  APPROVED: {
    label: '核准',
    color: 'text-green-600',
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
  },
  REJECTED: {
    label: '駁回',
    color: 'text-red-600',
    icon: <XCircle className="h-4 w-4 text-red-500" />,
  },
}

export function FlowProgress({ moduleType, referenceId, showTitle = true }: FlowProgressProps) {
  const { data: execution, isLoading } = trpc.flowExecution.getByReference.useQuery({
    moduleType,
    referenceId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4 text-center text-muted-foreground">
          載入審核進度...
        </CardContent>
      </Card>
    )
  }

  if (!execution) {
    return (
      <Card>
        <CardContent className="py-4 text-center text-muted-foreground">
          <AlertCircle className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
          <p>尚未啟動審核流程</p>
        </CardContent>
      </Card>
    )
  }

  const status = statusConfig[execution.status as FlowExecutionStatus]

  return (
    <Card>
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              審核進度
            </span>
            <Badge className={status.color}>
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={showTitle ? '' : 'pt-4'}>
        {!showTitle && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              審核進度
            </span>
            <Badge className={status.color}>
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
          </div>
        )}

        <div className="text-sm text-muted-foreground mb-4">
          流程：{execution.template.name}
        </div>

        {/* 審核關卡時間軸 */}
        <div className="relative">
          {execution.approvals.map((record, index) => {
            const isCurrentStep = record.stepOrder === execution.currentStep
            const isPassed = record.decision === 'APPROVED'
            const isRejected = record.decision === 'REJECTED'
            const isPending = !record.decision

            return (
              <div key={record.id} className="flex gap-3 pb-4 last:pb-0">
                {/* 時間軸線 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                      isPassed
                        ? 'bg-green-100 border-green-500'
                        : isRejected
                        ? 'bg-red-100 border-red-500'
                        : isCurrentStep
                        ? 'bg-yellow-100 border-yellow-500'
                        : 'bg-gray-100 border-gray-300'
                    }`}
                  >
                    {isPassed ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : isRejected ? (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ) : isCurrentStep ? (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  {index < execution.approvals.length - 1 && (
                    <div
                      className={`w-0.5 flex-1 min-h-[20px] ${
                        isPassed ? 'bg-green-300' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>

                {/* 關卡內容 */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${
                        isCurrentStep ? 'text-yellow-700' : ''
                      }`}
                    >
                      第 {record.stepOrder} 關：{record.stepName}
                    </span>
                    {isCurrentStep && isPending && (
                      <Badge variant="outline" className="text-xs">
                        目前關卡
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>審核人：{record.assignee.name}</span>
                      {record.actualApprover && (
                        <span className="text-purple-600">
                          （由 {record.actualApprover.name} 代理）
                        </span>
                      )}
                    </div>

                    {record.decision && (
                      <div className="mt-1">
                        <span className={decisionConfig[record.decision as FlowApprovalDecision].color}>
                          {decisionConfig[record.decision as FlowApprovalDecision].label}
                        </span>
                        {record.decidedAt && (
                          <span className="text-muted-foreground ml-2">
                            於 {format(new Date(record.decidedAt), 'yyyy/MM/dd HH:mm')}
                          </span>
                        )}
                      </div>
                    )}

                    {record.comment && (
                      <p className="mt-1 text-xs bg-muted p-2 rounded">
                        「{record.comment}」
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// 簡化版進度指示器（用於列表顯示）
interface FlowProgressBadgeProps {
  moduleType: FlowModuleType
  referenceId: string
}

export function FlowProgressBadge({ moduleType, referenceId }: FlowProgressBadgeProps) {
  const { data: execution } = trpc.flowExecution.getByReference.useQuery({
    moduleType,
    referenceId,
  })

  if (!execution) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        未送審
      </Badge>
    )
  }

  const status = statusConfig[execution.status as FlowExecutionStatus]

  return (
    <Badge className={status.color}>
      {status.icon}
      <span className="ml-1">
        {execution.status === 'PENDING'
          ? `${status.label} (${execution.currentStep}/${execution.approvals.length})`
          : status.label}
      </span>
    </Badge>
  )
}
