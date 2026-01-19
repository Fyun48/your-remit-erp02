'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  Plus,
  Search,
  Folder,
  Layers,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  FileText,
  Tag,
  User,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface TemplateListProps {
  companyId: string
  currentUserId: string
}

export function TemplateList({ companyId, currentUserId }: TemplateListProps) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; name: string; description: string; category: string } | null>(null)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)

  // Form state for new template
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: '',
    type: 'INTERNAL' as 'INTERNAL' | 'CLIENT',
    tags: '',
  })

  const { data: templates, isLoading } = trpc.project.listTemplates.useQuery({
    companyId,
    category: selectedCategory || undefined,
    search: searchQuery || undefined,
  })

  const { data: categories } = trpc.project.getTemplateCategories.useQuery({
    companyId,
  })

  const createTemplate = trpc.project.createTemplate.useMutation({
    onSuccess: () => {
      utils.project.listTemplates.invalidate()
      setIsCreateOpen(false)
      setNewTemplate({ name: '', description: '', category: '', type: 'INTERNAL', tags: '' })
    },
  })

  const updateTemplate = trpc.project.updateTemplate.useMutation({
    onSuccess: () => {
      utils.project.listTemplates.invalidate()
      setEditingTemplate(null)
    },
  })

  const deleteTemplate = trpc.project.deleteTemplate.useMutation({
    onSuccess: () => {
      utils.project.listTemplates.invalidate()
      setDeletingTemplateId(null)
    },
  })

  const handleCreate = () => {
    createTemplate.mutate({
      name: newTemplate.name,
      description: newTemplate.description || undefined,
      category: newTemplate.category || undefined,
      type: newTemplate.type,
      companyId,
      createdById: currentUserId,
      tags: newTemplate.tags ? newTemplate.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    })
  }

  const handleUpdate = () => {
    if (!editingTemplate) return
    updateTemplate.mutate({
      id: editingTemplate.id,
      name: editingTemplate.name,
      description: editingTemplate.description || undefined,
      category: editingTemplate.category || undefined,
    })
  }

  const handleDelete = () => {
    if (!deletingTemplateId) return
    deleteTemplate.mutate({ id: deletingTemplateId })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">專案範本</h1>
            <p className="text-sm text-muted-foreground">
              管理專案範本以快速建立新專案
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增範本
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋範本..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="所有分類" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">所有分類</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      {template.name}
                    </CardTitle>
                    {template.category && (
                      <Badge variant="secondary" className="mt-2">
                        <Folder className="h-3 w-3 mr-1" />
                        {template.category}
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/projects/templates/${template.id}`)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        查看詳情
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/projects/new?templateId=${template.id}`)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        使用此範本
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingTemplate({
                          id: template.id,
                          name: template.name,
                          description: template.description || '',
                          category: template.category || '',
                        })}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        編輯
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeletingTemplateId(template.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        刪除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {template.description && (
                  <CardDescription className="mb-3 line-clamp-2">
                    {template.description}
                  </CardDescription>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    {template._count.phases} 個階段
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {template.createdBy.name}
                  </span>
                </div>
                {template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {template.tags.map((tag) => (
                      <Badge key={tag.name} variant="outline" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  更新於 {format(new Date(template.updatedAt), 'yyyy/MM/dd', { locale: zhTW })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium">尚無專案範本</p>
            <p className="text-sm text-muted-foreground mb-4">
              建立範本以快速開始新專案
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              建立第一個範本
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Template Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增專案範本</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>範本名稱</Label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="輸入範本名稱"
              />
            </div>
            <div className="space-y-2">
              <Label>說明</Label>
              <Textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="輸入範本說明"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分類</Label>
                <Input
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  placeholder="例：軟體開發"
                />
              </div>
              <div className="space-y-2">
                <Label>專案類型</Label>
                <Select
                  value={newTemplate.type}
                  onValueChange={(v) => setNewTemplate({ ...newTemplate, type: v as 'INTERNAL' | 'CLIENT' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTERNAL">內部專案</SelectItem>
                    <SelectItem value="CLIENT">客戶專案</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>標籤（以逗號分隔）</Label>
              <Input
                value={newTemplate.tags}
                onChange={(e) => setNewTemplate({ ...newTemplate, tags: e.target.value })}
                placeholder="例：敏捷, 開發, MVP"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTemplate.name || createTemplate.isPending}
            >
              {createTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              建立範本
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯範本</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>範本名稱</Label>
                <Input
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>說明</Label>
                <Textarea
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>分類</Label>
                <Input
                  value={editingTemplate.category}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!editingTemplate?.name || updateTemplate.isPending}
            >
              {updateTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              儲存變更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTemplateId} onOpenChange={() => setDeletingTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除範本</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除這個範本嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {deleteTemplate.isPending ? '刪除中...' : '確定刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
