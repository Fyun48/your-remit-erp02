'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Workflow, Plus, Pencil, Eye, GitBranch, Users, Copy, Trash2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface WorkflowDef {
  id: string
  name: string
  description: string | null
  scopeType: 'EMPLOYEE' | 'REQUEST_TYPE' | 'DEFAULT'
  requestType: string | null
  isActive: boolean
  version: number
  company: { id: string; name: string } | null
  group: { id: string; name: string } | null
  employee: { id: string; name: string; employeeNo: string } | null
  createdBy: { id: string; name: string } | null
  _count: { nodes: number; instances: number }
  updatedAt: Date
}

interface WorkflowListProps {
  companyId: string
  companyName: string
  userId: string
  workflows: WorkflowDef[]
}

const scopeTypeLabels = {
  EMPLOYEE: '員工特殊路徑',
  REQUEST_TYPE: '申請類型流程',
  DEFAULT: '預設流程',
}

const scopeTypeBadgeColors = {
  EMPLOYEE: 'bg-purple-100 text-purple-700',
  REQUEST_TYPE: 'bg-blue-100 text-blue-700',
  DEFAULT: 'bg-gray-100 text-gray-700',
}

export function WorkflowList({ companyId, companyName, userId, workflows }: WorkflowListProps) {
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createData, setCreateData] = useState({
    name: '',
    description: '',
    scopeType: 'REQUEST_TYPE' as 'EMPLOYEE' | 'REQUEST_TYPE' | 'DEFAULT',
    requestType: '',
  })

  const createWorkflow = trpc.workflow.create.useMutation({
    onSuccess: (data) => {
      setIsCreateOpen(false)
      setCreateData({ name: '', description: '', scopeType: 'REQUEST_TYPE', requestType: '' })
      router.push(`/dashboard/workflow/editor/${data.id}`)
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const deleteWorkflow = trpc.workflow.delete.useMutation({
    onSuccess: () => {
      router.refresh()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const duplicateWorkflow = trpc.workflow.duplicate.useMutation({
    onSuccess: (data) => {
      router.push(`/dashboard/workflow/editor/${data.id}`)
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleCreate = () => {
    if (!createData.name.trim()) {
      alert('請輸入流程名稱')
      return
    }

    createWorkflow.mutate({
      name: createData.name,
      description: createData.description || undefined,
      scopeType: createData.scopeType,
      companyId: companyId,
      requestType: createData.scopeType === 'REQUEST_TYPE' ? createData.requestType : undefined,
      createdById: userId,
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`確定要刪除流程「${name}」嗎？`)) {
      deleteWorkflow.mutate({ id })
    }
  }

  const handleDuplicate = (id: string, name: string) => {
    const newName = prompt('請輸入複製流程的名稱', `${name} (副本)`)
    if (newName) {
      duplicateWorkflow.mutate({ id, newName, createdById: userId })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">流程管理</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增流程
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">尚無流程定義，點擊上方按鈕建立</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Badge className={scopeTypeBadgeColors[workflow.scopeType]}>
                      {scopeTypeLabels[workflow.scopeType]}
                    </Badge>
                    {workflow.isActive ? (
                      <Badge variant="default">啟用</Badge>
                    ) : (
                      <Badge variant="secondary">停用</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {workflow.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {workflow.description}
                  </p>
                )}
                {workflow.scopeType === 'EMPLOYEE' && workflow.employee && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">員工：</span>
                    {workflow.employee.name} ({workflow.employee.employeeNo})
                  </p>
                )}
                {workflow.scopeType === 'REQUEST_TYPE' && workflow.requestType && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">申請類型：</span>
                    {workflow.requestType}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-4 w-4" />
                    <span>{workflow._count.nodes} 節點</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{workflow._count.instances} 實例</span>
                  </div>
                  <span>v{workflow.version}</span>
                </div>
                <div className="flex gap-1 pt-2">
                  <Link href={`/dashboard/workflow/view/${workflow.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-4 w-4 mr-1" />
                      檢視
                    </Button>
                  </Link>
                  <Link href={`/dashboard/workflow/editor/${workflow.id}`} className="flex-1">
                    <Button size="sm" className="w-full">
                      <Pencil className="h-4 w-4 mr-1" />
                      編輯
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDuplicate(workflow.id, workflow.name)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(workflow.id, workflow.name)}
                    disabled={workflow._count.instances > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 新增流程 Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增流程</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>流程類型</Label>
              <Select
                value={createData.scopeType}
                onValueChange={(value) =>
                  setCreateData({ ...createData, scopeType: value as typeof createData.scopeType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REQUEST_TYPE">申請類型流程</SelectItem>
                  <SelectItem value="DEFAULT">預設流程</SelectItem>
                  <SelectItem value="EMPLOYEE">員工特殊路徑</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createData.scopeType === 'REQUEST_TYPE' && (
              <div className="space-y-2">
                <Label>申請類型</Label>
                <Select
                  value={createData.requestType}
                  onValueChange={(value) =>
                    setCreateData({ ...createData, requestType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇申請類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">費用報銷</SelectItem>
                    <SelectItem value="LEAVE">請假申請</SelectItem>
                    <SelectItem value="SEAL">用印申請</SelectItem>
                    <SelectItem value="BUSINESS_CARD">名片申請</SelectItem>
                    <SelectItem value="STATIONERY">文具領用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="workflow-name">名稱 *</Label>
              <Input
                id="workflow-name"
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                placeholder="例：費用報銷審批流程"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-desc">說明</Label>
              <Input
                id="workflow-desc"
                value={createData.description}
                onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                placeholder="選填"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createWorkflow.isPending}>
                {createWorkflow.isPending ? '建立中...' : '建立並編輯'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
