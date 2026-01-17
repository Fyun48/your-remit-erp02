'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { trpc } from '@/lib/trpc'
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  ArrowUpDown,
  Filter,
  Check,
  User,
} from 'lucide-react'

// ==================== Type Definitions ====================

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
  createdAt: Date
  steps: ApprovalStep[]
  company: { id: string; name: string; code: string } | null
}

interface Company {
  id: string
  name: string
  code: string
}

interface Group {
  id: string
  name: string
}

interface LeaveType {
  id: string
  code: string
  name: string
}

interface ApprovalFlowsListProps {
  flows: ApprovalFlow[]
  companies: Company[]
  groups: Group[]
  leaveTypes: LeaveType[]
}

// ==================== Constants ====================

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

const approvalModeNames: Record<string, string> = {
  ANY: '任一人',
  ALL: '全部',
  MAJORITY: '多數決',
}

const leaveTypeNames: Record<string, string> = {
  ANNUAL: '特休',
  SICK: '病假',
  PERSONAL: '事假',
  MARRIAGE: '婚假',
  MATERNITY: '產假',
  PATERNITY: '陪產假',
  FUNERAL: '喪假',
  MENSTRUAL: '生理假',
  OFFICIAL: '公假',
  WORK_INJURY: '工傷假',
  COMP: '補休',
}

// ==================== Helper Functions ====================

function generateFlowCode(module: string, companyCode: string | null): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const moduleUpper = module.toUpperCase()
  if (companyCode) {
    return `${moduleUpper}_${companyCode}_${timestamp}`
  }
  return `${moduleUpper}_GROUP_${timestamp}`
}

interface Conditions {
  minAmount?: number
  maxAmount?: number
  minDays?: number
  maxDays?: number
  leaveTypes?: string[]
}

function formatConditions(conditions: string | null, module: string): string {
  if (!conditions) return '-'

  try {
    const parsed = JSON.parse(conditions) as Conditions
    const parts: string[] = []

    if (module === 'expense') {
      if (parsed.minAmount !== undefined && parsed.maxAmount !== undefined) {
        parts.push(`$${parsed.minAmount.toLocaleString()} ~ $${parsed.maxAmount.toLocaleString()}`)
      } else if (parsed.minAmount !== undefined) {
        parts.push(`>= $${parsed.minAmount.toLocaleString()}`)
      } else if (parsed.maxAmount !== undefined) {
        parts.push(`<= $${parsed.maxAmount.toLocaleString()}`)
      }
    } else if (module === 'leave' || module === 'overtime') {
      if (parsed.minDays !== undefined && parsed.maxDays !== undefined) {
        parts.push(`${parsed.minDays} ~ ${parsed.maxDays} 天`)
      } else if (parsed.minDays !== undefined) {
        parts.push(`>= ${parsed.minDays} 天`)
      } else if (parsed.maxDays !== undefined) {
        parts.push(`<= ${parsed.maxDays} 天`)
      }

      if (parsed.leaveTypes && parsed.leaveTypes.length > 0) {
        const typeNames = parsed.leaveTypes.map(t => leaveTypeNames[t] || t).join('、')
        parts.push(typeNames)
      }
    }

    return parts.length > 0 ? parts.join('; ') : '-'
  } catch {
    return conditions
  }
}

function parseConditions(conditions: string | null): Conditions {
  if (!conditions) return {}
  try {
    return JSON.parse(conditions) as Conditions
  } catch {
    return {}
  }
}

function conditionsToJson(conditions: Conditions): string | undefined {
  const filtered = Object.fromEntries(
    Object.entries(conditions).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
  )
  if (Object.keys(filtered).length === 0) return undefined
  return JSON.stringify(filtered)
}

// ==================== Sub-Components ====================

interface ConditionsEditorProps {
  module: string
  value: Conditions
  onChange: (conditions: Conditions) => void
  leaveTypes: LeaveType[]
}

function ConditionsEditor({ module, value, onChange, leaveTypes }: ConditionsEditorProps) {
  if (module === 'expense') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minAmount">最小金額</Label>
            <Input
              id="minAmount"
              type="number"
              placeholder="例：10000"
              value={value.minAmount ?? ''}
              onChange={(e) => onChange({
                ...value,
                minAmount: e.target.value ? Number(e.target.value) : undefined,
              })}
            />
            <p className="text-xs text-muted-foreground">報銷金額須大於等於此值</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxAmount">最大金額</Label>
            <Input
              id="maxAmount"
              type="number"
              placeholder="例：50000"
              value={value.maxAmount ?? ''}
              onChange={(e) => onChange({
                ...value,
                maxAmount: e.target.value ? Number(e.target.value) : undefined,
              })}
            />
            <p className="text-xs text-muted-foreground">報銷金額須小於等於此值</p>
          </div>
        </div>
      </div>
    )
  }

  if (module === 'leave' || module === 'overtime') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minDays">最少天數</Label>
            <Input
              id="minDays"
              type="number"
              placeholder="例：3"
              value={value.minDays ?? ''}
              onChange={(e) => onChange({
                ...value,
                minDays: e.target.value ? Number(e.target.value) : undefined,
              })}
            />
            <p className="text-xs text-muted-foreground">請假天數須大於等於此值</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxDays">最多天數</Label>
            <Input
              id="maxDays"
              type="number"
              placeholder="例：7"
              value={value.maxDays ?? ''}
              onChange={(e) => onChange({
                ...value,
                maxDays: e.target.value ? Number(e.target.value) : undefined,
              })}
            />
            <p className="text-xs text-muted-foreground">請假天數須小於等於此值</p>
          </div>
        </div>

        {module === 'leave' && (
          <div className="space-y-2">
            <Label>適用假別</Label>
            <div className="grid grid-cols-3 gap-2 p-3 border rounded-md">
              {leaveTypes.map((lt) => (
                <div key={lt.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`lt-${lt.code}`}
                    checked={value.leaveTypes?.includes(lt.code) ?? false}
                    onCheckedChange={(checked) => {
                      const current = value.leaveTypes || []
                      const updated = checked
                        ? [...current, lt.code]
                        : current.filter((c) => c !== lt.code)
                      onChange({ ...value, leaveTypes: updated.length > 0 ? updated : undefined })
                    }}
                  />
                  <label
                    htmlFor={`lt-${lt.code}`}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {lt.name}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">不選擇則適用所有假別</p>
          </div>
        )}
      </div>
    )
  }

  return null
}

interface EmployeeSelectorProps {
  companyId: string | undefined
  value: string
  onChange: (value: string, displayName: string) => void
}

function EmployeeSelector({ companyId, value, onChange }: EmployeeSelectorProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedName, setSelectedName] = useState('')

  const { data: employees, isLoading } = trpc.approvalFlow.searchEmployees.useQuery(
    { companyId, search, limit: 20 },
    { enabled: open }
  )

  // 如果已經有值，嘗試獲取名稱
  useEffect(() => {
    if (value && !selectedName) {
      // 嘗試從搜尋結果找到名稱
      const found = employees?.find(e => e.employeeId === value)
      if (found) {
        setSelectedName(`${found.name} (${found.employeeNo})`)
      }
    }
  }, [value, employees, selectedName])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedName || value || '選擇員工...'}
          <User className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋員工姓名或編號..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">載入中...</div>
          ) : employees && employees.length > 0 ? (
            employees.map((emp) => (
              <div
                key={emp.employeeId}
                className="flex items-center px-2 py-2 cursor-pointer hover:bg-accent"
                onClick={() => {
                  const displayName = `${emp.name} (${emp.employeeNo})`
                  onChange(emp.employeeId, displayName)
                  setSelectedName(displayName)
                  setOpen(false)
                }}
              >
                <div className="flex-1">
                  <div className="font-medium">{emp.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {emp.employeeNo} - {emp.department} / {emp.position}
                  </div>
                </div>
                {value === emp.employeeId && <Check className="h-4 w-4" />}
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">找不到員工</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ==================== Form Types ====================

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
  name: string
  description: string
  module: string
  conditions: Conditions
  isDefault: boolean
  steps: NewStep[]
}

const initialFormData: FormData = {
  companyId: undefined,
  name: '',
  description: '',
  module: 'leave',
  conditions: {},
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

// ==================== Main Component ====================

type SortField = 'name' | 'module' | 'createdAt'
type SortOrder = 'asc' | 'desc'

export function ApprovalFlowsList({ flows, companies, groups, leaveTypes }: ApprovalFlowsListProps) {
  const router = useRouter()

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingFlow, setEditingFlow] = useState<ApprovalFlow | null>(null)
  const [selectedFlow, setSelectedFlow] = useState<ApprovalFlow | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter and sort states
  const [filterModule, setFilterModule] = useState<string>('')
  const [filterCompany, setFilterCompany] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Mutations
  const createMutation = trpc.approvalFlow.create.useMutation()
  const updateMutation = trpc.approvalFlow.update.useMutation()
  const deleteMutation = trpc.approvalFlow.delete.useMutation()

  // Get group name
  const groupName = groups[0]?.name || '集團'

  // Filter and sort flows
  const filteredFlows = useMemo(() => {
    let result = [...flows]

    // Apply filters
    if (filterModule) {
      result = result.filter((f) => f.module === filterModule)
    }
    if (filterCompany) {
      if (filterCompany === 'GROUP') {
        result = result.filter((f) => f.companyId === null)
      } else {
        result = result.filter((f) => f.companyId === filterCompany)
      }
    }
    if (filterStatus) {
      const isActive = filterStatus === 'active'
      result = result.filter((f) => f.isActive === isActive)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(term) ||
          f.code.toLowerCase().includes(term) ||
          (f.description?.toLowerCase().includes(term) ?? false)
      )
    }

    // Apply sort
    result.sort((a, b) => {
      let compare = 0
      switch (sortField) {
        case 'name':
          compare = a.name.localeCompare(b.name)
          break
        case 'module':
          compare = a.module.localeCompare(b.module)
          break
        case 'createdAt':
          compare = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }
      return sortOrder === 'asc' ? compare : -compare
    })

    return result
  }, [flows, filterModule, filterCompany, filterStatus, searchTerm, sortField, sortOrder])

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const toggleRowExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const handleOpenCreate = () => {
    setEditingFlow(null)
    setFormData(initialFormData)
    setError(null)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (flow: ApprovalFlow) => {
    setEditingFlow(flow)
    setFormData({
      companyId: flow.companyId || undefined,
      name: flow.name,
      description: flow.description || '',
      module: flow.module,
      conditions: parseConditions(flow.conditions),
      isDefault: flow.isDefault,
      steps: flow.steps.map((s) => ({
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
    setIsDialogOpen(true)
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
    const newSteps = formData.steps
      .filter((_, i) => i !== index)
      .map((step, i) => ({
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

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('請填寫流程名稱')
      return
    }

    if (formData.steps.length === 0) {
      setError('請至少新增一個審核關卡')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const conditionsJson = conditionsToJson(formData.conditions)
      const selectedCompany = companies.find((c) => c.id === formData.companyId)

      if (editingFlow) {
        // Update
        await updateMutation.mutateAsync({
          id: editingFlow.id,
          name: formData.name,
          description: formData.description || undefined,
          conditions: conditionsJson,
          isDefault: formData.isDefault,
          steps: formData.steps,
        })
      } else {
        // Create with auto-generated code
        const code = generateFlowCode(formData.module, selectedCompany?.code || null)
        await createMutation.mutateAsync({
          companyId: formData.companyId,
          code,
          name: formData.name,
          description: formData.description || undefined,
          module: formData.module,
          conditions: conditionsJson,
          isDefault: formData.isDefault,
          steps: formData.steps,
        })
      }

      setIsDialogOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Submit error:', err)
      setError(err instanceof Error ? err.message : '操作失敗')
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
      console.error('Delete error:', err)
      alert(err instanceof Error ? err.message : '刪除失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleActive = async (flow: ApprovalFlow) => {
    try {
      await updateMutation.mutateAsync({
        id: flow.id,
        isActive: !flow.isActive,
      })
      router.refresh()
    } catch (err) {
      console.error('Toggle active error:', err)
      alert(err instanceof Error ? err.message : '操作失敗')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">審核流程設定</h1>
          <p className="text-muted-foreground">{groupName}</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增流程
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋流程名稱或代碼..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="篩選模組" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部模組</SelectItem>
                <SelectItem value="leave">請假</SelectItem>
                <SelectItem value="expense">費用報銷</SelectItem>
                <SelectItem value="overtime">加班</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="篩選適用範圍" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部範圍</SelectItem>
                <SelectItem value="GROUP">全集團</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="篩選狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部狀態</SelectItem>
                <SelectItem value="active">啟用</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            審核流程列表
            <Badge variant="secondary" className="ml-2">
              {filteredFlows.length} 筆
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFlows.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {flows.length === 0 ? '尚未設定任何審核流程' : '找不到符合條件的流程'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-20 text-center">狀態</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      流程名稱
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('module')}
                  >
                    <div className="flex items-center gap-1">
                      適用模組
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>適用範圍</TableHead>
                  <TableHead>條件</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      建立日期
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="w-32 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlows.map((flow) => (
                  <>
                    <TableRow key={flow.id} className="group">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleRowExpanded(flow.id)}
                        >
                          {expandedRows.has(flow.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {flow.isActive ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              啟用
                            </Badge>
                          ) : (
                            <Badge variant="secondary">停用</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{flow.name}</span>
                          {flow.isDefault && (
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                              預設
                            </Badge>
                          )}
                        </div>
                        {flow.description && (
                          <p className="text-xs text-muted-foreground mt-1">{flow.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{moduleNames[flow.module] || flow.module}</Badge>
                      </TableCell>
                      <TableCell>
                        {flow.companyId ? (
                          <span>{flow.company?.name}</span>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                            全集團
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatConditions(flow.conditions, flow.module)}</span>
                      </TableCell>
                      <TableCell>
                        {new Date(flow.createdAt).toLocaleDateString('zh-TW')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenEdit(flow)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleToggleActive(flow)}
                          >
                            {flow.isActive ? '停用' : '啟用'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => handleOpenDelete(flow)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded row for steps */}
                    {expandedRows.has(flow.id) && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">審核關卡：</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {flow.steps.map((step, index) => (
                                <div key={step.id} className="flex items-center">
                                  <div className="px-3 py-2 bg-background rounded-lg border text-sm">
                                    <span className="font-medium">{step.name}</span>
                                    <span className="text-muted-foreground ml-2">
                                      ({approverTypeNames[step.approverType] || step.approverType}
                                      {step.approverValue && `: ${step.approverValue}`})
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      [{approvalModeNames[step.approvalMode]}]
                                    </span>
                                  </div>
                                  {index < flow.steps.length - 1 && (
                                    <span className="mx-2 text-muted-foreground">→</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFlow ? '編輯審核流程' : '新增審核流程'}</DialogTitle>
            <DialogDescription>
              {editingFlow
                ? '修改審核流程的設定，包含名稱、條件與審核關卡。'
                : '設定新的審核流程，包含流程名稱、適用模組及審核關卡。'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">流程名稱 *</Label>
                  <Input
                    id="name"
                    placeholder="例：一般請假審核"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="module">適用模組 *</Label>
                  <Select
                    value={formData.module}
                    onValueChange={(v) =>
                      setFormData({ ...formData, module: v, conditions: {} })
                    }
                    disabled={!!editingFlow}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leave">請假</SelectItem>
                      <SelectItem value="expense">費用報銷</SelectItem>
                      <SelectItem value="overtime">加班</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">適用公司</Label>
                  <Select
                    value={formData.companyId || ''}
                    onValueChange={(v) =>
                      setFormData({ ...formData, companyId: v || undefined })
                    }
                    disabled={!!editingFlow}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="全集團" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全集團</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isDefault: !!checked })
                  }
                />
                <Label htmlFor="isDefault">設為預設流程</Label>
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <Label>條件設定</Label>
              <div className="border rounded-lg p-4">
                <ConditionsEditor
                  module={formData.module}
                  value={formData.conditions}
                  onChange={(conditions) => setFormData({ ...formData, conditions })}
                  leaveTypes={leaveTypes}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>審核關卡</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddStep}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增關卡
                </Button>
              </div>

              <div className="space-y-3">
                {formData.steps.map((step, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">第 {index + 1} 關</span>
                      {formData.steps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                          onClick={() => handleRemoveStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">關卡名稱</Label>
                        <Input
                          value={step.name}
                          onChange={(e) => handleStepChange(index, 'name', e.target.value)}
                          placeholder="例：主管審核"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">審核者類型</Label>
                        <Select
                          value={step.approverType}
                          onValueChange={(v) => handleStepChange(index, 'approverType', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SUPERVISOR">直屬主管</SelectItem>
                            <SelectItem value="DEPARTMENT_HEAD">部門主管</SelectItem>
                            <SelectItem value="POSITION_LEVEL">指定職級</SelectItem>
                            <SelectItem value="SPECIFIC_POSITION">指定職位</SelectItem>
                            <SelectItem value="SPECIFIC_EMPLOYEE">指定員工</SelectItem>
                            <SelectItem value="ROLE">指定角色</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Show approver value input for specific types */}
                    {step.approverType === 'SPECIFIC_EMPLOYEE' && (
                      <div className="space-y-2">
                        <Label className="text-xs">選擇員工</Label>
                        <EmployeeSelector
                          companyId={formData.companyId}
                          value={step.approverValue || ''}
                          onChange={(value) => handleStepChange(index, 'approverValue', value)}
                        />
                      </div>
                    )}

                    {(step.approverType === 'POSITION_LEVEL' ||
                      step.approverType === 'SPECIFIC_POSITION' ||
                      step.approverType === 'ROLE') && (
                      <div className="space-y-2">
                        <Label className="text-xs">
                          {step.approverType === 'POSITION_LEVEL' && '職級'}
                          {step.approverType === 'SPECIFIC_POSITION' && '職位名稱'}
                          {step.approverType === 'ROLE' && '角色名稱'}
                        </Label>
                        <Input
                          value={step.approverValue || ''}
                          onChange={(e) => handleStepChange(index, 'approverValue', e.target.value)}
                          placeholder={
                            step.approverType === 'POSITION_LEVEL'
                              ? '例：7'
                              : step.approverType === 'SPECIFIC_POSITION'
                              ? '例：部門經理'
                              : '例：財務人員'
                          }
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs">審核模式</Label>
                      <Select
                        value={step.approvalMode}
                        onValueChange={(v) => handleStepChange(index, 'approvalMode', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ANY">任一人審核即可</SelectItem>
                          <SelectItem value="ALL">全部人員審核</SelectItem>
                          <SelectItem value="MAJORITY">多數決</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? '處理中...' : editingFlow ? '更新' : '建立'}
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
