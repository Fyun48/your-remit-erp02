'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Users,
  Briefcase,
  User,
  ArrowDown,
  CheckCircle,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import type { FlowModuleType, FlowAssigneeType } from '@prisma/client'

interface Position {
  id: string
  name: string
  level: number
}

interface Employee {
  id: string
  name: string
  employeeNo: string
  department: string
  position: string
}

interface FlowStep {
  id: string
  stepOrder: number
  name: string
  assigneeType: FlowAssigneeType
  positionId: string | null
  specificEmployeeId: string | null
  isRequired: boolean
}

interface ExistingTemplate {
  id: string
  moduleType: FlowModuleType
  name: string
  description: string | null
  steps: FlowStep[]
}

interface FlowTemplateFormProps {
  companyId: string
  companyName: string
  userId: string
  positions: Position[]
  employees: Employee[]
  defaultModuleType?: string
  existingTemplate?: ExistingTemplate
}

const moduleTypeOptions: { value: FlowModuleType; label: string }[] = [
  { value: 'LEAVE', label: '請假申請' },
  { value: 'EXPENSE', label: '費用核銷' },
  { value: 'SEAL', label: '用印申請' },
  { value: 'CARD', label: '名片申請' },
  { value: 'STATIONERY', label: '文具申請' },
  { value: 'OVERTIME', label: '加班申請' },
  { value: 'BUSINESS_TRIP', label: '出差申請' },
]

const assigneeTypeOptions: { value: FlowAssigneeType; label: string; icon: typeof Users }[] = [
  { value: 'DIRECT_SUPERVISOR', label: '直屬主管', icon: Users },
  { value: 'POSITION', label: '指定職位', icon: Briefcase },
  { value: 'SPECIFIC_PERSON', label: '指定人員', icon: User },
]

const MAX_STEPS = 4

export function FlowTemplateForm({
  companyId,
  companyName,
  userId,
  positions,
  employees,
  defaultModuleType,
  existingTemplate,
}: FlowTemplateFormProps) {
  const router = useRouter()
  const isEditing = !!existingTemplate

  const [moduleType, setModuleType] = useState<FlowModuleType>(
    (existingTemplate?.moduleType || defaultModuleType || 'LEAVE') as FlowModuleType
  )
  const [name, setName] = useState(existingTemplate?.name || '')
  const [description, setDescription] = useState(existingTemplate?.description || '')
  const [steps, setSteps] = useState<FlowStep[]>(
    existingTemplate?.steps || [
      {
        id: crypto.randomUUID(),
        stepOrder: 1,
        name: '直屬主管審核',
        assigneeType: 'DIRECT_SUPERVISOR',
        positionId: null,
        specificEmployeeId: null,
        isRequired: true,
      },
    ]
  )

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const upsertMutation = trpc.flowTemplate.upsert.useMutation({
    onSuccess: () => {
      router.push('/dashboard/workflow/templates')
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const addStep = () => {
    if (steps.length >= MAX_STEPS) {
      alert(`最多只能設定 ${MAX_STEPS} 層審核`)
      return
    }

    setSteps([
      ...steps,
      {
        id: crypto.randomUUID(),
        stepOrder: steps.length + 1,
        name: '',
        assigneeType: 'DIRECT_SUPERVISOR',
        positionId: null,
        specificEmployeeId: null,
        isRequired: true,
      },
    ])
  }

  const removeStep = (index: number) => {
    if (steps.length <= 1) {
      alert('至少需要一個審核關卡')
      return
    }

    const newSteps = steps.filter((_, i) => i !== index)
    // Reorder steps
    setSteps(newSteps.map((step, i) => ({ ...step, stepOrder: i + 1 })))
  }

  const updateStep = (index: number, updates: Partial<FlowStep>) => {
    setSteps(steps.map((step, i) => (i === index ? { ...step, ...updates } : step)))
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newSteps = [...steps]
    const draggedStep = newSteps[draggedIndex]
    newSteps.splice(draggedIndex, 1)
    newSteps.splice(index, 0, draggedStep)

    // Update step orders
    setSteps(newSteps.map((step, i) => ({ ...step, stepOrder: i + 1 })))
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleSubmit = () => {
    if (!moduleType) {
      alert('請選擇申請類型')
      return
    }

    if (!name.trim()) {
      alert('請輸入流程名稱')
      return
    }

    if (steps.length === 0) {
      alert('至少需要一個審核關卡')
      return
    }

    // Validate steps
    for (const step of steps) {
      if (!step.name.trim()) {
        alert(`第 ${step.stepOrder} 關卡需要名稱`)
        return
      }
      if (step.assigneeType === 'POSITION' && !step.positionId) {
        alert(`第 ${step.stepOrder} 關卡需要選擇職位`)
        return
      }
      if (step.assigneeType === 'SPECIFIC_PERSON' && !step.specificEmployeeId) {
        alert(`第 ${step.stepOrder} 關卡需要選擇指定人員`)
        return
      }
    }

    upsertMutation.mutate({
      companyId,
      moduleType,
      name,
      description: description || undefined,
      createdById: userId,
      steps: steps.map((step) => ({
        stepOrder: step.stepOrder,
        name: step.name,
        assigneeType: step.assigneeType,
        positionId: step.positionId,
        specificEmployeeId: step.specificEmployeeId,
        isRequired: step.isRequired,
      })),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/workflow/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? '編輯審核流程' : '新增審核流程'}
          </h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左側：基本設定 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>申請類型 *</Label>
                <Select
                  value={moduleType}
                  onValueChange={(v) => setModuleType(v as FlowModuleType)}
                  disabled={isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇申請類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEditing && (
                  <p className="text-xs text-muted-foreground">
                    編輯時無法變更申請類型
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>流程名稱 *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例：一般請假審核流程"
                />
              </div>

              <div className="space-y-2">
                <Label>說明</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="選填，描述此流程的用途"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 審核關卡設定 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>審核關卡（{steps.length}/{MAX_STEPS}）</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={addStep}
                disabled={steps.length >= MAX_STEPS}
              >
                <Plus className="h-4 w-4 mr-1" />
                新增關卡
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step, index) => {
                const AssigneeIcon =
                  assigneeTypeOptions.find((o) => o.value === step.assigneeType)?.icon || Users

                return (
                  <div
                    key={step.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`p-4 border rounded-lg space-y-3 transition-colors ${
                      draggedIndex === index ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="cursor-grab hover:text-primary"
                          title="拖曳排序"
                        >
                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                          {step.stepOrder}
                        </span>
                        <AssigneeIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeStep(index)}
                        disabled={steps.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">關卡名稱 *</Label>
                        <Input
                          value={step.name}
                          onChange={(e) => updateStep(index, { name: e.target.value })}
                          placeholder="例：部門主管審核"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">審核人類型 *</Label>
                        <Select
                          value={step.assigneeType}
                          onValueChange={(v) =>
                            updateStep(index, {
                              assigneeType: v as FlowAssigneeType,
                              positionId: null,
                              specificEmployeeId: null,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {assigneeTypeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {step.assigneeType === 'POSITION' && (
                      <div className="space-y-2">
                        <Label className="text-xs">選擇職位 *</Label>
                        <Select
                          value={step.positionId || ''}
                          onValueChange={(v) => updateStep(index, { positionId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="選擇職位" />
                          </SelectTrigger>
                          <SelectContent>
                            {positions.map((pos) => (
                              <SelectItem key={pos.id} value={pos.id}>
                                {pos.name} (Level {pos.level})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {step.assigneeType === 'SPECIFIC_PERSON' && (
                      <div className="space-y-2">
                        <Label className="text-xs">選擇人員 *</Label>
                        <Select
                          value={step.specificEmployeeId || ''}
                          onValueChange={(v) => updateStep(index, { specificEmployeeId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="選擇人員" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.name} ({emp.employeeNo}) - {emp.department}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`required-${step.id}`}
                          checked={step.isRequired}
                          onCheckedChange={(v) => updateStep(index, { isRequired: v })}
                        />
                        <Label htmlFor={`required-${step.id}`} className="text-xs">
                          必要關卡
                        </Label>
                      </div>
                      {!step.isRequired && (
                        <span className="text-xs text-muted-foreground">
                          可跳過此關卡
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* 右側：流程預覽 */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>流程預覽</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 申請人 */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">申請人</p>
                    <p className="text-sm text-muted-foreground">提交申請</p>
                  </div>
                </div>

                {steps.map((step) => {
                  const AssigneeIcon =
                    assigneeTypeOptions.find((o) => o.value === step.assigneeType)?.icon || Users
                  const assigneeLabel =
                    assigneeTypeOptions.find((o) => o.value === step.assigneeType)?.label || ''

                  let assigneeDetail = ''
                  if (step.assigneeType === 'POSITION' && step.positionId) {
                    const pos = positions.find((p) => p.id === step.positionId)
                    assigneeDetail = pos ? pos.name : ''
                  } else if (step.assigneeType === 'SPECIFIC_PERSON' && step.specificEmployeeId) {
                    const emp = employees.find((e) => e.id === step.specificEmployeeId)
                    assigneeDetail = emp ? emp.name : ''
                  }

                  return (
                    <div key={step.id}>
                      <div className="flex justify-center py-1">
                        <ArrowDown className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 text-orange-700">
                          <span className="text-sm font-medium">{step.stepOrder}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {step.name || `第 ${step.stepOrder} 關`}
                            {!step.isRequired && (
                              <span className="ml-2 text-xs text-muted-foreground">(可跳過)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <AssigneeIcon className="h-3 w-3" />
                            {assigneeLabel}
                            {assigneeDetail && ` - ${assigneeDetail}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* 完成 */}
                <div className="flex justify-center py-1">
                  <ArrowDown className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">審核完成</p>
                    <p className="text-sm text-muted-foreground">申請通過</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 提交按鈕 */}
      <div className="flex justify-end gap-4">
        <Link href="/dashboard/workflow/templates">
          <Button variant="outline">取消</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
          {upsertMutation.isPending ? '儲存中...' : isEditing ? '更新流程' : '建立流程'}
        </Button>
      </div>
    </div>
  )
}
