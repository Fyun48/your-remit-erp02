'use client'

import { useState, useEffect } from 'react'
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
import { Building2, Phone, Mail, MapPin, CreditCard, LayoutGrid, List, Pencil, Trash2, Plus, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface VendorDashboardProps {
  companyId: string
  companyName: string
}

type ViewMode = 'card' | 'list'

export function VendorDashboard({ companyId, companyName }: VendorDashboardProps) {
  const utils = trpc.useUtils()
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<typeof vendors[0] | null>(null)
  const [deletingVendor, setDeletingVendor] = useState<typeof vendors[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // tRPC Query for vendors
  const { data: vendors = [], isLoading } = trpc.vendor.list.useQuery({ companyId })

  // Get suggested code for new vendor
  const { data: suggestedCode } = trpc.vendor.getNextCode.useQuery(
    { companyId },
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
      invalidateData()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const updateVendor = trpc.vendor.update.useMutation({
    onSuccess: () => {
      setEditingVendor(null)
      setIsSubmitting(false)
      invalidateData()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const deleteVendor = trpc.vendor.delete.useMutation({
    onSuccess: () => {
      setDeletingVendor(null)
      invalidateData()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('vendorViewMode', mode)
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addFormData.name) {
      alert('Please fill in vendor name')
      return
    }
    setIsSubmitting(true)
    createVendor.mutate({
      companyId,
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
      alert('Please fill in vendor name')
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendor Management</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Vendor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-code">Vendor Code</Label>
                  <Input
                    id="add-code"
                    value={addFormData.code}
                    onChange={(e) => setAddFormData({ ...addFormData, code: e.target.value })}
                    placeholder={suggestedCode || 'V001'}
                  />
                  <p className="text-xs text-muted-foreground">Auto-generated if empty</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-name">Vendor Name *</Label>
                  <Input
                    id="add-name"
                    value={addFormData.name}
                    onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                    placeholder="Company Name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-taxId">Tax ID</Label>
                <Input
                  id="add-taxId"
                  value={addFormData.taxId}
                  onChange={(e) => setAddFormData({ ...addFormData, taxId: e.target.value })}
                  placeholder="12345678"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-contactName">Contact Name</Label>
                  <Input
                    id="add-contactName"
                    value={addFormData.contactName}
                    onChange={(e) => setAddFormData({ ...addFormData, contactName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-contactPhone">Phone</Label>
                  <Input
                    id="add-contactPhone"
                    value={addFormData.contactPhone}
                    onChange={(e) => setAddFormData({ ...addFormData, contactPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-contactEmail">Email</Label>
                <Input
                  id="add-contactEmail"
                  type="email"
                  value={addFormData.contactEmail}
                  onChange={(e) => setAddFormData({ ...addFormData, contactEmail: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-address">Address</Label>
                <Input
                  id="add-address"
                  value={addFormData.address}
                  onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-paymentTerms">Payment Terms (Days)</Label>
                <Input
                  id="add-paymentTerms"
                  type="number"
                  value={addFormData.paymentTerms}
                  onChange={(e) => setAddFormData({ ...addFormData, paymentTerms: parseInt(e.target.value) || 30 })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-bankName">Bank Name</Label>
                  <Input
                    id="add-bankName"
                    value={addFormData.bankName}
                    onChange={(e) => setAddFormData({ ...addFormData, bankName: e.target.value })}
                    placeholder="XX Bank"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-bankAccount">Bank Account</Label>
                  <Input
                    id="add-bankAccount"
                    value={addFormData.bankAccount}
                    onChange={(e) => setAddFormData({ ...addFormData, bankAccount: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No vendor data yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Vendor data is used for accounts payable management
              </p>
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
              Card
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewModeChange('list')}
            >
              <List className="h-4 w-4 mr-1" />
              List
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
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {vendor.taxId && (
                      <p className="text-muted-foreground">Tax ID: {vendor.taxId}</p>
                    )}
                    {vendor.contactName && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
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
                        <span>Payment: {vendor.paymentTerms} days</span>
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
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Tax ID</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
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
                      <TableCell className="text-right">{vendor.paymentTerms} days</TableCell>
                      <TableCell>
                        {vendor.bankName ? `${vendor.bankName} ${vendor.bankAccount || ''}` : '-'}
                      </TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingVendor} onOpenChange={(open) => !open && setEditingVendor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Vendor - {editingVendor?.code}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Vendor Name *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-taxId">Tax ID</Label>
              <Input
                id="edit-taxId"
                value={editFormData.taxId}
                onChange={(e) => setEditFormData({ ...editFormData, taxId: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-contactName">Contact Name</Label>
                <Input
                  id="edit-contactName"
                  value={editFormData.contactName}
                  onChange={(e) => setEditFormData({ ...editFormData, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contactPhone">Phone</Label>
                <Input
                  id="edit-contactPhone"
                  value={editFormData.contactPhone}
                  onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contactEmail">Email</Label>
              <Input
                id="edit-contactEmail"
                type="email"
                value={editFormData.contactEmail}
                onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-paymentTerms">Payment Terms (Days)</Label>
              <Input
                id="edit-paymentTerms"
                type="number"
                value={editFormData.paymentTerms}
                onChange={(e) => setEditFormData({ ...editFormData, paymentTerms: parseInt(e.target.value) || 30 })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bankName">Bank Name</Label>
                <Input
                  id="edit-bankName"
                  value={editFormData.bankName}
                  onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bankAccount">Bank Account</Label>
                <Input
                  id="edit-bankAccount"
                  value={editFormData.bankAccount}
                  onChange={(e) => setEditFormData({ ...editFormData, bankAccount: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingVendor(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingVendor} onOpenChange={(open) => !open && setDeletingVendor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete vendor "{deletingVendor?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
