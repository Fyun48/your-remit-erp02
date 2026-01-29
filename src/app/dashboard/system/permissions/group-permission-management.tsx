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
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Crown, Search, Trash2, Loader2, UserPlus } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface GroupPermissionManagementProps {
  userId: string
}

export function GroupPermissionManagement({ userId }: GroupPermissionManagementProps) {
  const utils = trpc.useUtils()
  const [showGrantDialog, setShowGrantDialog] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<{
    id: string
    name: string
    employeeNo: string
  } | null>(null)
  const [selectedPermission, setSelectedPermission] = useState<string>('')
  const [note, setNote] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<{
    employeeId: string
    employeeName: string
    permission: string
    permissionName: string
  } | null>(null)

  // 取得所有集團權限
  const { data: permissions = [], isLoading } = trpc.groupPermission.listAll.useQuery(
    { userId },
    { retry: false }
  )

  // 取得權限類型說明
  const { data: permissionTypes = [] } = trpc.groupPermission.getPermissionTypes.useQuery()

  // 搜尋員工
  const { data: searchResults = [], isFetching: isSearching } = trpc.groupPermission.searchEmployees.useQuery(
    { userId, query: searchQuery },
    { enabled: searchQuery.length >= 1 }
  )

  // 授予權限
  const grantMutation = trpc.groupPermission.grant.useMutation({
    onSuccess: () => {
      utils.groupPermission.listAll.invalidate()
      setShowGrantDialog(false)
      resetForm()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  // 撤銷權限
  const revokeMutation = trpc.groupPermission.revoke.useMutation({
    onSuccess: () => {
      utils.groupPermission.listAll.invalidate()
      setShowRevokeDialog(false)
      setRevokeTarget(null)
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const resetForm = () => {
    setSearchQuery('')
    setSelectedEmployee(null)
    setSelectedPermission('')
    setNote('')
  }

  const handleGrant = () => {
    if (!selectedEmployee || !selectedPermission) return

    grantMutation.mutate({
      userId,
      employeeId: selectedEmployee.id,
      permission: selectedPermission as 'GROUP_ADMIN' | 'CROSS_COMPANY_VIEW' | 'CROSS_COMPANY_EDIT' | 'AUDIT_LOG_VIEW' | 'COMPANY_MANAGEMENT',
      note: note || undefined,
    })
  }

  const handleRevoke = () => {
    if (!revokeTarget) return

    revokeMutation.mutate({
      userId,
      employeeId: revokeTarget.employeeId,
      permission: revokeTarget.permission as 'GROUP_ADMIN' | 'CROSS_COMPANY_VIEW' | 'CROSS_COMPANY_EDIT' | 'AUDIT_LOG_VIEW' | 'COMPANY_MANAGEMENT',
    })
  }

  const openRevokeDialog = (item: typeof permissions[0]) => {
    const permType = permissionTypes.find((t) => t.code === item.permission)
    setRevokeTarget({
      employeeId: item.employeeId,
      employeeName: item.employee.name,
      permission: item.permission,
      permissionName: permType?.name || item.permission,
    })
    setShowRevokeDialog(true)
  }

  // 依權限類型分組
  const groupedPermissions = permissionTypes.map((type) => ({
    ...type,
    items: permissions.filter((p) => p.permission === type.code && p.isActive),
  }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">集團權限管理</h1>
          <p className="text-muted-foreground">管理集團級別的特殊權限</p>
        </div>
        <Button onClick={() => setShowGrantDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          授予權限
        </Button>
      </div>

      {/* 權限說明 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {permissionTypes.map((type) => (
              <div key={type.code} className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Crown className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{type.name}</h3>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 權限列表 */}
      {groupedPermissions.map((group) => (
        <Card key={group.code}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-5 w-5 text-amber-500" />
              {group.name}
              <Badge variant="secondary" className="ml-2">
                {group.items.length} 人
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {group.items.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                尚未授予任何人此權限
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>員工編號</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>公司/職位</TableHead>
                    <TableHead>授權者</TableHead>
                    <TableHead>授權時間</TableHead>
                    <TableHead>備註</TableHead>
                    <TableHead className="w-20">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item) => (
                    <TableRow key={`${item.employeeId}-${item.permission}`}>
                      <TableCell className="font-mono">
                        {item.employee.employeeNo}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.employee.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.employee.assignments[0]?.company?.name || '-'} / {item.employee.assignments[0]?.position?.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.grantedBy?.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(item.grantedAt), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {item.note || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => openRevokeDialog(item)}
                          disabled={item.employeeId === userId && item.permission === 'GROUP_ADMIN'}
                          title={item.employeeId === userId && item.permission === 'GROUP_ADMIN' ? '無法撤銷自己的集團管理員權限' : '撤銷權限'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}

      {/* 授予權限對話框 */}
      <Dialog open={showGrantDialog} onOpenChange={(open) => {
        setShowGrantDialog(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>授予集團權限</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 搜尋員工 */}
            <div className="space-y-2">
              <Label>搜尋員工</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="輸入員工編號、姓名或 Email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setSelectedEmployee(null)
                  }}
                  className="pl-8"
                />
              </div>

              {/* 搜尋結果 */}
              {searchQuery && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-3 text-center text-muted-foreground text-sm">
                      搜尋中...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-3 text-center text-muted-foreground text-sm">
                      找不到符合的員工
                    </div>
                  ) : (
                    searchResults.map((emp) => (
                      <button
                        key={emp.id}
                        className={`w-full p-2 text-left hover:bg-muted flex items-center justify-between ${
                          selectedEmployee?.id === emp.id ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => {
                          setSelectedEmployee({
                            id: emp.id,
                            name: emp.name,
                            employeeNo: emp.employeeNo,
                          })
                          setSearchQuery(emp.name)
                        }}
                      >
                        <div>
                          <span className="font-medium">{emp.name}</span>
                          <span className="text-muted-foreground ml-2">
                            ({emp.employeeNo})
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {emp.assignments[0]?.company?.name || ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {selectedEmployee && (
                <div className="p-2 bg-muted rounded-md text-sm">
                  已選擇：<strong>{selectedEmployee.name}</strong> ({selectedEmployee.employeeNo})
                </div>
              )}
            </div>

            {/* 選擇權限類型 */}
            <div className="space-y-2">
              <Label>權限類型</Label>
              <Select value={selectedPermission} onValueChange={setSelectedPermission}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇要授予的權限" />
                </SelectTrigger>
                <SelectContent>
                  {permissionTypes.map((type) => (
                    <SelectItem key={type.code} value={type.code}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPermission && (
                <p className="text-xs text-muted-foreground">
                  {permissionTypes.find((t) => t.code === selectedPermission)?.description}
                </p>
              )}
            </div>

            {/* 備註 */}
            <div className="space-y-2">
              <Label>備註（選填）</Label>
              <Textarea
                placeholder="輸入授權原因或備註..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleGrant}
              disabled={!selectedEmployee || !selectedPermission || grantMutation.isPending}
            >
              {grantMutation.isPending ? '授權中...' : '授予權限'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 撤銷確認對話框 */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認撤銷權限</AlertDialogTitle>
            <AlertDialogDescription>
              確定要撤銷 <strong>{revokeTarget?.employeeName}</strong> 的「{revokeTarget?.permissionName}」權限嗎？
              <br />
              <span className="text-destructive">此操作無法復原。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRevokeTarget(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revokeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeMutation.isPending ? '撤銷中...' : '確認撤銷'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
