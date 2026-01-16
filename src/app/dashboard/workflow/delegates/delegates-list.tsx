'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trpc } from '@/lib/trpc'
import { Plus, Edit, Trash2, UserCheck, ArrowLeft, Calendar, Building2 } from 'lucide-react'

interface DelegatesListProps {
  companyId: string
  companyName: string
  currentUserId: string
}

const REQUEST_TYPE_OPTIONS = [
  { value: 'LEAVE', label: '請假' },
  { value: 'EXPENSE', label: '報銷' },
  { value: 'SEAL', label: '用印' },
  { value: 'BUSINESS_CARD', label: '名片' },
  { value: 'STATIONERY', label: '文具' },
]

export function DelegatesList({
  companyId,
  companyName,
  currentUserId,
}: DelegatesListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [delegateId, setDelegateId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedRequestTypes, setSelectedRequestTypes] = useState<string[]>([])

  // 取得職務代理列表
  const { data, isLoading, refetch } = trpc.workflow.listDelegates.useQuery({
    employeeId: currentUserId,
  })

  // 取得員工列表（用於選擇代理人）
  const { data: employeesData } = trpc.hr.listEmployees.useQuery({
    companyId,
  })

  const createMutation = trpc.workflow.createDelegate.useMutation({
    onSuccess: () => {
      resetForm()
      refetch()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const updateMutation = trpc.workflow.updateDelegate.useMutation({
    onSuccess: () => {
      resetForm()
      refetch()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const deleteMutation = trpc.workflow.deleteDelegate.useMutation({
    onSuccess: () => {
      refetch()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const resetForm = () => {
    setIsDialogOpen(false)
    setEditingId(null)
    setDelegateId('')
    setStartDate('')
    setEndDate('')
    setSelectedRequestTypes([])
  }

  const handleCreate = () => {
    if (!delegateId || !startDate || !endDate) {
      alert('請填寫必要欄位')
      return
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        requestTypes: selectedRequestTypes,
        companyIds: [companyId],
      })
    } else {
      createMutation.mutate({
        principalId: currentUserId,
        delegateId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        requestTypes: selectedRequestTypes,
        companyIds: [companyId],
      })
    }
  }

  const handleEdit = (delegate: NonNullable<typeof data>['myDelegates'][0]) => {
    setEditingId(delegate.id)
    setDelegateId(delegate.delegateId)
    setStartDate(new Date(delegate.startDate).toISOString().split('T')[0])
    setEndDate(new Date(delegate.endDate).toISOString().split('T')[0])
    setSelectedRequestTypes(delegate.requestTypes)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string, delegateName: string) => {
    if (confirm(`確定要刪除代理人「${delegateName}」的設定嗎？`)) {
      deleteMutation.mutate({ id })
    }
  }

  const handleToggleActive = (id: string, currentActive: boolean) => {
    updateMutation.mutate({ id, isActive: !currentActive })
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-TW')
  }

  const isActive = (delegate: { startDate: Date; endDate: Date; isActive: boolean }) => {
    const now = new Date()
    const start = new Date(delegate.startDate)
    const end = new Date(delegate.endDate)
    return delegate.isActive && now >= start && now <= end
  }

  const toggleRequestType = (type: string) => {
    setSelectedRequestTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  // 從 assignments 取得員工列表，排除當前用戶
  const availableEmployees = employeesData
    ?.filter((a) => a.employee.id !== currentUserId)
    .map((a) => ({
      id: a.employee.id,
      name: a.employee.name,
      employeeNo: a.employee.employeeNo,
    })) || []

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/workflow">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回流程列表
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">職務代理</h1>
              <p className="text-sm text-muted-foreground">{companyName}</p>
            </div>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新增代理設定
          </Button>
        </div>

        {/* 我設定的代理人 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              我的代理人
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">載入中...</div>
            ) : !data?.myDelegates || data.myDelegates.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">尚未設定任何代理人</p>
                <p className="text-sm text-muted-foreground mt-1">
                  設定代理人後，在您無法處理簽核時，代理人可以代為簽核
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.myDelegates.map((delegate) => (
                  <div
                    key={delegate.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${isActive(delegate) ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <UserCheck className={`h-5 w-5 ${isActive(delegate) ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{delegate.delegate.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ({delegate.delegate.employeeNo})
                          </span>
                          <Badge variant={isActive(delegate) ? 'default' : 'secondary'}>
                            {isActive(delegate) ? '生效中' : delegate.isActive ? '未生效' : '已停用'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(delegate.startDate)} ~ {formatDate(delegate.endDate)}
                          </span>
                          {delegate.requestTypes.length > 0 && (
                            <span>
                              代理範圍：{delegate.requestTypes
                                .map((t) => REQUEST_TYPE_OPTIONS.find((o) => o.value === t)?.label || t)
                                .join('、')}
                            </span>
                          )}
                          {delegate.requestTypes.length === 0 && (
                            <span>代理範圍：全部</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(delegate.id, delegate.isActive)}
                      >
                        {delegate.isActive ? '停用' : '啟用'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(delegate)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(delegate.id, delegate.delegate.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 代理我的人 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              正在代理我的人
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.delegatedToMe || data.delegatedToMe.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">目前沒有人代理您的簽核</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.delegatedToMe.map((delegate) => (
                  <div
                    key={delegate.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${isActive(delegate) ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <UserCheck className={`h-5 w-5 ${isActive(delegate) ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{delegate.principal.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ({delegate.principal.employeeNo})
                          </span>
                          <Badge variant={isActive(delegate) ? 'default' : 'secondary'}>
                            {isActive(delegate) ? '生效中' : '未生效'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(delegate.startDate)} ~ {formatDate(delegate.endDate)}
                          </span>
                          {delegate.requestTypes.length > 0 ? (
                            <span>
                              代理範圍：{delegate.requestTypes
                                .map((t) => REQUEST_TYPE_OPTIONS.find((o) => o.value === t)?.label || t)
                                .join('、')}
                            </span>
                          ) : (
                            <span>代理範圍：全部</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">由對方設定</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 新增/編輯對話框 */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              {editingId ? '編輯代理設定' : '新增代理設定'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>選擇代理人 *</Label>
              <select
                className="w-full border rounded-md p-2"
                value={delegateId}
                onChange={(e) => setDelegateId(e.target.value)}
                disabled={!!editingId}
              >
                <option value="">請選擇代理人</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">開始日期 *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">結束日期 *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>代理範圍（不選擇表示全部）</Label>
              <div className="flex flex-wrap gap-2">
                {REQUEST_TYPE_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={selectedRequestTypes.includes(option.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleRequestType(option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                點選要代理的申請類型，不選擇則代理所有類型
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? '處理中...' : editingId ? '更新' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
