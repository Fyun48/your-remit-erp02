'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Badge } from '@/components/ui/badge'
import { Plus, Upload, Trash2, Eye, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface TemplateManagerProps {
  companyId: string
  companyName: string
  userId: string
}

export function TemplateManager({
  companyId,
  companyName,
  userId,
}: TemplateManagerProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [applyDialogOpen, setApplyDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDesc, setNewTemplateDesc] = useState('')
  const [newTemplateYear, setNewTemplateYear] = useState<string>('')

  const [targetCompanyId, setTargetCompanyId] = useState('')
  const [overwrite, setOverwrite] = useState(false)

  const { data: templates, refetch: refetchTemplates } =
    trpc.leaveTypeTemplate.list.useQuery({})

  const { data: selectedTemplate } = trpc.leaveTypeTemplate.getById.useQuery(
    { id: selectedTemplateId! },
    { enabled: !!selectedTemplateId && viewDialogOpen }
  )

  const { data: companies } = trpc.company.listAll.useQuery({ userId })

  const createMutation = trpc.leaveTypeTemplate.createFromCompany.useMutation({
    onSuccess: () => {
      setCreateDialogOpen(false)
      setNewTemplateName('')
      setNewTemplateDesc('')
      setNewTemplateYear('')
      refetchTemplates()
    },
  })

  const applyMutation = trpc.leaveTypeTemplate.applyToCompany.useMutation({
    onSuccess: () => {
      setApplyDialogOpen(false)
      setTargetCompanyId('')
      setOverwrite(false)
      setSelectedTemplateId(null)
    },
  })

  const deleteMutation = trpc.leaveTypeTemplate.delete.useMutation({
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setSelectedTemplateId(null)
      refetchTemplates()
    },
  })

  const handleCreate = async () => {
    if (!newTemplateName.trim()) return

    await createMutation.mutateAsync({
      companyId,
      name: newTemplateName,
      description: newTemplateDesc || undefined,
      year: newTemplateYear ? parseInt(newTemplateYear) : undefined,
      createdById: userId,
    })
  }

  const handleApply = async () => {
    if (!selectedTemplateId || !targetCompanyId) return

    await applyMutation.mutateAsync({
      templateId: selectedTemplateId,
      targetCompanyId,
      appliedById: userId,
      overwrite,
    })
  }

  const handleDelete = async () => {
    if (!selectedTemplateId) return

    await deleteMutation.mutateAsync({
      id: selectedTemplateId,
      deletedById: userId,
    })
  }

  const openApplyDialog = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setApplyDialogOpen(true)
  }

  const openViewDialog = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setViewDialogOpen(true)
  }

  const openDeleteDialog = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/hr/leave-settings">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">假別範本管理</h1>
              <p className="text-muted-foreground">
                建立和套用假別範本，方便在不同公司間複製設定
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          從目前公司建立範本
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>範本列表</CardTitle>
          <CardDescription>
            可用的假別範本。點擊「套用」將範本套用到其他公司。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates && templates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>範本名稱</TableHead>
                  <TableHead>說明</TableHead>
                  <TableHead>適用年度</TableHead>
                  <TableHead>假別數量</TableHead>
                  <TableHead>建立者</TableHead>
                  <TableHead>建立時間</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {template.description || '-'}
                    </TableCell>
                    <TableCell>
                      {template.year ? (
                        <Badge variant="secondary">{template.year}</Badge>
                      ) : (
                        <Badge variant="outline">通用</Badge>
                      )}
                    </TableCell>
                    <TableCell>{template.items.length} 個</TableCell>
                    <TableCell>{template.createdBy.name}</TableCell>
                    <TableCell>
                      {new Date(template.createdAt).toLocaleDateString('zh-TW')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openViewDialog(template.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openApplyDialog(template.id)}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(template.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">尚未建立任何範本</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                建立第一個範本
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 建立範本對話框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>建立假別範本</DialogTitle>
            <DialogDescription>
              從「{companyName}」的現有假別設定建立範本
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">範本名稱 *</Label>
              <Input
                id="templateName"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="例如：2026 年度標準假別"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateDesc">說明</Label>
              <textarea
                id="templateDesc"
                className="w-full border rounded-md p-2 min-h-[80px]"
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
                placeholder="範本的用途說明"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateYear">適用年度（選填）</Label>
              <Input
                id="templateYear"
                type="number"
                value={newTemplateYear}
                onChange={(e) => setNewTemplateYear(e.target.value)}
                placeholder="留空表示通用範本"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTemplateName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? '建立中...' : '建立範本'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 套用範本對話框 */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>套用假別範本</DialogTitle>
            <DialogDescription>
              選擇要套用範本的目標公司
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="targetCompany">目標公司 *</Label>
              <select
                id="targetCompany"
                className="w-full border rounded-md p-2"
                value={targetCompanyId}
                onChange={(e) => setTargetCompanyId(e.target.value)}
              >
                <option value="">請選擇公司</option>
                {companies?.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="overwrite"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="overwrite" className="cursor-pointer">
                覆蓋現有假別（將現有假別設為停用）
              </Label>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">注意事項：</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>相同代碼的假別會被更新</li>
                <li>新的假別會被建立</li>
                <li>如果勾選「覆蓋」，原有假別會被停用</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleApply}
              disabled={!targetCompanyId || applyMutation.isPending}
            >
              {applyMutation.isPending ? '套用中...' : '確認套用'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 檢視範本對話框 */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description || '範本內容詳情'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedTemplate?.items && selectedTemplate.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>代碼</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>類別</TableHead>
                    <TableHead>最小單位</TableHead>
                    <TableHead>額度類型</TableHead>
                    <TableHead className="text-right">年度額度</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTemplate.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.code}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <Badge variant={item.category === 'STATUTORY' ? 'default' : 'secondary'}>
                          {item.category === 'STATUTORY' ? '法定' : '公司'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.minUnit === 'DAY'
                          ? '天'
                          : item.minUnit === 'HALF_DAY'
                          ? '半天'
                          : '小時'}
                      </TableCell>
                      <TableCell>
                        {item.quotaType === 'FIXED'
                          ? '固定'
                          : item.quotaType === 'SENIORITY'
                          ? '年資'
                          : '無限'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quotaType === 'UNLIMITED'
                          ? '無限'
                          : item.quotaType === 'SENIORITY'
                          ? '依年資'
                          : `${item.annualQuotaDays} 天`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                載入中...
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除範本？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。刪除後，範本及其所有項目將永久移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '刪除中...' : '確認刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
