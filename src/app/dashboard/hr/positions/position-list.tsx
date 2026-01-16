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
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Pencil, Trash2, Briefcase, Users, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface PositionListProps {
  companyId: string
  companyName: string
}

const levelLabels: Record<number, string> = {
  0: '基層',
  1: '初級',
  2: '中級',
  3: '高級',
  4: '資深',
  5: '主管',
  6: '經理',
  7: '協理',
  8: '副總',
  9: '總經理',
  10: '董事',
}

export function PositionList({ companyId, companyName }: PositionListProps) {
  const utils = trpc.useUtils()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPos, setEditingPos] = useState<typeof positions[0] | null>(null)
  const [deletingPos, setDeletingPos] = useState<typeof positions[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 使用 tRPC Query 取得資料
  const { data: positions = [], isLoading } = trpc.position.list.useQuery({ companyId })

  const [formData, setFormData] = useState({
    name: '',
    level: 0,
  })

  const { data: nextCode } = trpc.position.getNextCode.useQuery(
    { companyId },
    { enabled: isCreateOpen }
  )

  const createPos = trpc.position.create.useMutation({
    onSuccess: () => {
      setIsCreateOpen(false)
      setFormData({ name: '', level: 0 })
      setIsSubmitting(false)
      utils.position.list.invalidate()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const updatePos = trpc.position.update.useMutation({
    onSuccess: () => {
      setEditingPos(null)
      setIsSubmitting(false)
      utils.position.list.invalidate()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const deletePos = trpc.position.delete.useMutation({
    onSuccess: () => {
      setDeletingPos(null)
      utils.position.list.invalidate()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      alert('請填寫職位名稱')
      return
    }
    setIsSubmitting(true)
    createPos.mutate({
      companyId,
      name: formData.name,
      level: formData.level,
    })
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPos || !formData.name) {
      alert('請填寫職位名稱')
      return
    }
    setIsSubmitting(true)
    updatePos.mutate({
      id: editingPos.id,
      name: formData.name,
      level: formData.level,
    })
  }

  const openEdit = (pos: typeof positions[0]) => {
    setEditingPos(pos)
    setFormData({
      name: pos.name,
      level: pos.level,
    })
  }

  const activePositions = positions.filter((p) => p.isActive)

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
            <h1 className="text-2xl font-bold">職位管理</h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增職位
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            職位列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activePositions.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立職位</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">編號</TableHead>
                  <TableHead>職位名稱</TableHead>
                  <TableHead>職級</TableHead>
                  <TableHead className="text-center">員工數</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePositions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-mono">{pos.code}</TableCell>
                    <TableCell className="font-medium">{pos.name}</TableCell>
                    <TableCell>
                      <Badge variant={pos.level >= 5 ? 'default' : 'secondary'}>
                        Lv.{pos.level} {levelLabels[pos.level] || ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {pos._count.employees}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(pos)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingPos(pos)}
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
            <DialogTitle>新增職位</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>職位編號</Label>
              <Input value={nextCode || '自動產生'} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-name">職位名稱 *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：軟體工程師"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-level">職級 (0-10)</Label>
              <Input
                id="create-level"
                type="number"
                min="0"
                max="10"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                {levelLabels[formData.level] || ''}（數字越大職級越高，用於審核流程）
              </p>
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
      <Dialog open={!!editingPos} onOpenChange={(open) => !open && setEditingPos(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯職位 - {editingPos?.code}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">職位名稱 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-level">職級 (0-10)</Label>
              <Input
                id="edit-level"
                type="number"
                min="0"
                max="10"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                {levelLabels[formData.level] || ''}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingPos(null)}>
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
      <AlertDialog open={!!deletingPos} onOpenChange={(open) => !open && setDeletingPos(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認停用</AlertDialogTitle>
            <AlertDialogDescription>
              確定要停用職位「{deletingPos?.name}」嗎？
              {deletingPos && deletingPos._count.employees > 0 && (
                <span className="text-destructive block mt-2">
                  此職位有 {deletingPos._count.employees} 位員工，請先處理員工職位調整。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPos && deletePos.mutate({ id: deletingPos.id })}
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
