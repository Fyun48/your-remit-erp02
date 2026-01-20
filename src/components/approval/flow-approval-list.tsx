'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/lib/trpc'
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  User,
  GitBranch,
  UserCheck,
  History,
  AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { FlowModuleType, FlowApprovalDecision } from '@prisma/client'

interface FlowApprovalListProps {
  employeeId: string
}

const moduleTypeLabels: Record<FlowModuleType, string> = {
  LEAVE: '請假申請',
  EXPENSE: '費用核銷',
  SEAL: '用印申請',
  CARD: '名片申請',
  STATIONERY: '文具領用',
  OVERTIME: '加班申請',
  BUSINESS_TRIP: '出差申請',
}

const decisionLabels: Record<FlowApprovalDecision, { label: string; color: string }> = {
  APPROVED: { label: '核准', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: '駁回', color: 'bg-red-100 text-red-700' },
}

export function FlowApprovalList({ employeeId }: FlowApprovalListProps) {
  const [selectedRecord, setSelectedRecord] = useState<{
    executionId: string
    stepName: string
    applicantName: string
    moduleType: FlowModuleType
    delegationId?: string
    isDelegated?: boolean
    delegatorName?: string
  } | null>(null)
  const [comment, setComment] = useState('')
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null)

  // 待審核項目
  const { data: pendingApprovals, isLoading: pendingLoading, refetch: refetchPending } =
    trpc.flowExecution.getPending.useQuery({ employeeId })

  // 代理待審核項目
  const { data: proxyApprovals, isLoading: proxyLoading, refetch: refetchProxy } =
    trpc.flowExecution.getProxyPending.useQuery({ employeeId })

  // 審核歷史
  const { data: historyRecords, isLoading: historyLoading } =
    trpc.flowExecution.getHistory.useQuery({ employeeId, limit: 10 })

  const decisionMutation = trpc.flowExecution.decide.useMutation({
    onSuccess: () => {
      setSelectedRecord(null)
      setComment('')
      setActionType(null)
      refetchPending()
      refetchProxy()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleAction = (
    executionId: string,
    stepName: string,
    applicantName: string,
    moduleType: FlowModuleType,
    action: 'APPROVED' | 'REJECTED',
    delegationId?: string,
    delegatorName?: string
  ) => {
    setSelectedRecord({
      executionId,
      stepName,
      applicantName,
      moduleType,
      delegationId,
      isDelegated: !!delegationId,
      delegatorName,
    })
    setActionType(action)
  }

  const confirmAction = () => {
    if (!selectedRecord || !actionType) return

    decisionMutation.mutate({
      executionId: selectedRecord.executionId,
      approverId: employeeId,
      decision: actionType,
      comment: comment || undefined,
      proxyDelegationId: selectedRecord.delegationId,
    })
  }

  const isLoading = pendingLoading || proxyLoading

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          載入中...
        </CardContent>
      </Card>
    )
  }

  const totalPending = (pendingApprovals?.length || 0) + (proxyApprovals?.length || 0)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            審核流程 ({totalPending})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending" className="gap-1">
                <Clock className="h-4 w-4" />
                待審核 ({pendingApprovals?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="proxy" className="gap-1">
                <UserCheck className="h-4 w-4" />
                代理審核 ({proxyApprovals?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1">
                <History className="h-4 w-4" />
                審核歷史
              </TabsTrigger>
            </TabsList>

            {/* 待審核 */}
            <TabsContent value="pending">
              {!pendingApprovals || pendingApprovals.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-3" />
                  <p className="text-muted-foreground">目前沒有待審核的項目</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApprovals.map((record) => (
                    <ApprovalCard
                      key={record.id}
                      executionId={record.execution.id}
                      stepName={record.stepName}
                      stepOrder={record.stepOrder}
                      totalSteps={record.execution.approvals?.length || 1}
                      applicantName={record.execution.applicant.name}
                      applicantNo={record.execution.applicant.employeeNo}
                      moduleType={record.execution.moduleType as FlowModuleType}
                      templateName={record.execution.template.name}
                      createdAt={record.execution.createdAt}
                      onApprove={() =>
                        handleAction(
                          record.execution.id,
                          record.stepName,
                          record.execution.applicant.name,
                          record.execution.moduleType as FlowModuleType,
                          'APPROVED'
                        )
                      }
                      onReject={() =>
                        handleAction(
                          record.execution.id,
                          record.stepName,
                          record.execution.applicant.name,
                          record.execution.moduleType as FlowModuleType,
                          'REJECTED'
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 代理審核 */}
            <TabsContent value="proxy">
              {!proxyApprovals || proxyApprovals.length === 0 ? (
                <div className="py-8 text-center">
                  <UserCheck className="h-10 w-10 mx-auto text-purple-500 mb-3" />
                  <p className="text-muted-foreground">目前沒有可代理審核的項目</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proxyApprovals.map((record) => (
                    <ApprovalCard
                      key={record.id}
                      executionId={record.execution.id}
                      stepName={record.stepName}
                      stepOrder={record.stepOrder}
                      totalSteps={record.execution.approvals?.length || 1}
                      applicantName={record.execution.applicant.name}
                      applicantNo={record.execution.applicant.employeeNo}
                      moduleType={record.execution.moduleType as FlowModuleType}
                      templateName={record.execution.template.name}
                      createdAt={record.execution.createdAt}
                      isDelegated
                      delegatorName={(record as { delegation?: { delegator?: { name: string } } }).delegation?.delegator?.name}
                      onApprove={() =>
                        handleAction(
                          record.execution.id,
                          record.stepName,
                          record.execution.applicant.name,
                          record.execution.moduleType as FlowModuleType,
                          'APPROVED',
                          (record as { delegation?: { id: string } }).delegation?.id,
                          (record as { delegation?: { delegator?: { name: string } } }).delegation?.delegator?.name
                        )
                      }
                      onReject={() =>
                        handleAction(
                          record.execution.id,
                          record.stepName,
                          record.execution.applicant.name,
                          record.execution.moduleType as FlowModuleType,
                          'REJECTED',
                          (record as { delegation?: { id: string } }).delegation?.id,
                          (record as { delegation?: { delegator?: { name: string } } }).delegation?.delegator?.name
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 審核歷史 */}
            <TabsContent value="history">
              {historyLoading ? (
                <div className="py-8 text-center text-muted-foreground">載入中...</div>
              ) : !historyRecords || historyRecords.length === 0 ? (
                <div className="py-8 text-center">
                  <History className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                  <p className="text-muted-foreground">尚無審核歷史</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {moduleTypeLabels[record.execution.template.moduleType as FlowModuleType] ||
                              record.execution.template.moduleType}
                          </span>
                          <Badge
                            className={
                              decisionLabels[record.decision as FlowApprovalDecision]?.color
                            }
                          >
                            {decisionLabels[record.decision as FlowApprovalDecision]?.label}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {record.decidedAt &&
                            format(new Date(record.decidedAt), 'yyyy/MM/dd HH:mm')}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span>申請人：{record.execution.applicant.name}</span>
                        {record.comment && (
                          <p className="mt-1 text-xs bg-muted p-2 rounded">
                            「{record.comment}」
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 確認對話框 */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'APPROVED' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {actionType === 'APPROVED' ? '確認核准' : '確認駁回'}
            </DialogTitle>
            <DialogDescription>
              {selectedRecord && (
                <>
                  {moduleTypeLabels[selectedRecord.moduleType]} - {selectedRecord.stepName}
                  <br />
                  申請人：{selectedRecord.applicantName}
                  {selectedRecord.isDelegated && selectedRecord.delegatorName && (
                    <>
                      <br />
                      <span className="text-purple-600">
                        代理 {selectedRecord.delegatorName} 審核
                      </span>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {actionType === 'REJECTED' && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <span className="text-yellow-700">
                  駁回後，此申請將被退回給申請人，請確認。
                </span>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">
                簽核意見{actionType === 'REJECTED' ? '（建議填寫駁回原因）' : '（選填）'}
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="輸入簽核意見..."
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRecord(null)}>
              取消
            </Button>
            <Button
              variant={actionType === 'REJECTED' ? 'destructive' : 'default'}
              onClick={confirmAction}
              disabled={decisionMutation.isPending}
            >
              {decisionMutation.isPending ? '處理中...' : '確認'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// 審核卡片子元件
interface ApprovalCardProps {
  executionId: string
  stepName: string
  stepOrder: number
  totalSteps: number
  applicantName: string
  applicantNo: string
  moduleType: FlowModuleType
  templateName: string
  createdAt: Date | string
  isDelegated?: boolean
  delegatorName?: string
  onApprove: () => void
  onReject: () => void
}

function ApprovalCard({
  stepName,
  stepOrder,
  totalSteps,
  applicantName,
  applicantNo,
  moduleType,
  templateName,
  createdAt,
  isDelegated,
  delegatorName,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  return (
    <div
      className={`p-4 border rounded-lg hover:shadow-sm transition-shadow ${
        isDelegated ? 'border-purple-200 bg-purple-50/30' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${isDelegated ? 'bg-purple-100' : 'bg-blue-100'}`}
          >
            <FileText
              className={`h-5 w-5 ${isDelegated ? 'text-purple-600' : 'text-blue-600'}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">
                {moduleTypeLabels[moduleType] || moduleType}
              </p>
              {isDelegated && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  <UserCheck className="h-3 w-3 mr-1" />
                  代理
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{templateName}</p>
          </div>
        </div>
        <Badge variant="outline">
          第 {stepOrder}/{totalSteps} 關 - {stepName}
        </Badge>
      </div>

      <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
        <div className="flex items-center gap-1">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>
            申請人：{applicantName} ({applicantNo})
          </span>
        </div>
        {isDelegated && delegatorName && (
          <div className="flex items-center gap-1 text-purple-600">
            <UserCheck className="h-4 w-4" />
            <span>代理：{delegatorName}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            {formatDistanceToNow(new Date(createdAt), {
              addSuffix: true,
              locale: zhTW,
            })}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={onApprove}>
          <CheckCircle className="h-4 w-4 mr-1" />
          核准
        </Button>
        <Button size="sm" variant="destructive" className="flex-1" onClick={onReject}>
          <XCircle className="h-4 w-4 mr-1" />
          駁回
        </Button>
      </div>
    </div>
  )
}
