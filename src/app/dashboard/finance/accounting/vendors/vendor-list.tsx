'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  ArrowLeft,
  Users,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'

interface Company {
  companyId: string
  company: {
    id: string
    name: string
  }
}

interface VendorDashboardProps {
  assignments: Company[]
  initialCompanyId: string
  hasPermission: boolean
}

type ViewMode = 'card' | 'list'

export function VendorDashboard({ assignments, initialCompanyId, hasPermission }: VendorDashboardProps) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<typeof vendors[0] | null>(null)
  const [deletingVendor, setDeletingVendor] = useState<typeof vendors[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedCompany = assignments.find(a => a.companyId === selectedCompanyId)

  const handleCompanyChange = async (companyId: string) => {
    // 更新全域公司選擇 cookie
    try {
      const response = await fetch('/api/company/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
        credentials: 'include',
      })
      if (response.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error('切換公司失敗', error)
    }
  }

  // tRPC Query for vendors
  const { data: vendors = [], isLoading } = trpc.vendor.list.useQuery(
    { companyId: selectedCompanyId },
    { enabled: !!selectedCompanyId }
  )

  // Get suggested code for new vendor
  const { data: suggestedCode } = trpc.vendor.getNextCode.useQuery(
    { companyId: selectedCompanyId },
    { enabled: addDialogOpen }
  )

  const [addFormData, setAddFormData] = useState({
    code: '',
    name: '',
    taxId: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    paymentTerms: 30,
    bankName: '',
    bankAccount: '',
  })

  const [editFormData, setEditFormData] = useState({
    name: '',
    taxId: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    paymentTerms: 30,
    bankName: '',
    bankAccount: '',
  })

  useEffect(() => {
    const saved = localStorage.getItem('vendorViewMode') as ViewMode | null
    if (saved) setViewMode(saved)
  }, [])

  useEffect(() => {
    if (editingVendor) {
      setEditFormData({
        name: editingVendor.name,
        taxId: editingVendor.taxId || '',
        contactName: editingVendor.contactName || '',
        contactPhone: editingVendor.contactPhone || '',
        contactEmail: editingVendor.contactEmail || '',
        address: editingVendor.address || '',
        paymentTerms: editingVendor.paymentTerms,
        bankName: editingVendor.bankName || '',
        bankAccount: editingVendor.bankAccount || '',
      })
    }
  }, [editingVendor])

  const invalidateData = () => {
    utils.vendor.list.invalidate()
    utils.vendor.getNextCode.invalidate()
  }

  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: () => {
      setAddDialogOpen(false)
      setAddFormData({
        code: '',
        name: '',
        taxId: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        address: '',
        paymentTerms: 30,
        bankName: '',
        bankAccount: '',
      })
      setIsSubmitting(false)
      toast.success('供應商已新增')
      invalidateData()
    },
    onError: (error) => {
      toast.error(error.message)
      setIsSubmitting(false)
    },
  })

  const updateVendor = trpc.vendor.update.useMutation({
    onSuccess: () => {
      setEditingVendor(null)
      setIsSubmitting(false)
      toast.success('供應商已更新')
      invalidateData()
    },
    onError: (error) => {
      toast.error(error.message)
      setIsSubmitting(false)
    },
  })

  const deleteVendor = trpc.vendor.delete.useMutation({
    onSuccess: () => {
      setDeletingVendor(null)
      toast.success('供應商已刪除')
      invalidateData()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('vendorViewMode', mode)
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addFormData.name) {
      toast.error('請填寫供應商名稱')
      return
    }
    setIsSubmitting(true)
    createVendor.mutate({
      companyId: selectedCompanyId,
      code: addFormData.code || undefined,
      name: addFormData.name,
      taxId: addFormData.taxId || undefined,
      contactName: addFormData.contactName || undefined,
      contactPhone: addFormData.contactPhone || undefined,
      contactEmail: addFormData.contactEmail || undefined,
      address: addFormData.address || undefined,
      paymentTerms: addFormData.paymentTerms,
      bankName: addFormData.bankName || undefined,
      bankAccount: addFormData.bankAccount || undefined,
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVendor || !editFormData.name) {
      toast.error('請填寫供應商名稱')
      return
    }
    setIsSubmitting(true)
    updateVendor.mutate({
      id: editingVendor.id,
      name: editFormData.name,
      taxId: editFormData.taxId || undefined,
      contactName: editFormData.contactName || undefined,
      contactPhone: editFormData.contactPhone || undefined,
      contactEmail: editFormData.contactEmail || undefined,
      address: editFormData.address || undefined,
      paymentTerms: editFormData.paymentTerms,
      bankName: editFormData.bankName || undefined,
      bankAccount: editFormData.bankAccount || undefined,
    })
  }

  const handleDelete = () => {
    if (deletingVendor) {
      deleteVendor.mutate({ id: deletingVendor.id })
    }
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
      {/* 頂部導航欄 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/finance/accounting')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">供應商管理</h1>
            <p className="text-muted-foreground">{selectedCompany?.company.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 公司選擇器 */}
          {assignments.length > 1 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="選擇公司" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((a) => (
                    <SelectItem key={a.companyId} value={a.companyId}>
                      {a.company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {hasPermission && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新增供應商
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>新增供應商</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-code">供應商代碼</Label>
                      <Input
                        id="add-code"
                        value={addFormData.code}
                        onChange={(e) => setAddFormData({ ...addFormData, code: e.target.value })}
                        placeholder={suggestedCode || 'V001'}
                      />
                      <p className="text-xs text-muted-foreground">留空自動產生</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-name">供應商名稱 *</Label>
                      <Input
                        id="add-name"
                        value={addFormData.name}
                        onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                        placeholder="公司名稱"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-taxId">統一編號</Label>
                    <Input
                      id="add-taxId"
                      value={addFormData.taxId}
                      onChange={(e) => setAddFormData({ ...addFormData, taxId: e.target.value })}
                      placeholder="12345678"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-contactName">聯絡人</Label>
                      <Input
                        id="add-contactName"
                        value={addFormData.contactName}
                        onChange={(e) => setAddFormData({ ...addFormData, contactName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-contactPhone">電話</Label>
                      <Input
                        id="add-contactPhone"
                        value={addFormData.contactPhone}
                        onChange={(e) => setAddFormData({ ...addFormData, contactPhone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-contactEmail">電子郵件</Label>
                    <Input
                      id="add-contactEmail"
                      type="email"
                      value={addFormData.contactEmail}
                      onChange={(e) => setAddFormData({ ...addFormData, contactEmail: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-address">地址</Label>
                    <Input
                      id="add-address"
                      value={addFormData.address}
                      onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-paymentTerms">付款天數</Label>
                    <Input
                      id="add-paymentTerms"
                      type="number"
                      value={addFormData.paymentTerms}
                      onChange={(e) => setAddFormData({ ...addFormData, paymentTerms: parseInt(e.target.value) || 30 })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-bankName">銀行名稱</Label>
                      <Input
                        id="add-bankName"
                        value={addFormData.bankName}
                        onChange={(e) => setAddFormData({ ...addFormData, bankName: e.target.value })}
                        placeholder="XX銀行"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-bankAccount">銀行帳號</Label>
                      <Input
                        id="add-bankAccount"
                        value={addFormData.bankAccount}
                        onChange={(e) => setAddFormData({ ...addFormData, bankAccount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                      取消
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? '儲存中...' : '儲存'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚無供應商資料</p>
              {hasPermission && (
                <p className="text-sm text-muted-foreground mt-2">
                  供應商資料用於應付帳款管理
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant={viewMode === 'card' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewModeChange('card')}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              卡片
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewModeChange('list')}
            >
              <List className="h-4 w-4 mr-1" />
              列表
            </Button>
          </div>

          {viewMode === 'card' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vendors.map((vendor) => (
                <Card key={vendor.id} className="hover:bg-accent/50 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted-foreground">{vendor.code}</span>
                        {vendor.name}
                      </div>
                      {hasPermission && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingVendor(vendor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingVendor(vendor)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {vendor.taxId && (
                      <p className="text-muted-foreground">統編: {vendor.taxId}</p>
                    )}
                    {vendor.contactName && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{vendor.contactName}</span>
                      </div>
                    )}
                    {vendor.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{vendor.contactPhone}</span>
                      </div>
                    )}
                    {vendor.contactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{vendor.contactEmail}</span>
                      </div>
                    )}
                    {vendor.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{vendor.address}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t space-y-1 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>付款: {vendor.paymentTerms} 天</span>
                      </div>
                      {vendor.bankName && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          <span>{vendor.bankName} {vendor.bankAccount}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">代碼</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>統編</TableHead>
                    <TableHead>聯絡人</TableHead>
                    <TableHead>電話</TableHead>
                    <TableHead>電子郵件</TableHead>
                    <TableHead className="text-right">付款天數</TableHead>
                    <TableHead>銀行帳號</TableHead>
                    {hasPermission && <TableHead className="w-24">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-mono">{vendor.code}</TableCell>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell>{vendor.taxId || '-'}</TableCell>
                      <TableCell>{vendor.contactName || '-'}</TableCell>
                      <TableCell>{vendor.contactPhone || '-'}</TableCell>
                      <TableCell>{vendor.contactEmail || '-'}</TableCell>
                      <TableCell className="text-right">{vendor.paymentTerms} 天</TableCell>
                      <TableCell>
                        {vendor.bankName ? `${vendor.bankName} ${vendor.bankAccount || ''}` : '-'}
                      </TableCell>
                      {hasPermission && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingVendor(vendor)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingVendor(vendor)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* 編輯對話框 */}
      <Dialog open={!!editingVendor} onOpenChange={(open) => !open && setEditingVendor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯供應商 - {editingVendor?.code}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">供應商名稱 *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-taxId">統一編號</Label>
              <Input
                id="edit-taxId"
                value={editFormData.taxId}
                onChange={(e) => setEditFormData({ ...editFormData, taxId: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-contactName">聯絡人</Label>
                <Input
                  id="edit-contactName"
                  value={editFormData.contactName}
                  onChange={(e) => setEditFormData({ ...editFormData, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contactPhone">電話</Label>
                <Input
                  id="edit-contactPhone"
                  value={editFormData.contactPhone}
                  onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contactEmail">電子郵件</Label>
              <Input
                id="edit-contactEmail"
                type="email"
                value={editFormData.contactEmail}
                onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">地址</Label>
              <Input
                id="edit-address"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-paymentTerms">付款天數</Label>
              <Input
                id="edit-paymentTerms"
                type="number"
                value={editFormData.paymentTerms}
                onChange={(e) => setEditFormData({ ...editFormData, paymentTerms: parseInt(e.target.value) || 30 })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bankName">銀行名稱</Label>
                <Input
                  id="edit-bankName"
                  value={editFormData.bankName}
                  onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bankAccount">銀行帳號</Label>
                <Input
                  id="edit-bankAccount"
                  value={editFormData.bankAccount}
                  onChange={(e) => setEditFormData({ ...editFormData, bankAccount: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingVendor(null)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deletingVendor} onOpenChange={(open) => !open && setDeletingVendor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此供應商？</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除供應商「{deletingVendor?.name}」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
