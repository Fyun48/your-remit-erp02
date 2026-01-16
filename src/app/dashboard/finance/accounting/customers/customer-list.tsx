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
import { Users, Phone, Mail, MapPin, LayoutGrid, List, Pencil, Trash2, Plus, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface CustomerDashboardProps {
  companyId: string
  companyName: string
}

type ViewMode = 'card' | 'list'

export function CustomerDashboard({ companyId, companyName }: CustomerDashboardProps) {
  const utils = trpc.useUtils()
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<typeof customers[0] | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<typeof customers[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // tRPC Query for customers
  const { data: customersData = [], isLoading } = trpc.customer.list.useQuery({ companyId })
  const customers = customersData.map((c) => ({
    ...c,
    creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
  }))

  // Get suggested code for new customer
  const { data: suggestedCode } = trpc.customer.getNextCode.useQuery(
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
    creditLimit: '',
  })

  const [editFormData, setEditFormData] = useState({
    name: '',
    taxId: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    paymentTerms: 30,
    creditLimit: '',
  })

  useEffect(() => {
    const saved = localStorage.getItem('customerViewMode') as ViewMode | null
    if (saved) setViewMode(saved)
  }, [])

  useEffect(() => {
    if (editingCustomer) {
      setEditFormData({
        name: editingCustomer.name,
        taxId: editingCustomer.taxId || '',
        contactName: editingCustomer.contactName || '',
        contactPhone: editingCustomer.contactPhone || '',
        contactEmail: editingCustomer.contactEmail || '',
        address: editingCustomer.address || '',
        paymentTerms: editingCustomer.paymentTerms,
        creditLimit: editingCustomer.creditLimit?.toString() || '',
      })
    }
  }, [editingCustomer])

  const invalidateData = () => {
    utils.customer.list.invalidate()
    utils.customer.getNextCode.invalidate()
  }

  const createCustomer = trpc.customer.create.useMutation({
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
        creditLimit: '',
      })
      setIsSubmitting(false)
      invalidateData()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const updateCustomer = trpc.customer.update.useMutation({
    onSuccess: () => {
      setEditingCustomer(null)
      setIsSubmitting(false)
      invalidateData()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const deleteCustomer = trpc.customer.delete.useMutation({
    onSuccess: () => {
      setDeletingCustomer(null)
      invalidateData()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('customerViewMode', mode)
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addFormData.name) {
      alert('Please fill in customer name')
      return
    }
    setIsSubmitting(true)
    createCustomer.mutate({
      companyId,
      code: addFormData.code || undefined,
      name: addFormData.name,
      taxId: addFormData.taxId || undefined,
      contactName: addFormData.contactName || undefined,
      contactPhone: addFormData.contactPhone || undefined,
      contactEmail: addFormData.contactEmail || undefined,
      address: addFormData.address || undefined,
      paymentTerms: addFormData.paymentTerms,
      creditLimit: addFormData.creditLimit ? parseFloat(addFormData.creditLimit) : undefined,
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCustomer || !editFormData.name) {
      alert('Please fill in customer name')
      return
    }
    setIsSubmitting(true)
    updateCustomer.mutate({
      id: editingCustomer.id,
      name: editFormData.name,
      taxId: editFormData.taxId || undefined,
      contactName: editFormData.contactName || undefined,
      contactPhone: editFormData.contactPhone || undefined,
      contactEmail: editFormData.contactEmail || undefined,
      address: editFormData.address || undefined,
      paymentTerms: editFormData.paymentTerms,
      creditLimit: editFormData.creditLimit ? parseFloat(editFormData.creditLimit) : undefined,
    })
  }

  const handleDelete = () => {
    if (deletingCustomer) {
      deleteCustomer.mutate({ id: deletingCustomer.id })
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
          <h1 className="text-2xl font-bold">Customer Management</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-code">Customer Code</Label>
                  <Input
                    id="add-code"
                    value={addFormData.code}
                    onChange={(e) => setAddFormData({ ...addFormData, code: e.target.value })}
                    placeholder={suggestedCode || 'C001'}
                  />
                  <p className="text-xs text-muted-foreground">Auto-generated if empty</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-name">Customer Name *</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-paymentTerms">Payment Terms (Days)</Label>
                  <Input
                    id="add-paymentTerms"
                    type="number"
                    value={addFormData.paymentTerms}
                    onChange={(e) => setAddFormData({ ...addFormData, paymentTerms: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-creditLimit">Credit Limit</Label>
                  <Input
                    id="add-creditLimit"
                    type="number"
                    value={addFormData.creditLimit}
                    onChange={(e) => setAddFormData({ ...addFormData, creditLimit: e.target.value })}
                    placeholder="0"
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

      {customers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No customer data yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Customer data is used for accounts receivable management
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
              {customers.map((customer) => (
                <Card key={customer.id} className="hover:bg-accent/50 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted-foreground">{customer.code}</span>
                        {customer.name}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingCustomer(customer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingCustomer(customer)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {customer.taxId && (
                      <p className="text-muted-foreground">Tax ID: {customer.taxId}</p>
                    )}
                    {customer.contactName && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.contactName}</span>
                      </div>
                    )}
                    {customer.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.contactPhone}</span>
                      </div>
                    )}
                    {customer.contactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.contactEmail}</span>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{customer.address}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t flex justify-between text-muted-foreground">
                      <span>Payment: {customer.paymentTerms} days</span>
                      {customer.creditLimit && (
                        <span>Limit: ${customer.creditLimit.toLocaleString()}</span>
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
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-mono">{customer.code}</TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.taxId || '-'}</TableCell>
                      <TableCell>{customer.contactName || '-'}</TableCell>
                      <TableCell>{customer.contactPhone || '-'}</TableCell>
                      <TableCell>{customer.contactEmail || '-'}</TableCell>
                      <TableCell className="text-right">{customer.paymentTerms} days</TableCell>
                      <TableCell className="text-right">
                        {customer.creditLimit ? `$${customer.creditLimit.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingCustomer(customer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingCustomer(customer)}
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
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer - {editingCustomer?.code}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Customer Name *</Label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-paymentTerms">Payment Terms (Days)</Label>
                <Input
                  id="edit-paymentTerms"
                  type="number"
                  value={editFormData.paymentTerms}
                  onChange={(e) => setEditFormData({ ...editFormData, paymentTerms: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-creditLimit">Credit Limit</Label>
                <Input
                  id="edit-creditLimit"
                  type="number"
                  value={editFormData.creditLimit}
                  onChange={(e) => setEditFormData({ ...editFormData, creditLimit: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingCustomer(null)}>
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
      <AlertDialog open={!!deletingCustomer} onOpenChange={(open) => !open && setDeletingCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete customer &quot;{deletingCustomer?.name}&quot;? This action cannot be undone.
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
