'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, UserCheck, Calendar, Shield } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import type { DelegationPermissionType } from '@prisma/client'

interface Employee {
  id: string
  name: string
  employeeNo: string
  department: string
  position: string
}

interface DelegationFormProps {
  companyId: string
  companyName: string
  currentUserId: string
  employees: Employee[]
}

const permissionGroups = [
  {
    category: '審核代理',
    permissions: [
      { value: 'APPROVE_LEAVE' as DelegationPermissionType, label: '代理審核請假' },
      { value: 'APPROVE_EXPENSE' as DelegationPermissionType, label: '代理審核費用核銷' },
      { value: 'APPROVE_SEAL' as DelegationPermissionType, label: '代理審核用印' },
      { value: 'APPROVE_CARD' as DelegationPermissionType, label: '代理審核名片' },
      { value: 'APPROVE_STATIONERY' as DelegationPermissionType, label: '代理審核文具' },
    ],
  },
  {
    category: '申請代理',
    permissions: [
      { value: 'APPLY_LEAVE' as DelegationPermissionType, label: '代理申請請假' },
      { value: 'APPLY_EXPENSE' as DelegationPermissionType, label: '代理申請費用核銷' },
    ],
  },
  {
    category: '其他',
    permissions: [
      { value: 'VIEW_REPORTS' as DelegationPermissionType, label: '代理查看報表' },
    ],
  },
]

export function DelegationForm({
  companyId,
  companyName,
  currentUserId,
  employees,
}: DelegationFormProps) {
  const router = useRouter()
  const [delegateId, setDelegateId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<DelegationPermissionType[]>([])

  // 檢查代理人是否可用
  const { data: canDelegate, isLoading: checkingDelegate } = trpc.delegation.checkCanBeDelegate.useQuery(
    { employeeId: delegateId },
    { enabled: !!delegateId }
  )

  const createMutation = trpc.delegation.create.useMutation({
    onSuccess: () => {
      router.push('/dashboard/hr/delegation')
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handlePermissionToggle = (permission: DelegationPermissionType) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    )
  }

  const handleSelectAllInGroup = (permissions: DelegationPermissionType[]) => {
    const allSelected = permissions.every((p) => selectedPermissions.includes(p))
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((p) => !permissions.includes(p)))
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...permissions])))
    }
  }

  const handleSubmit = () => {
    if (!delegateId) {
      alert('請選擇代理人')
      return
    }
    if (!startDate) {
      alert('請選擇開始日期')
      return
    }
    if (selectedPermissions.length === 0) {
      alert('請至少選擇一項代理權限')
      return
    }

    createMutation.mutate({
      companyId,
      delegatorId: currentUserId,
      delegateId,
      permissions: selectedPermissions,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      createdById: currentUserId,
    })
  }

  const selectedEmployee = employees.find((e) => e.id === delegateId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hr/delegation">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新增職務代理</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 代理人選擇 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              選擇代理人
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>代理人 *</Label>
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇代理人" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeNo}) - {emp.department} / {emp.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEmployee && (
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="font-medium">{selectedEmployee.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedEmployee.employeeNo} · {selectedEmployee.department} · {selectedEmployee.position}
                </p>
                {checkingDelegate ? (
                  <p className="text-sm text-muted-foreground">檢查中...</p>
                ) : canDelegate?.canBeDelegate ? (
                  <p className="text-sm text-green-600">✓ 可擔任代理人</p>
                ) : (
                  <p className="text-sm text-red-600">✗ {canDelegate?.reason}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 代理期間 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              代理期間
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>開始日期 *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label>結束日期（選填）</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                不填寫表示無期限，直到手動取消
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 代理權限 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              代理權限
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              {permissionGroups.map((group) => (
                <div key={group.category} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{group.category}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleSelectAllInGroup(group.permissions.map((p) => p.value))
                      }
                    >
                      {group.permissions.every((p) =>
                        selectedPermissions.includes(p.value)
                      )
                        ? '取消全選'
                        : '全選'}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {group.permissions.map((perm) => (
                      <div key={perm.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={perm.value}
                          checked={selectedPermissions.includes(perm.value)}
                          onCheckedChange={() => handlePermissionToggle(perm.value)}
                        />
                        <label
                          htmlFor={perm.value}
                          className="text-sm cursor-pointer"
                        >
                          {perm.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedPermissions.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  已選擇 {selectedPermissions.length} 項權限
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 提交按鈕 */}
      <div className="flex justify-end gap-4">
        <Link href="/dashboard/hr/delegation">
          <Button variant="outline">取消</Button>
        </Link>
        <Button
          onClick={handleSubmit}
          disabled={
            createMutation.isPending ||
            !delegateId ||
            !startDate ||
            selectedPermissions.length === 0 ||
            (canDelegate && !canDelegate.canBeDelegate)
          }
        >
          {createMutation.isPending ? '建立中...' : '送出代理邀請'}
        </Button>
      </div>

      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        <p className="font-medium mb-2">注意事項：</p>
        <ul className="list-disc list-inside space-y-1">
          <li>代理邀請送出後，需要對方接受才會生效</li>
          <li>代理生效期間，代理人可以代您執行所選權限的操作</li>
          <li>您可以隨時取消代理關係（需說明原因，至少 10 個字）</li>
        </ul>
      </div>
    </div>
  )
}
