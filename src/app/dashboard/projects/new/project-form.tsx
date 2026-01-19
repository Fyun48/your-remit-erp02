'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { trpc } from '@/lib/trpc'
import { FolderKanban, ArrowLeft, Loader2 } from 'lucide-react'

interface ProjectFormProps {
  companyId: string
  companyName: string
  currentUserId: string
}

type ProjectType = 'INTERNAL' | 'CLIENT'
type ProjectVisibility = 'PRIVATE' | 'DEPARTMENT' | 'COMPANY' | 'CUSTOM'

const typeLabels: Record<ProjectType, string> = {
  INTERNAL: '內部專案',
  CLIENT: '客戶專案',
}

const visibilityLabels: Record<ProjectVisibility, string> = {
  PRIVATE: '私人',
  DEPARTMENT: '部門內可見',
  COMPANY: '全公司可見',
  CUSTOM: '自訂',
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ProjectForm({ companyId, companyName, currentUserId }: ProjectFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'INTERNAL' as ProjectType,
    visibility: 'DEPARTMENT' as ProjectVisibility,
    departmentId: '',
    managerId: '',
    customerId: '',
    plannedStartDate: '',
    plannedEndDate: '',
  })

  // Fetch departments
  const { data: departments, isLoading: isDepartmentsLoading } = trpc.department.list.useQuery({
    companyId,
  })

  // Fetch employees for manager selection
  const { data: employees, isLoading: isEmployeesLoading } = trpc.hr.listEmployees.useQuery({
    companyId,
  })

  // Fetch customers (only when type is CLIENT)
  const { data: customers, isLoading: isCustomersLoading } = trpc.customer.list.useQuery(
    { companyId },
    { enabled: formData.type === 'CLIENT' }
  )

  // Create project mutation
  const createProject = trpc.project.create.useMutation()

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.name.trim()) {
      setError('請輸入專案名稱')
      return
    }
    if (!formData.departmentId) {
      setError('請選擇負責部門')
      return
    }
    if (!formData.managerId) {
      setError('請選擇專案負責人')
      return
    }
    if (formData.type === 'CLIENT' && !formData.customerId) {
      setError('客戶專案必須選擇客戶')
      return
    }
    if (formData.plannedStartDate && formData.plannedEndDate) {
      if (new Date(formData.plannedStartDate) > new Date(formData.plannedEndDate)) {
        setError('計畫結束日期不可早於開始日期')
        return
      }
    }

    setIsLoading(true)

    try {
      await createProject.mutateAsync({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        visibility: formData.visibility,
        companyId,
        departmentId: formData.departmentId,
        managerId: formData.managerId,
        customerId: formData.type === 'CLIENT' ? formData.customerId : undefined,
        plannedStartDate: formData.plannedStartDate
          ? new Date(formData.plannedStartDate)
          : undefined,
        plannedEndDate: formData.plannedEndDate
          ? new Date(formData.plannedEndDate)
          : undefined,
      })

      router.push('/dashboard/projects')
    } catch (err) {
      console.error('Create project error:', err)
      setError(err instanceof Error ? err.message : '建立專案失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新增專案</h1>
          <p className="text-sm text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              專案資訊
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Type and Visibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">專案類型 *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as ProjectType, customerId: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇專案類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibility">專案可見性 *</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) =>
                    setFormData({ ...formData, visibility: value as ProjectVisibility })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇可見性" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(visibilityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">專案名稱 *</Label>
              <Input
                id="name"
                placeholder="請輸入專案名稱"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">專案說明</Label>
              <Textarea
                id="description"
                placeholder="請輸入專案說明（選填）"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            {/* Department and Manager */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">負責部門 *</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, departmentId: value })
                  }
                  disabled={isDepartmentsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={isDepartmentsLoading ? '載入中...' : '選擇部門'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manager">專案負責人 *</Label>
                <Select
                  value={formData.managerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, managerId: value })
                  }
                  disabled={isEmployeesLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={isEmployeesLoading ? '載入中...' : '選擇負責人'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((assignment) => (
                      <SelectItem key={assignment.employee.id} value={assignment.employee.id}>
                        {assignment.employee.name} ({assignment.employee.employeeNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Customer (only for CLIENT type) */}
            {formData.type === 'CLIENT' && (
              <div className="space-y-2">
                <Label htmlFor="customer">客戶 *</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, customerId: value })
                  }
                  disabled={isCustomersLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={isCustomersLoading ? '載入中...' : '選擇客戶'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customers && customers.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    尚無客戶資料，請先至客戶管理新增客戶
                  </p>
                )}
              </div>
            )}

            {/* Planned Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plannedStartDate">計畫開始日期</Label>
                <Input
                  id="plannedStartDate"
                  type="date"
                  value={formData.plannedStartDate}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedStartDate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plannedEndDate">計畫結束日期</Label>
                <Input
                  id="plannedEndDate"
                  type="date"
                  value={formData.plannedEndDate}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedEndDate: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/dashboard/projects">
            <Button variant="outline" type="button" disabled={isLoading}>
              取消
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                建立中...
              </>
            ) : (
              '建立專案'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
