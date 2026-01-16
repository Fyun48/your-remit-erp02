'use client'

import { useState } from 'react'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Plus,
  Shield,
  UserMinus,
  ArrowLeft,
  Search,
  Loader2,
  Pencil,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface PermissionListProps {
  userId: string
}

const permissionLabels: Record<string, { name: string; description: string; color: string }> = {
  GROUP_ADMIN: {
    name: '集團超級管理員',
    description: '擁有所有集團級權限',
    color: 'bg-purple-500',
  },
  CROSS_COMPANY_VIEW: {
    name: '跨公司檢視',
    description: '可檢視所有分公司資料',
    color: 'bg-blue-500',
  },
  CROSS_COMPANY_EDIT: {
    name: '跨公司編輯',
    description: '可編輯所有分公司資料',
    color: 'bg-green-500',
  },
  AUDIT_LOG_VIEW: {
    name: '稽核日誌檢視',
    description: '可檢視系統操作紀錄',
    color: 'bg-orange-500',
  },
  COMPANY_MANAGEMENT: {
    name: '公司管理',
    description: '可創建、編輯、停用公司',
    color: 'bg-cyan-500',
  },
}

export function PermissionList({ userId }: PermissionListProps) {
  const utils = trpc.useUtils()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPermissionType, setSelectedPermissionType] = useState<string>('all')

  // 使用 tRPC Query 取得資料
  const { data: permissions = [], isLoading } = trpc.groupPermission.listAll.useQuery({ userId })

  // Dialog states
  const [showGrantDialog, setShowGrantDialog] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<typeof permissions[0] | null>(null)
  const [editNote, setEditNote] = useState('')

  // Search employee state
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<{
    id: string
    name: string
    employeeNo: string
    email: string
    assignments: Array<{
      company: { name: string }
      position: { name: string }
    }>
  } | null>(null)

  // Form states
  const [grantFormData, setGrantFormData] = useState({
    permission: 'CROSS_COMPANY_VIEW',
    note: '',
  })

  const searchEmployeesQuery = trpc.groupPermission.searchEmployees.useQuery(
    { userId, query: employeeSearchTerm },
    { enabled: employeeSearchTerm.length >= 1 }
  )

  const grantMutation = trpc.groupPermission.grant.useMutation({
    onSuccess: () => {
      setShowGrantDialog(false)
      setSelectedEmployee(null)
      setEmployeeSearchTerm('')
      utils.groupPermission.listAll.invalidate()
    },
  })

  const revokeMutation = trpc.groupPermission.revoke.useMutation({
    onSuccess: () => {
      setShowRevokeDialog(false)
      utils.groupPermission.listAll.invalidate()
    },
  })

  const updateMutation = trpc.groupPermission.update.useMutation({
    onSuccess: () => {
      setShowEditDialog(false)
      setSelectedPermission(null)
      utils.groupPermission.listAll.invalidate()
    },
  })

  // Filter permissions
  const filteredPermissions = permissions.filter((perm) => {
    const matchesSearch =
      perm.employee.name.includes(searchTerm) ||
      perm.employee.employeeNo.includes(searchTerm) ||
      perm.employee.email.includes(searchTerm)
    const matchesType =
      selectedPermissionType === 'all' || perm.permission === selectedPermissionType
    return matchesSearch && matchesType && perm.isActive
  })

  const handleGrant = () => {
    setSelectedEmployee(null)
    setEmployeeSearchTerm('')
    setGrantFormData({
      permission: 'CROSS_COMPANY_VIEW',
      note: '',
    })
    setShowGrantDialog(true)
  }

  const handleRevoke = (perm: typeof permissions[0]) => {
    setSelectedPermission(perm)
    setShowRevokeDialog(true)
  }

  const handleEdit = (perm: typeof permissions[0]) => {
    setSelectedPermission(perm)
    setEditNote(perm.note || '')
    setShowEditDialog(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const submitGrant = () => {
    if (!selectedEmployee) return
    grantMutation.mutate({
      userId,
      employeeId: selectedEmployee.id,
      permission: grantFormData.permission as 'GROUP_ADMIN' | 'CROSS_COMPANY_VIEW' | 'CROSS_COMPANY_EDIT' | 'AUDIT_LOG_VIEW' | 'COMPANY_MANAGEMENT',
      note: grantFormData.note || undefined,
    })
  }

  const submitRevoke = () => {
    if (!selectedPermission) return
    revokeMutation.mutate({
      userId,
      employeeId: selectedPermission.employeeId,
      permission: selectedPermission.permission as 'GROUP_ADMIN' | 'CROSS_COMPANY_VIEW' | 'CROSS_COMPANY_EDIT' | 'AUDIT_LOG_VIEW' | 'COMPANY_MANAGEMENT',
    })
  }

  const submitEdit = () => {
    if (!selectedPermission) return
    updateMutation.mutate({
      userId,
      employeeId: selectedPermission.employeeId,
      permission: selectedPermission.permission as 'GROUP_ADMIN' | 'CROSS_COMPANY_VIEW' | 'CROSS_COMPANY_EDIT' | 'AUDIT_LOG_VIEW' | 'COMPANY_MANAGEMENT',
      note: editNote || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/system">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">權限管理</h1>
            <p className="text-muted-foreground">管理集團級特殊權限</p>
          </div>
        </div>
        <Button onClick={handleGrant}>
          <Plus className="h-4 w-4 mr-2" />
          授予權限
        </Button>
      </div>

      {/* 權限類型說明 */}
      <div className="grid gap-3 md:grid-cols-5">
        {Object.entries(permissionLabels).map(([key, value]) => (
          <Card key={key} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${value.color}`} />
              <span className="font-medium text-sm">{value.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">{value.description}</p>
          </Card>
        ))}
      </div>

      {/* 搜尋與篩選 */}
      <div className="flex gap-4">
        <Input
          placeholder="搜尋員工姓名、編號或信箱..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={selectedPermissionType} onValueChange={setSelectedPermissionType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="選擇權限類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有權限</SelectItem>
            {Object.entries(permissionLabels).map(([key, value]) => (
              <SelectItem key={key} value={key}>
                {value.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 權限列表 */}
      <Card>
        <CardHeader>
          <CardTitle>已授權列表 ({filteredPermissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>員工</TableHead>
                <TableHead>所屬公司</TableHead>
                <TableHead>權限類型</TableHead>
                <TableHead>授權人</TableHead>
                <TableHead>授權時間</TableHead>
                <TableHead>備註</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermissions.map((perm) => (
                <TableRow key={perm.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{perm.employee.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {perm.employee.employeeNo}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {perm.employee.assignments[0]?.company.name || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${permissionLabels[perm.permission]?.color} text-white`}
                    >
                      {permissionLabels[perm.permission]?.name || perm.permission}
                    </Badge>
                  </TableCell>
                  <TableCell>{perm.grantedBy.name}</TableCell>
                  <TableCell>
                    {format(new Date(perm.grantedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                  </TableCell>
                  <TableCell>{perm.note || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(perm)}
                        title="編輯備註"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(perm)}
                        className="text-destructive hover:text-destructive"
                        title="撤銷權限"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPermissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Shield className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">沒有符合條件的權限紀錄</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 授予權限 Dialog */}
      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>授予權限</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 員工搜尋 */}
            <div className="space-y-2">
              <Label>選擇員工 *</Label>
              {selectedEmployee ? (
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{selectedEmployee.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedEmployee.employeeNo} | {selectedEmployee.email}
                      </div>
                      {selectedEmployee.assignments[0] && (
                        <div className="text-sm text-muted-foreground">
                          {selectedEmployee.assignments[0].company.name} -{' '}
                          {selectedEmployee.assignments[0].position.name}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEmployee(null)}
                    >
                      更換
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={employeeSearchTerm}
                      onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                      placeholder="輸入員工姓名、編號或信箱搜尋..."
                      className="pl-10"
                    />
                  </div>
                  {searchEmployeesQuery.data && searchEmployeesQuery.data.length > 0 && (
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {searchEmployeesQuery.data.map((emp) => (
                        <div
                          key={emp.id}
                          className="p-2 hover:bg-accent cursor-pointer"
                          onClick={() => {
                            setSelectedEmployee(emp)
                            setEmployeeSearchTerm('')
                          }}
                        >
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {emp.employeeNo} | {emp.email}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 權限類型 */}
            <div className="space-y-2">
              <Label>權限類型 *</Label>
              <Select
                value={grantFormData.permission}
                onValueChange={(v) => setGrantFormData({ ...grantFormData, permission: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(permissionLabels).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${value.color}`} />
                        {value.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {permissionLabels[grantFormData.permission]?.description}
              </p>
            </div>

            {/* 備註 */}
            <div className="space-y-2">
              <Label>備註</Label>
              <Input
                value={grantFormData.note}
                onChange={(e) => setGrantFormData({ ...grantFormData, note: e.target.value })}
                placeholder="選填，說明授權原因"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantDialog(false)}>
              取消
            </Button>
            <Button
              onClick={submitGrant}
              disabled={!selectedEmployee || grantMutation.isPending}
            >
              {grantMutation.isPending ? '授權中...' : '授權'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 撤銷確認 Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認撤銷權限？</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要撤銷「{selectedPermission?.employee.name}」的「
              {selectedPermission && permissionLabels[selectedPermission.permission]?.name}」權限嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitRevoke}
              disabled={revokeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeMutation.isPending ? '撤銷中...' : '確認撤銷'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 編輯權限 Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯權限備註</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPermission && (
              <>
                <div className="space-y-2">
                  <Label>員工</Label>
                  <div className="text-sm text-muted-foreground">
                    {selectedPermission.employee.name} ({selectedPermission.employee.employeeNo})
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>權限類型</Label>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${permissionLabels[selectedPermission.permission]?.color} text-white`}
                    >
                      {permissionLabels[selectedPermission.permission]?.name}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editNote">備註</Label>
                  <Input
                    id="editNote"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="說明授權原因或用途"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
