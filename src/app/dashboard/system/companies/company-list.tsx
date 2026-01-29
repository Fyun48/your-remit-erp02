'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  Building2,
  Users,
  Briefcase,
  Building,
  Edit,
  Power,
  ArrowLeft,
  Loader2,
  Trash2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

interface CompanyListProps {
  userId: string
  canManage: boolean
}

export function CompanyList({ userId, canManage }: CompanyListProps) {
  const utils = trpc.useUtils()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all')

  // 使用 tRPC Query 取得資料
  const { data: companies = [], isLoading: isLoadingCompanies } = trpc.company.listAll.useQuery({ userId })
  const { data: groups = [], isLoading: isLoadingGroups } = trpc.company.listGroups.useQuery({ userId })

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<typeof companies[0] | null>(null)

  // Delete dialog states
  const [deleteMode, setDeleteMode] = useState<'TRANSFER' | 'DEACTIVATE'>('DEACTIVATE')
  const [targetCompanyId, setTargetCompanyId] = useState('')
  const [targetDepartmentId, setTargetDepartmentId] = useState('')
  const [targetPositionId, setTargetPositionId] = useState('')

  // 取得可轉移的目標公司
  const { data: transferTargets = [] } = trpc.company.getTransferTargets.useQuery(
    { userId, excludeCompanyId: selectedCompany?.id || '' },
    { enabled: showDeleteDialog && !!selectedCompany }
  )

  // 取得目標公司的部門和職位
  const selectedTargetCompany = transferTargets.find(c => c.id === targetCompanyId)
  const targetDepartments = selectedTargetCompany?.departments || []
  const targetPositions = selectedTargetCompany?.positions || []

  // Form states
  const [formData, setFormData] = useState({
    groupId: '',
    name: '',
    code: '',
    taxId: '',
    address: '',
    phone: '',
    createDefaultDepartments: true,
    createDefaultPositions: true,
    copySettingsFromCompanyId: '',
  })

  const createMutation = trpc.company.create.useMutation({
    onSuccess: () => {
      setShowCreateDialog(false)
      utils.company.listAll.invalidate()
    },
  })

  const updateMutation = trpc.company.update.useMutation({
    onSuccess: () => {
      setShowEditDialog(false)
      utils.company.listAll.invalidate()
    },
  })

  const deactivateMutation = trpc.company.deactivate.useMutation({
    onSuccess: () => {
      setShowDeactivateDialog(false)
      utils.company.listAll.invalidate()
    },
  })

  const deleteMutation = trpc.company.delete.useMutation({
    onSuccess: () => {
      setShowDeleteDialog(false)
      resetDeleteDialogState()
      utils.company.listAll.invalidate()
    },
  })

  const reactivateMutation = trpc.company.reactivate.useMutation({
    onSuccess: () => {
      setShowReactivateDialog(false)
      utils.company.listAll.invalidate()
    },
  })

  // Filter companies
  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGroup = selectedGroupId === 'all' || company.groupId === selectedGroupId
    return matchesSearch && matchesGroup
  })

  const handleCreate = () => {
    setFormData({
      groupId: groups[0]?.id || '',
      name: '',
      code: '',
      taxId: '',
      address: '',
      phone: '',
      createDefaultDepartments: true,
      createDefaultPositions: true,
      copySettingsFromCompanyId: '',
    })
    setShowCreateDialog(true)
  }

  const handleEdit = (company: typeof companies[0]) => {
    setSelectedCompany(company)
    setFormData({
      groupId: company.groupId,
      name: company.name,
      code: company.code,
      taxId: company.taxId || '',
      address: company.address || '',
      phone: company.phone || '',
      createDefaultDepartments: false,
      createDefaultPositions: false,
      copySettingsFromCompanyId: '',
    })
    setShowEditDialog(true)
  }

  const handleDeactivate = (company: typeof companies[0]) => {
    setSelectedCompany(company)
    setShowDeactivateDialog(true)
  }

  const handleDelete = (company: typeof companies[0]) => {
    setSelectedCompany(company)
    setDeleteMode('DEACTIVATE')
    setTargetCompanyId('')
    setTargetDepartmentId('')
    setTargetPositionId('')
    setShowDeleteDialog(true)
  }

  const handleReactivate = (company: typeof companies[0]) => {
    setSelectedCompany(company)
    setShowReactivateDialog(true)
  }

  const resetDeleteDialogState = () => {
    setDeleteMode('DEACTIVATE')
    setTargetCompanyId('')
    setTargetDepartmentId('')
    setTargetPositionId('')
  }

  const submitCreate = () => {
    createMutation.mutate({
      userId,
      groupId: formData.groupId,
      name: formData.name,
      code: formData.code || undefined,
      taxId: formData.taxId || undefined,
      address: formData.address || undefined,
      phone: formData.phone || undefined,
      createDefaultDepartments: formData.createDefaultDepartments,
      createDefaultPositions: formData.createDefaultPositions,
      copySettingsFromCompanyId: formData.copySettingsFromCompanyId || undefined,
    })
  }

  const submitEdit = () => {
    if (!selectedCompany) return
    updateMutation.mutate({
      userId,
      id: selectedCompany.id,
      name: formData.name,
      taxId: formData.taxId || undefined,
      address: formData.address || undefined,
      phone: formData.phone || undefined,
    })
  }

  const submitDeactivate = () => {
    if (!selectedCompany) return
    deactivateMutation.mutate({
      userId,
      id: selectedCompany.id,
    })
  }

  const submitReactivate = () => {
    if (!selectedCompany) return
    reactivateMutation.mutate({
      userId,
      id: selectedCompany.id,
    })
  }

  const submitDelete = () => {
    if (!selectedCompany) return

    deleteMutation.mutate({
      userId,
      companyId: selectedCompany.id,
      mode: deleteMode,
      ...(deleteMode === 'TRANSFER' && {
        targetCompanyId,
        targetDepartmentId,
        targetPositionId,
      }),
    })
  }

  const canSubmitDelete = () => {
    if (!selectedCompany) return false
    if (selectedCompany._count.employees === 0) return true
    if (deleteMode === 'DEACTIVATE') return true
    if (deleteMode === 'TRANSFER') {
      return targetCompanyId && targetDepartmentId && targetPositionId
    }
    return false
  }

  if (isLoadingCompanies || isLoadingGroups) {
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
            <h1 className="text-2xl font-bold">公司管理</h1>
            <p className="text-muted-foreground">管理集團下的所有公司</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新增公司
          </Button>
        )}
      </div>

      {/* 搜尋與篩選 */}
      <div className="flex gap-4">
        <Input
          placeholder="搜尋公司名稱或編號..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="選擇集團" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有集團</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 公司列表 */}
      <Card>
        <CardHeader>
          <CardTitle>公司列表 ({filteredCompanies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>編號</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead>集團</TableHead>
                <TableHead>統編</TableHead>
                <TableHead className="text-center">部門</TableHead>
                <TableHead className="text-center">職位</TableHead>
                <TableHead className="text-center">員工</TableHead>
                <TableHead className="text-center">狀態</TableHead>
                {canManage && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-mono">{company.code}</TableCell>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.group.name}</TableCell>
                  <TableCell>{company.taxId || '-'}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {company._count.departments}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      {company._count.positions}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {company._count.employees}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={company.isActive ? 'default' : 'secondary'}>
                      {company.isActive ? '啟用' : '停用'}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(company)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {company.isActive && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivate(company)}
                              title="停用公司"
                            >
                              <Power className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(company)}
                              title="刪除公司"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {!company.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReactivate(company)}
                            title="重新啟用公司"
                          >
                            <RotateCcw className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filteredCompanies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 9 : 8} className="text-center py-8">
                    <Building className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">沒有符合條件的公司</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 新增公司 Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增公司</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>集團 *</Label>
              <Select
                value={formData.groupId}
                onValueChange={(v) => setFormData({ ...formData, groupId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇集團">
                    {groups.find(g => g.id === formData.groupId)?.name || '選擇集團'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>公司名稱 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="輸入公司名稱"
              />
            </div>
            <div className="space-y-2">
              <Label>公司編號</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="留空自動產生"
              />
            </div>
            <div className="space-y-2">
              <Label>統一編號</Label>
              <Input
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                placeholder="輸入統一編號"
              />
            </div>
            <div className="space-y-2">
              <Label>地址</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="輸入公司地址"
              />
            </div>
            <div className="space-y-2">
              <Label>電話</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="輸入公司電話"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createDepts"
                  checked={formData.createDefaultDepartments}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    setFormData({ ...formData, createDefaultDepartments: checked === true })
                  }
                />
                <label htmlFor="createDepts" className="text-sm">
                  自動建立預設部門 (10 個)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createPositions"
                  checked={formData.createDefaultPositions}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    setFormData({ ...formData, createDefaultPositions: checked === true })
                  }
                />
                <label htmlFor="createPositions" className="text-sm">
                  自動建立預設職位 (13 個)
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>複製設定來源</Label>
              <Select
                value={formData.copySettingsFromCompanyId}
                onValueChange={(v) => setFormData({ ...formData, copySettingsFromCompanyId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇複製來源（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不複製</SelectItem>
                  {companies
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                複製審批流程、費用類別等設定
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button
              onClick={submitCreate}
              disabled={!formData.groupId || !formData.name || createMutation.isPending}
            >
              {createMutation.isPending ? '建立中...' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯公司 Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯公司</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>公司編號</Label>
              <Input value={selectedCompany?.code || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>公司名稱 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>統一編號</Label>
              <Input
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>地址</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>電話</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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

      {/* 停用確認 Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認停用公司？</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要停用「{selectedCompany?.name}」嗎？
              {selectedCompany && selectedCompany._count.employees > 0 && (
                <span className="block mt-2 text-destructive">
                  此公司目前有 {selectedCompany._count.employees} 位在職員工，無法停用。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitDeactivate}
              disabled={
                deactivateMutation.isPending ||
                (selectedCompany !== null && selectedCompany._count.employees > 0)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivateMutation.isPending ? '停用中...' : '確認停用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重新啟用確認 Dialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認重新啟用公司？</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要重新啟用「{selectedCompany?.name}」嗎？
              <span className="block mt-2 text-muted-foreground">
                重新啟用後，此公司將會出現在公司選擇器中，並可指派員工。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitReactivate}
              disabled={reactivateMutation.isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {reactivateMutation.isPending ? '啟用中...' : '確認啟用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除公司 Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open)
        if (!open) resetDeleteDialogState()
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              刪除公司
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive font-medium">
                您確定要刪除「{selectedCompany?.name}」嗎？此操作無法復原。
              </p>
              {selectedCompany && selectedCompany._count.employees > 0 && (
                <p className="text-sm mt-2">
                  此公司目前有 <strong>{selectedCompany._count.employees}</strong> 位在職員工，請選擇如何處理這些員工：
                </p>
              )}
            </div>

            {selectedCompany && selectedCompany._count.employees > 0 && (
              <>
                <div className="space-y-3">
                  <Label>員工處理方式</Label>
                  <RadioGroup
                    value={deleteMode}
                    onValueChange={(value) => {
                      setDeleteMode(value as 'TRANSFER' | 'DEACTIVATE')
                      if (value === 'DEACTIVATE') {
                        setTargetCompanyId('')
                        setTargetDepartmentId('')
                        setTargetPositionId('')
                      }
                    }}
                    className="space-y-2"
                  >
                    <div className="flex items-start space-x-2 p-3 rounded-md border">
                      <RadioGroupItem value="TRANSFER" id="transfer" className="mt-1" />
                      <div>
                        <Label htmlFor="transfer" className="font-medium cursor-pointer">
                          轉移到其他公司
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          將所有員工轉移到指定的公司、部門和職位
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-md border">
                      <RadioGroupItem value="DEACTIVATE" id="deactivate" className="mt-1" />
                      <div>
                        <Label htmlFor="deactivate" className="font-medium cursor-pointer">
                          停用員工帳號
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          結束員工任職並停用帳號（可透過復職功能重新指派）
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {deleteMode === 'TRANSFER' && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-md">
                    <div className="space-y-2">
                      <Label>目標公司 *</Label>
                      <Select
                        value={targetCompanyId}
                        onValueChange={(value) => {
                          setTargetCompanyId(value)
                          setTargetDepartmentId('')
                          setTargetPositionId('')
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選擇目標公司" />
                        </SelectTrigger>
                        <SelectContent>
                          {transferTargets.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name} ({company.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {targetCompanyId && (
                      <div className="space-y-2">
                        <Label>目標部門 *</Label>
                        <Select
                          value={targetDepartmentId}
                          onValueChange={setTargetDepartmentId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="選擇目標部門" />
                          </SelectTrigger>
                          <SelectContent>
                            {targetDepartments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name} ({dept.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {targetCompanyId && (
                      <div className="space-y-2">
                        <Label>目標職位 *</Label>
                        <Select
                          value={targetPositionId}
                          onValueChange={setTargetPositionId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="選擇目標職位" />
                          </SelectTrigger>
                          <SelectContent>
                            {targetPositions.map((pos) => (
                              <SelectItem key={pos.id} value={pos.id}>
                                {pos.name} (等級 {pos.level})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {deleteMode === 'DEACTIVATE' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="inline h-4 w-4 mr-1" />
                      注意：選擇此選項將停用所有員工的帳號。若員工在其他公司有任職，僅會結束在此公司的任職紀錄。
                    </p>
                  </div>
                )}
              </>
            )}

            {selectedCompany && selectedCompany._count.employees === 0 && (
              <p className="text-sm text-muted-foreground">
                此公司沒有在職員工，可直接刪除。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={submitDelete}
              disabled={deleteMutation.isPending || !canSubmitDelete()}
            >
              {deleteMutation.isPending ? '刪除中...' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
