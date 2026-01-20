'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, UserCheck, Plus, Clock, CheckCircle, XCircle, Users, Ban } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface DelegationListProps {
  companyId: string
  companyName: string
  currentUserId: string
}

const statusConfig = {
  PENDING: { label: '待接受', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  ACCEPTED: { label: '已接受', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '已拒絕', color: 'bg-red-100 text-red-700', icon: XCircle },
  EXPIRED: { label: '已過期', color: 'bg-gray-100 text-gray-700', icon: Clock },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-700', icon: XCircle },
}

const permissionLabels: Record<string, string> = {
  APPROVE_LEAVE: '代理審核請假',
  APPROVE_EXPENSE: '代理審核費用核銷',
  APPROVE_SEAL: '代理審核用印',
  APPROVE_CARD: '代理審核名片',
  APPROVE_STATIONERY: '代理審核文具',
  APPLY_LEAVE: '代理申請請假',
  APPLY_EXPENSE: '代理申請費用核銷',
  VIEW_REPORTS: '代理查看報表',
}

export function DelegationList({ companyId, companyName, currentUserId }: DelegationListProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('my')

  // Dialog states
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedDelegation, setSelectedDelegation] = useState<{ id: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  const utils = trpc.useUtils()

  // 取得我的代理關係（作為委託人和代理人）
  const { data: myDelegations, isLoading: loadingMy } = trpc.delegation.getMyDelegations.useQuery(
    { employeeId: currentUserId }
  )

  // 取得公司的所有代理設定（管理員視角）
  const { data: allDelegations, isLoading: loadingAll } = trpc.delegation.list.useQuery(
    { companyId }
  )

  // Mutations
  const acceptMutation = trpc.delegation.accept.useMutation({
    onSuccess: () => {
      utils.delegation.getMyDelegations.invalidate()
      utils.delegation.list.invalidate()
      setAcceptDialogOpen(false)
      setSelectedDelegation(null)
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const rejectMutation = trpc.delegation.reject.useMutation({
    onSuccess: () => {
      utils.delegation.getMyDelegations.invalidate()
      utils.delegation.list.invalidate()
      setRejectDialogOpen(false)
      setSelectedDelegation(null)
      setRejectReason('')
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const cancelMutation = trpc.delegation.cancel.useMutation({
    onSuccess: () => {
      utils.delegation.getMyDelegations.invalidate()
      utils.delegation.list.invalidate()
      setCancelDialogOpen(false)
      setSelectedDelegation(null)
      setCancelReason('')
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleAccept = (id: string, name: string) => {
    setSelectedDelegation({ id, name })
    setAcceptDialogOpen(true)
  }

  const handleReject = (id: string, name: string) => {
    setSelectedDelegation({ id, name })
    setRejectDialogOpen(true)
  }

  const handleCancel = (id: string, name: string) => {
    setSelectedDelegation({ id, name })
    setCancelDialogOpen(true)
  }

  const confirmAccept = () => {
    if (!selectedDelegation) return
    acceptMutation.mutate({
      id: selectedDelegation.id,
      employeeId: currentUserId,
    })
  }

  const confirmReject = () => {
    if (!selectedDelegation) return
    rejectMutation.mutate({
      id: selectedDelegation.id,
      employeeId: currentUserId,
      reason: rejectReason || undefined,
    })
  }

  const confirmCancel = () => {
    if (!selectedDelegation) return
    if (cancelReason.length < 10) {
      alert('取消原因至少需要 10 個字')
      return
    }
    cancelMutation.mutate({
      id: selectedDelegation.id,
      cancelledById: currentUserId,
      reason: cancelReason,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hr">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">職務代理</h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <Link href="/dashboard/hr/delegation/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增代理
          </Button>
        </Link>
      </div>

      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        <p>職務代理功能讓您可以在休假或無法處理業務時，將審核或申請權限暫時委託給其他同仁。代理邀請需對方接受後才會生效。</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my">我的代理</TabsTrigger>
          <TabsTrigger value="all">全部代理</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-6">
          {loadingMy ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : (
            <>
              {/* 我委託給別人的 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    我委託的代理
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {myDelegations?.asDelegator && myDelegations.asDelegator.length > 0 ? (
                    <div className="space-y-3">
                      {myDelegations.asDelegator.map((d) => {
                        const config = statusConfig[d.status as keyof typeof statusConfig]
                        const StatusIcon = config?.icon || Clock
                        const canCancel = d.status === 'PENDING' || d.status === 'ACCEPTED'
                        return (
                          <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{d.delegate.name}</span>
                                <Badge className={config?.color}>{config?.label}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(d.startDate).toLocaleDateString('zh-TW')}
                                {d.endDate && <> ~ {new Date(d.endDate).toLocaleDateString('zh-TW')}</>}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {d.permissions.map((p) => (
                                  <Badge key={p.id} variant="outline" className="text-xs">
                                    {permissionLabels[p.permissionType] || p.permissionType}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canCancel && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleCancel(d.id, d.delegate.name)}
                                >
                                  <Ban className="h-4 w-4 mr-1" />
                                  取消
                                </Button>
                              )}
                              <StatusIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">尚未委託任何代理</p>
                  )}
                </CardContent>
              </Card>

              {/* 別人委託給我的 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    我被委託的代理
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {myDelegations?.asDelegate && myDelegations.asDelegate.length > 0 ? (
                    <div className="space-y-3">
                      {myDelegations.asDelegate.map((d) => {
                        const config = statusConfig[d.status as keyof typeof statusConfig]
                        const canCancel = d.status === 'ACCEPTED'
                        return (
                          <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{d.delegator.name}</span>
                                <Badge className={config?.color}>{config?.label}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(d.startDate).toLocaleDateString('zh-TW')}
                                {d.endDate && <> ~ {new Date(d.endDate).toLocaleDateString('zh-TW')}</>}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {d.permissions.map((p) => (
                                  <Badge key={p.id} variant="outline" className="text-xs">
                                    {permissionLabels[p.permissionType] || p.permissionType}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {d.status === 'PENDING' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReject(d.id, d.delegator.name)}
                                  >
                                    拒絕
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAccept(d.id, d.delegator.name)}
                                  >
                                    接受
                                  </Button>
                                </>
                              )}
                              {canCancel && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleCancel(d.id, d.delegator.name)}
                                >
                                  <Ban className="h-4 w-4 mr-1" />
                                  取消
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">尚無人委託代理給您</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>公司代理設定</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAll ? (
                <div className="text-center py-8 text-muted-foreground">載入中...</div>
              ) : allDelegations && allDelegations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">委託人</th>
                        <th className="text-left py-3 px-2 font-medium">代理人</th>
                        <th className="text-left py-3 px-2 font-medium">期間</th>
                        <th className="text-left py-3 px-2 font-medium">狀態</th>
                        <th className="text-left py-3 px-2 font-medium">代理權限</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDelegations.map((d) => {
                        const config = statusConfig[d.status as keyof typeof statusConfig]
                        return (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-3 px-2">{d.delegator.name}</td>
                            <td className="py-3 px-2">{d.delegate.name}</td>
                            <td className="py-3 px-2 text-sm">
                              {new Date(d.startDate).toLocaleDateString('zh-TW')}
                              {d.endDate && <> ~ {new Date(d.endDate).toLocaleDateString('zh-TW')}</>}
                            </td>
                            <td className="py-3 px-2">
                              <Badge className={config?.color}>{config?.label}</Badge>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex flex-wrap gap-1">
                                {d.permissions.map((p) => (
                                  <Badge key={p.id} variant="outline" className="text-xs">
                                    {permissionLabels[p.permissionType] || p.permissionType}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">尚無代理設定</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 接受確認對話框 */}
      <AlertDialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>接受代理邀請</AlertDialogTitle>
            <AlertDialogDescription>
              確定要接受 {selectedDelegation?.name} 的代理邀請嗎？
              接受後您將可以代理執行指定的權限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAccept} disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? '處理中...' : '確定接受'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 拒絕對話框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒絕代理邀請</DialogTitle>
            <DialogDescription>
              您即將拒絕 {selectedDelegation?.name} 的代理邀請
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>拒絕原因（選填）</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="請說明拒絕原因..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? '處理中...' : '確定拒絕'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 取消對話框 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消代理</DialogTitle>
            <DialogDescription>
              您即將取消與 {selectedDelegation?.name} 的代理關係
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>取消原因 *（至少 10 個字）</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="請說明取消原因（至少 10 個字）..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {cancelReason.length}/10 字
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelMutation.isPending || cancelReason.length < 10}
            >
              {cancelMutation.isPending ? '處理中...' : '確定取消代理'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
