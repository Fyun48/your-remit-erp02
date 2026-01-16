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
import { Plus, Edit, Trash2, User, ArrowLeft, Workflow } from 'lucide-react'

interface EmployeePathsListProps {
  companyId: string
  groupId?: string
  currentUserId: string
}

export function EmployeePathsList({
  companyId,
  groupId,
  currentUserId,
}: EmployeePathsListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [workflowName, setWorkflowName] = useState('')
  const [workflowDescription, setWorkflowDescription] = useState('')

  // 取得員工特殊路徑列表
  const { data: employeePaths, isLoading, refetch } = trpc.workflow.list.useQuery({
    companyId,
    groupId,
    scopeType: 'EMPLOYEE',
    isActive: undefined,
  })

  // 取得公司員工列表（用於選擇）
  const { data: employees } = trpc.hr.listEmployees.useQuery({
    companyId,
    status: 'ACTIVE',
  })

  const createMutation = trpc.workflow.create.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false)
      setSelectedEmployeeId('')
      setWorkflowName('')
      setWorkflowDescription('')
      refetch()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const deleteMutation = trpc.workflow.delete.useMutation({
    onSuccess: () => {
      refetch()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleCreate = () => {
    if (!selectedEmployeeId || !workflowName.trim()) {
      alert('請選擇員工並填寫流程名稱')
      return
    }

    createMutation.mutate({
      name: workflowName,
      description: workflowDescription || undefined,
      scopeType: 'EMPLOYEE',
      companyId,
      groupId,
      employeeId: selectedEmployeeId,
      createdById: currentUserId,
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`確定要刪除「${name}」嗎？此操作無法復原。`)) {
      deleteMutation.mutate({ id })
    }
  }

  const selectedEmployee = employees?.find(e => e.employee.id === selectedEmployeeId)

  return (
    <>
      <div className="flex items-center justify-between">
        <Link href="/dashboard/workflow">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回流程列表
          </Button>
        </Link>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增員工特殊路徑
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            員工特殊路徑列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : !employeePaths || employeePaths.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">尚未設定任何員工特殊路徑</p>
              <p className="text-sm text-muted-foreground mt-1">
                員工特殊路徑可讓特定員工使用專屬的簽核流程
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {employeePaths.map((path) => (
                <div
                  key={path.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <User className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{path.name}</span>
                        <Badge variant={path.isActive ? 'default' : 'secondary'}>
                          {path.isActive ? '啟用中' : '已停用'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        員工：{path.employee?.name || '未知'} ({path.employee?.employeeNo})
                      </div>
                      {path.description && (
                        <div className="text-sm text-muted-foreground">
                          {path.description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {path._count.nodes} 個節點 · {path._count.instances} 次使用
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/workflow/editor/${path.id}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-1" />
                        編輯流程
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(path.id, path.name)}
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

      {/* 新增對話框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              新增員工特殊路徑
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>選擇員工 *</Label>
              <select
                className="w-full border rounded-md p-2"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                <option value="">請選擇員工</option>
                {employees?.map((emp) => (
                  <option key={emp.employee.id} value={emp.employee.id}>
                    {emp.employee.name} ({emp.employee.employeeNo})
                  </option>
                ))}
              </select>
              {selectedEmployee && (
                <p className="text-xs text-muted-foreground">
                  此員工的所有申請將優先使用這個特殊流程
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">流程名稱 *</Label>
              <Input
                id="name"
                placeholder="例：張三專屬簽核流程"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">說明</Label>
              <Input
                id="description"
                placeholder="選填"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? '建立中...' : '建立並編輯流程'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
