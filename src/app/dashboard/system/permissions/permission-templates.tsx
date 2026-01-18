'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FileStack, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format } from 'date-fns'

interface PermissionTemplatesProps {
  userId: string
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

export function PermissionTemplates({ userId }: PermissionTemplatesProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<{
    id: string
    name: string
    description: string | null
    permissions: string[]
  } | null>(null)
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  })

  const { data: templates = [], refetch } = trpc.permission.listTemplates.useQuery(
    { userId },
    { retry: false }
  )

  const { data: moduleGroups = [] } = trpc.permission.listModulesGrouped.useQuery()

  const createMutation = trpc.permission.createTemplate.useMutation({
    onSuccess: () => {
      refetch()
      setShowCreateDialog(false)
      resetForm()
    },
  })

  const updateMutation = trpc.permission.updateTemplate.useMutation({
    onSuccess: () => {
      refetch()
      setEditingTemplate(null)
      resetForm()
    },
  })

  const deleteMutation = trpc.permission.deleteTemplate.useMutation({
    onSuccess: () => {
      refetch()
      setDeleteTemplateId(null)
    },
  })

  const resetForm = () => {
    setFormData({ name: '', description: '', permissions: [] })
  }

  const handleCreate = () => {
    createMutation.mutate({
      userId,
      name: formData.name,
      description: formData.description || undefined,
      permissions: formData.permissions,
    })
  }

  const handleUpdate = () => {
    if (!editingTemplate) return
    updateMutation.mutate({
      userId,
      templateId: editingTemplate.id,
      name: formData.name,
      description: formData.description || undefined,
      permissions: formData.permissions,
    })
  }

  const handleDelete = () => {
    if (!deleteTemplateId) return
    deleteMutation.mutate({ userId, templateId: deleteTemplateId })
  }

  const openEditDialog = (template: typeof templates[0]) => {
    setFormData({
      name: template.name,
      description: template.description || '',
      permissions: template.permissions as string[],
    })
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description,
      permissions: template.permissions as string[],
    })
  }

  const togglePermission = (code: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(code)
        ? prev.permissions.filter(p => p !== code)
        : [...prev.permissions, code],
    }))
  }

  const getPermissionName = (code: string) => {
    const allPerms = moduleGroups.flatMap((g: ModuleGroup) => g.permissions)
    const perm = allPerms.find((p: { code: string }) => p.code === code)
    return perm?.name || code
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5" />
            權限範本
          </CardTitle>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            建立範本
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            尚未建立任何權限範本
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>範本名稱</TableHead>
                <TableHead>說明</TableHead>
                <TableHead className="text-center">權限數量</TableHead>
                <TableHead>建立時間</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.description || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">
                      {(template.permissions as string[]).length} 項
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(template.createdAt), 'yyyy/MM/dd')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTemplateId(template.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* 建立/編輯對話框 */}
      <Dialog
        open={showCreateDialog || !!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false)
            setEditingTemplate(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? '編輯權限範本' : '建立權限範本'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>範本名稱</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例：財務部門基本權限"
              />
            </div>

            <div className="space-y-2">
              <Label>說明（選填）</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="描述此範本的用途..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>選擇權限</Label>
              <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-4">
                {moduleGroups.map((group: ModuleGroup) => (
                  <div key={group.module}>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">
                      {group.name}
                    </h4>
                    <div className="grid gap-2">
                      {group.permissions
                        .filter(p => !p.isBasic)
                        .map((perm) => (
                          <label
                            key={perm.code}
                            className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                          >
                            <Checkbox
                              checked={formData.permissions.includes(perm.code)}
                              onCheckedChange={() => togglePermission(perm.code)}
                            />
                            <span className="text-sm">{perm.name}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {formData.permissions.length > 0 && (
              <div className="space-y-2">
                <Label>已選擇的權限</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.permissions.map((code) => (
                    <Badge key={code} variant="secondary">
                      {getPermissionName(code)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setEditingTemplate(null)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button
              onClick={editingTemplate ? handleUpdate : handleCreate}
              disabled={
                !formData.name ||
                formData.permissions.length === 0 ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTemplate ? '儲存變更' : '建立範本'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此範本？</AlertDialogTitle>
            <AlertDialogDescription>
              刪除後無法復原，但不會影響已套用此範本的員工權限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
