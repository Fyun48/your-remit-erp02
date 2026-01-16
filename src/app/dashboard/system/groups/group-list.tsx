'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  Building2,
  Edit,
  Power,
  ArrowLeft,
  Building,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface GroupListProps {
  userId: string
}

export function GroupList({ userId }: GroupListProps) {
  const utils = trpc.useUtils()
  const [searchTerm, setSearchTerm] = useState('')

  // 使用 tRPC Query 取得資料
  const { data: groups = [], isLoading } = trpc.group.list.useQuery()

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showToggleDialog, setShowToggleDialog] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<typeof groups[0] | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
  })

  const createMutation = trpc.group.create.useMutation({
    onSuccess: () => {
      setShowCreateDialog(false)
      setFormData({ name: '', code: '' })
      utils.group.list.invalidate()
    },
  })

  const updateMutation = trpc.group.update.useMutation({
    onSuccess: () => {
      setShowEditDialog(false)
      utils.group.list.invalidate()
    },
  })

  const toggleMutation = trpc.group.toggleActive.useMutation({
    onSuccess: () => {
      setShowToggleDialog(false)
      utils.group.list.invalidate()
    },
    onError: (error: { message: string }) => {
      alert(error.message)
    },
  })

  // Filter groups
  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.code.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const handleCreate = () => {
    setFormData({ name: '', code: '' })
    setShowCreateDialog(true)
  }

  const handleEdit = (group: typeof groups[0]) => {
    setSelectedGroup(group)
    setFormData({ name: group.name, code: group.code })
    setShowEditDialog(true)
  }

  const handleToggle = (group: typeof groups[0]) => {
    setSelectedGroup(group)
    setShowToggleDialog(true)
  }

  const submitCreate = () => {
    createMutation.mutate({
      userId,
      name: formData.name,
      code: formData.code,
    })
  }

  const submitEdit = () => {
    if (!selectedGroup) return
    updateMutation.mutate({
      userId,
      id: selectedGroup.id,
      name: formData.name,
    })
  }

  const submitToggle = () => {
    if (!selectedGroup) return
    toggleMutation.mutate({
      userId,
      id: selectedGroup.id,
    })
  }

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
        <div className="flex items-center gap-4">
          <Link href="/dashboard/system">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">集團管理</h1>
            <p className="text-muted-foreground">管理所有集團</p>
          </div>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增集團
        </Button>
      </div>

      {/* 搜尋 */}
      <div className="flex gap-4">
        <Input
          placeholder="搜尋集團名稱或代碼..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* 集團列表 */}
      <Card>
        <CardHeader>
          <CardTitle>集團列表 ({filteredGroups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代碼</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead className="text-center">公司數</TableHead>
                <TableHead className="text-center">狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-mono">{group.code}</TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {group._count.companies}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={group.isActive ? 'default' : 'secondary'}>
                      {group.isActive ? '啟用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(group)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(group)}
                      >
                        <Power className={`h-4 w-4 ${group.isActive ? 'text-destructive' : 'text-green-600'}`} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">沒有符合條件的集團</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 新增集團 Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增集團</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>集團代碼 *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="例如: GRP001"
              />
            </div>
            <div className="space-y-2">
              <Label>集團名稱 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="輸入集團名稱"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button
              onClick={submitCreate}
              disabled={!formData.name || !formData.code || createMutation.isPending}
            >
              {createMutation.isPending ? '建立中...' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯集團 Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯集團</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>集團代碼</Label>
              <Input value={selectedGroup?.code || ''} disabled />
              <p className="text-xs text-muted-foreground">代碼建立後無法修改</p>
            </div>
            <div className="space-y-2">
              <Label>集團名稱 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button
              onClick={submitEdit}
              disabled={!formData.name || updateMutation.isPending}
            >
              {updateMutation.isPending ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 停用/啟用確認 Dialog */}
      <AlertDialog open={showToggleDialog} onOpenChange={setShowToggleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedGroup?.isActive ? '確認停用集團？' : '確認啟用集團？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedGroup?.isActive ? (
                <>
                  您確定要停用「{selectedGroup?.name}」嗎？
                  {selectedGroup && selectedGroup._count.companies > 0 && (
                    <span className="block mt-2 text-destructive">
                      此集團下有 {selectedGroup._count.companies} 家公司，需先停用所有公司才能停用集團。
                    </span>
                  )}
                </>
              ) : (
                <>您確定要啟用「{selectedGroup?.name}」嗎？</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitToggle}
              disabled={toggleMutation.isPending}
              className={
                selectedGroup?.isActive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-green-600 hover:bg-green-700'
              }
            >
              {toggleMutation.isPending
                ? '處理中...'
                : selectedGroup?.isActive
                ? '確認停用'
                : '確認啟用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
