'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Shield, Search, Settings, Crown, Building2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface PermissionListProps {
  companyId: string
  companyName: string
  userId: string
  canManage: boolean
}

interface ModuleGroup {
  module: string
  name: string
  permissions: {
    code: string
    name: string
    module: string
    isBasic: boolean
  }[]
}

export function PermissionList({
  companyId,
  companyName,
  userId,
  canManage,
}: PermissionListProps) {
  const [search, setSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<{
    employeeId: string
    name: string
    permissions: string[]
    isGroupAdmin: boolean
    isCompanyManager: boolean
  } | null>(null)

  const { data: employees = [], refetch } = trpc.permission.listCompanyEmployeePermissions.useQuery(
    { userId, companyId },
    { enabled: canManage }
  )

  const { data: moduleGroups = [] } = trpc.permission.listModulesGrouped.useQuery()

  const batchUpdate = trpc.permission.batchUpdate.useMutation({
    onSuccess: () => {
      refetch()
      setSelectedEmployee(null)
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const filteredEmployees = employees.filter((emp) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      emp.name.toLowerCase().includes(s) ||
      emp.employeeNo.toLowerCase().includes(s) ||
      emp.department.toLowerCase().includes(s)
    )
  })

  const handleEditPermissions = (employee: typeof employees[0]) => {
    setSelectedEmployee({
      employeeId: employee.employeeId,
      name: employee.name,
      permissions: [...employee.permissions],
      isGroupAdmin: employee.isGroupAdmin,
      isCompanyManager: employee.isCompanyManager,
    })
  }

  const handleTogglePermission = (permissionCode: string) => {
    if (!selectedEmployee) return

    setSelectedEmployee((prev) => {
      if (!prev) return null
      const permissions = prev.permissions.includes(permissionCode)
        ? prev.permissions.filter((p) => p !== permissionCode)
        : [...prev.permissions, permissionCode]
      return { ...prev, permissions }
    })
  }

  const handleSavePermissions = () => {
    if (!selectedEmployee) return

    // 過濾出非基本權限
    const nonBasicPermissions = selectedEmployee.permissions.filter((code) => {
      const allPerms = moduleGroups.flatMap((g: ModuleGroup) => g.permissions)
      const perm = allPerms.find((p: { code: string }) => p.code === code)
      return perm && !perm.isBasic
    })

    batchUpdate.mutate({
      userId,
      employeeId: selectedEmployee.employeeId,
      companyId,
      permissions: nonBasicPermissions,
    })
  }

  const getPermissionCount = (permissions: string[]) => {
    // 計算非基本權限數量
    const allPerms = moduleGroups.flatMap((g: ModuleGroup) => g.permissions)
    return permissions.filter((code) => {
      const perm = allPerms.find((p: { code: string }) => p.code === code)
      return perm && !perm.isBasic
    }).length
  }

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">您沒有權限管理此公司的權限設定</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">權限管理</h1>
        <p className="text-muted-foreground">{companyName}</p>
      </div>

      {/* 說明卡片 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">基本權限</h3>
                <p className="text-sm text-muted-foreground">
                  所有員工都有：檢視個人資料、打卡、請假、費用報銷
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium">公司管理人員</h3>
                <p className="text-sm text-muted-foreground">
                  管理部 + 副總經理以上：擁有該公司所有權限
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Crown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-medium">集團管理員</h3>
                <p className="text-sm text-muted-foreground">
                  擁有所有公司的所有權限
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜尋列 */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋員工編號、姓名、部門..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* 員工權限列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            員工權限列表
            <Badge variant="secondary" className="ml-2">
              {filteredEmployees.length} 人
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>員工編號</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>部門</TableHead>
                <TableHead>職位</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="text-center">權限狀態</TableHead>
                <TableHead className="text-center">特殊權限</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => (
                <TableRow key={emp.employeeId}>
                  <TableCell className="font-mono">{emp.employeeNo}</TableCell>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell>{emp.position}</TableCell>
                  <TableCell>{emp.role || '-'}</TableCell>
                  <TableCell className="text-center">
                    {emp.isGroupAdmin ? (
                      <Badge className="bg-amber-500">集團管理員</Badge>
                    ) : emp.isCompanyManager ? (
                      <Badge className="bg-purple-500">公司管理人員</Badge>
                    ) : (
                      <Badge variant="outline">一般員工</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {emp.isGroupAdmin || emp.isCompanyManager ? (
                      <span className="text-muted-foreground">全部</span>
                    ) : (
                      <span>{getPermissionCount(emp.permissions)} 項</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!emp.isGroupAdmin && !emp.isCompanyManager && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditPermissions(emp)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 編輯權限對話框 */}
      <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              編輯權限 - {selectedEmployee?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {moduleGroups.map((group: ModuleGroup) => (
              <div key={group.module} className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  {group.name}
                </h3>
                <div className="grid gap-2">
                  {group.permissions.map((perm: { code: string; name: string; isBasic: boolean }) => {
                    const isChecked = selectedEmployee?.permissions.includes(perm.code) || false
                    const isBasic = perm.isBasic

                    return (
                      <label
                        key={perm.code}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          isBasic ? 'bg-muted/50' : 'hover:bg-muted/30 cursor-pointer'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={isBasic}
                          onCheckedChange={() => handleTogglePermission(perm.code)}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{perm.name}</span>
                          {isBasic && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              基本權限
                            </Badge>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setSelectedEmployee(null)}>
              取消
            </Button>
            <Button onClick={handleSavePermissions} disabled={batchUpdate.isPending}>
              {batchUpdate.isPending ? '儲存中...' : '儲存變更'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
