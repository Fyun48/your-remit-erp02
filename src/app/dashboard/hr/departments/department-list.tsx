'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Users, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface DepartmentListProps {
  companyId: string
  companyName: string
}

export function DepartmentList({ companyId, companyName }: DepartmentListProps) {
  const utils = trpc.useUtils()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<typeof departments[0] | null>(null)
  const [deletingDept, setDeletingDept] = useState<typeof departments[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 使用 tRPC Query 取得資料
  const { data: departments = [], isLoading } = trpc.department.list.useQuery({ companyId })

  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    sortOrder: 0,
  })

  const { data: nextCode } = trpc.department.getNextCode.useQuery(
    { companyId },
    { enabled: isCreateOpen }
  )

  const createDept = trpc.department.create.useMutation({
    onSuccess: () => {
      setIsCreateOpen(false)
      setFormData({ name: '', parentId: '', sortOrder: 0 })
      setIsSubmitting(false)
      utils.department.list.invalidate()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const updateDept = trpc.department.update.useMutation({
    onSuccess: () => {
      setEditingDept(null)
      setIsSubmitting(false)
      utils.department.list.invalidate()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const deleteDept = trpc.department.delete.useMutation({
    onSuccess: () => {
      setDeletingDept(null)
      utils.department.list.invalidate()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      alert('請填寫部門名稱')
      return
    }
    setIsSubmitting(true)
    createDept.mutate({
      companyId,
      name: formData.name,
      parentId: formData.parentId || undefined,
      sortOrder: formData.sortOrder,
    })
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDept || !formData.name) {
      alert('請填寫部門名稱')
      return
    }
    setIsSubmitting(true)
    updateDept.mutate({
      id: editingDept.id,
      name: formData.name,
      parentId: formData.parentId || null,
      sortOrder: formData.sortOrder,
    })
  }

  const openEdit = (dept: typeof departments[0]) => {
    setEditingDept(dept)
    setFormData({
      name: dept.name,
      parentId: dept.parentId || '',
      sortOrder: dept.sortOrder,
    })
  }

  const activeDepartments = departments.filter((d) => d.isActive)

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
          <Link href="/dashboard/hr">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">部門管理</h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增部門
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            部門列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeDepartments.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立部門</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">編號</TableHead>
                  <TableHead>部門名稱</TableHead>
                  <TableHead>上級部門</TableHead>
                  <TableHead className="text-center">員工數</TableHead>
                  <TableHead className="text-center">子部門</TableHead>
                  <TableHead className="text-center">排序</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDepartments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-mono">{dept.code}</TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>
                      {dept.parent ? (
                        <Badge variant="outline">{dept.parent.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {dept._count.employees}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{dept._count.children}</TableCell>
                    <TableCell className="text-center">{dept.sortOrder}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(dept)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingDept(dept)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增部門</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>部門編號</Label>
              <Input value={nextCode || '自動產生'} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-name">部門名稱 *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：研發部"
              />
            </div>

            <div className="space-y-2">
              <Label>上級部門</Label>
              <Select
                value={formData.parentId}
                onValueChange={(v) => setFormData({ ...formData, parentId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇上級部門（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">無上級部門</SelectItem>
                  {activeDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-sort">排序</Label>
              <Input
                id="create-sort"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '建立中...' : '建立'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingDept} onOpenChange={(open) => !open && setEditingDept(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯部門 - {editingDept?.code}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">部門名稱 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>上級部門</Label>
              <Select
                value={formData.parentId}
                onValueChange={(v) => setFormData({ ...formData, parentId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇上級部門（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">無上級部門</SelectItem>
                  {activeDepartments
                    .filter((d) => d.id !== editingDept?.id)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.code} {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-sort">排序</Label>
              <Input
                id="edit-sort"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingDept(null)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDept} onOpenChange={(open) => !open && setDeletingDept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認停用</AlertDialogTitle>
            <AlertDialogDescription>
              確定要停用部門「{deletingDept?.name}」嗎？
              {deletingDept && deletingDept._count.employees > 0 && (
                <span className="text-destructive block mt-2">
                  此部門有 {deletingDept._count.employees} 位員工，請先處理員工調動。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDept && deleteDept.mutate({ id: deletingDept.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              停用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
