'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { trpc } from '@/lib/trpc'
import { GitBranch, Plus, Pencil, Trash2 } from 'lucide-react'

interface ApprovalStep {
  id: string
  stepOrder: number
  name: string
  approverType: string
  approverValue: string | null
  approvalMode: string
  canSkip: boolean
  skipCondition: string | null
}

interface ApprovalFlow {
  id: string
  companyId: string | null
  code: string
  name: string
  description: string | null
  module: string
  conditions: string | null
  isDefault: boolean
  isActive: boolean
  sortOrder: number
  steps: ApprovalStep[]
  company: { id: string; name: string } | null
}

interface ApprovalFlowsListProps {
  flows: ApprovalFlow[]
  companies: { id: string; name: string }[]
}

const moduleNames: Record<string, string> = {
  leave: '請假',
  expense: '費用報銷',
  overtime: '加班',
}

const approverTypeNames: Record<string, string> = {
  SUPERVISOR: '直屬主管',
  DEPARTMENT_HEAD: '部門主管',
  POSITION_LEVEL: '指定職級',
  SPECIFIC_POSITION: '指定職位',
  SPECIFIC_EMPLOYEE: '指定員工',
  ROLE: '指定角色',
}

interface NewStep {
  stepOrder: number
  name: string
  approverType: 'SUPERVISOR' | 'DEPARTMENT_HEAD' | 'POSITION_LEVEL' | 'SPECIFIC_POSITION' | 'SPECIFIC_EMPLOYEE' | 'ROLE'
  approverValue?: string
  approvalMode: 'ANY' | 'ALL' | 'MAJORITY'
  canSkip: boolean
  skipCondition?: string
  ccType?: 'SUPERVISOR' | 'DEPARTMENT_HEAD' | 'POSITION_LEVEL' | 'SPECIFIC_POSITION' | 'SPECIFIC_EMPLOYEE' | 'ROLE'
  ccValue?: string
  timeoutHours: number
  timeoutAction: 'NONE' | 'REMIND' | 'ESCALATE' | 'AUTO_APPROVE' | 'AUTO_REJECT'
}

interface FormData {
  companyId?: string
  code: string
  name: string
  description: string
  module: string
  conditions: string
  isDefault: boolean
  steps: NewStep[]
}

const initialFormData: FormData = {
  companyId: undefined,
  code: '',
  name: '',
  description: '',
  module: 'leave',
  conditions: '',
  isDefault: false,
  steps: [
    {
      stepOrder: 1,
      name: '主管審核',
      approverType: 'SUPERVISOR',
      approvalMode: 'ANY',
      canSkip: false,
      timeoutHours: 0,
      timeoutAction: 'NONE',
    },
  ],
}

export function ApprovalFlowsList({ flows, companies }: ApprovalFlowsListProps) {
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedFlow, setSelectedFlow] = useState<ApprovalFlow | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createMutation = trpc.approvalFlow.create.useMutation()
  const updateMutation = trpc.approvalFlow.update.useMutation()
  const deleteMutation = trpc.approvalFlow.delete.useMutation()

  const handleOpenCreate = () => {
    setFormData(initialFormData)
    setError(null)
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (flow: ApprovalFlow) => {
    setSelectedFlow(flow)
    setFormData({
      companyId: flow.companyId || undefined,
      code: flow.code,
      name: flow.name,
      description: flow.description || '',
      module: flow.module,
      conditions: flow.conditions || '',
      isDefault: flow.isDefault,
      steps: flow.steps.map(s => ({
        stepOrder: s.stepOrder,
        name: s.name,
        approverType: s.approverType as NewStep['approverType'],
        approverValue: s.approverValue || undefined,
        approvalMode: s.approvalMode as NewStep['approvalMode'],
        canSkip: s.canSkip,
        skipCondition: s.skipCondition || undefined,
        timeoutHours: 0,
        timeoutAction: 'NONE' as const,
      })),
    })
    setError(null)
    setIsEditOpen(true)
  }

  const handleOpenDelete = (flow: ApprovalFlow) => {
    setSelectedFlow(flow)
    setIsDeleteOpen(true)
  }

  const handleAddStep = () => {
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        {
          stepOrder: formData.steps.length + 1,
          name: `第 ${formData.steps.length + 1} 關`,
          approverType: 'SUPERVISOR',
          approvalMode: 'ANY',
          canSkip: false,
          timeoutHours: 0,
          timeoutAction: 'NONE',
        },
      ],
    })
  }

  const handleRemoveStep = (index: number) => {
    if (formData.steps.length <= 1) return
    const newSteps = formData.steps.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      stepOrder: i + 1,
    }))
    setFormData({ ...formData, steps: newSteps })
  }

  const handleStepChange = (index: number, field: keyof NewStep, value: string | boolean | number) => {
    const newSteps = [...formData.steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setFormData({ ...formData, steps: newSteps })
  }

  const handleCreate = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      setError('請填寫代碼和名稱')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await createMutation.mutateAsync({
        companyId: formData.companyId,
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        module: formData.module,
        conditions: formData.conditions || undefined,
        isDefault: formData.isDefault,
        steps: formData.steps,
      })
      setIsCreateOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Create flow error:', err)
      setError(err instanceof Error ? err.message : '建立失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedFlow) return

    setIsLoading(true)
    setError(null)

    try {
      await updateMutation.mutateAsync({
        id: selectedFlow.id,
        name: formData.name,
        description: formData.description || undefined,
        conditions: formData.conditions || undefined,
        isDefault: formData.isDefault,
      })
      setIsEditOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Update flow error:', err)
      setError(err instanceof Error ? err.message : '更新失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedFlow) return

    setIsLoading(true)

    try {
      await deleteMutation.mutateAsync({ id: selectedFlow.id })
      setIsDeleteOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Delete flow error:', err)
      alert(err instanceof Error ? err.message : '刪除失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">審核流程設定</h1>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增流程
        </Button>
      </div>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">尚未設定任何審核流程</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    {flow.name}
                    {flow.isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                        預設
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-normal text-muted-foreground mr-2">
                      {moduleNames[flow.module] || flow.module}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(flow)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleOpenDelete(flow)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  {flow.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div className="px-3 py-1.5 bg-muted rounded-lg text-sm">
                        <span className="font-medium">{step.name}</span>
                        <span className="text-muted-foreground ml-1">
                          ({approverTypeNames[step.approverType] || step.approverType})
                        </span>
                      </div>
                      {index < flow.steps.length - 1 && (
                        <span className="mx-2 text-muted-foreground">-&gt;</span>
                      )}
                    </div>
                  ))}
                </div>
                {flow.conditions && (
                  <p className="text-sm text-muted-foreground mt-2">
                    條件：{flow.conditions}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增審核流程</DialogTitle>
            <DialogDescription>
              設定新的審核流程，包含流程名稱、適用模組及審核關卡。
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">流程代碼 *</Label>
                <Input
                  id="code"
                  placeholder="例：LEAVE_DEFAULT"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">流程名稱 *</Label>
                <Input
                  id="name"
                  placeholder="例：請假審核流程"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="module">適用模組 *</Label>
                <select
                  id="module"
                  className="w-full border rounded-md p-2"
                  value={formData.module}
                  onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                >
                  <option value="leave">請假</option>
                  <option value="expense">費用報銷</option>
                  <option value="overtime">加班</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">適用公司</Label>
                <select
                  id="company"
                  className="w-full border rounded-md p-2"
                  value={formData.companyId || ''}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value || undefined })}
                >
                  <option value="">全部公司</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">說明</Label>
              <Input
                id="description"
                placeholder="選填"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditions">條件 (JSON)</Label>
              <Input
                id="conditions"
                placeholder='例：{"minDays": 3} 或 {"minAmount": 10000}'
                value={formData.conditions}
                onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                請假可用條件：minDays, maxDays, leaveTypes；費用報銷可用條件：minAmount, maxAmount
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isDefault">設為預設流程</Label>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>審核關卡</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddStep}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增關卡
                </Button>
              </div>

              <div className="space-y-3">
                {formData.steps.map((step, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">第 {index + 1} 關</span>
                      {formData.steps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleRemoveStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">關卡名稱</Label>
                        <Input
                          value={step.name}
                          onChange={(e) => handleStepChange(index, 'name', e.target.value)}
                          placeholder="例：主管審核"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">審核者類型</Label>
                        <select
                          className="w-full border rounded-md p-2 text-sm"
                          value={step.approverType}
                          onChange={(e) => handleStepChange(index, 'approverType', e.target.value)}
                        >
                          <option value="SUPERVISOR">直屬主管</option>
                          <option value="DEPARTMENT_HEAD">部門主管</option>
                          <option value="POSITION_LEVEL">指定職級</option>
                          <option value="SPECIFIC_POSITION">指定職位</option>
                          <option value="SPECIFIC_EMPLOYEE">指定員工</option>
                          <option value="ROLE">指定角色</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isLoading}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? '建立中...' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>編輯審核流程</DialogTitle>
            <DialogDescription>
              修改流程的基本資訊。如需修改審核關卡，請刪除後重建。
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">流程名稱 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">說明</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-conditions">條件 (JSON)</Label>
              <Input
                id="edit-conditions"
                value={formData.conditions}
                onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-isDefault">設為預設流程</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isLoading}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={isLoading}>
              {isLoading ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此流程嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedFlow && (
                <>
                  您即將刪除「{selectedFlow.name}」流程。此操作無法復原。
                  <br />
                  <span className="text-red-500">
                    注意：如果有正在使用此流程的審核申請，將無法刪除。
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {isLoading ? '刪除中...' : '確定刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
