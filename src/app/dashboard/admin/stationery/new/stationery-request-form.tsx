'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CompanySelect } from '@/components/ui/company-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Package, Save, Send, Minus, Plus } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface Company {
  id: string
  name: string
}

interface StationeryItem {
  id: string
  companyId: string
  code: string
  name: string
  unit: string
  unitPrice: number
  stock: number
  alertLevel: number
  isActive: boolean
}

interface StationeryRequestFormProps {
  applicantId: string
  applicantName: string
  companies: Company[]
  itemsByCompany: Record<string, StationeryItem[]>
}

interface SelectedItem {
  itemId: string
  itemCode: string
  itemName: string
  unit: string
  quantity: number
  unitPrice: number
  subtotal: number
  stock: number
}

export function StationeryRequestForm({
  applicantId,
  applicantName,
  companies,
  itemsByCompany,
}: StationeryRequestFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [companyId, setCompanyId] = useState(companies.length === 1 ? companies[0].id : '')
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [purpose, setPurpose] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const availableItems = useMemo(() => {
    return companyId ? itemsByCompany[companyId] || [] : []
  }, [companyId, itemsByCompany])

  const totalAmount = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.subtotal, 0)
  }, [selectedItems])

  const create = trpc.stationery.requestCreate.useMutation({
    onSuccess: (data) => {
      router.push(`/dashboard/admin/stationery/${data.id}`)
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const submit = trpc.stationery.requestSubmit.useMutation({
    onSuccess: () => {
      router.push('/dashboard/admin/stationery')
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const handleCompanyChange = (newCompanyId: string) => {
    setCompanyId(newCompanyId)
    setSelectedItems([]) // 清空已選品項
  }

  const updateItemQuantity = (item: StationeryItem, delta: number) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.itemId === item.id)

      if (existing) {
        const newQuantity = existing.quantity + delta
        if (newQuantity <= 0) {
          // 移除品項
          return prev.filter((i) => i.itemId !== item.id)
        }
        // 更新數量
        return prev.map((i) =>
          i.itemId === item.id
            ? { ...i, quantity: newQuantity, subtotal: newQuantity * i.unitPrice }
            : i
        )
      } else if (delta > 0) {
        // 新增品項
        return [
          ...prev,
          {
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            unit: item.unit,
            quantity: delta,
            unitPrice: item.unitPrice,
            subtotal: delta * item.unitPrice,
            stock: item.stock,
          },
        ]
      }

      return prev
    })
  }

  const getSelectedQuantity = (itemId: string) => {
    return selectedItems.find((i) => i.itemId === itemId)?.quantity || 0
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!companyId) {
      newErrors.companyId = '請選擇公司'
    }
    if (selectedItems.length === 0) {
      newErrors.items = '請選擇至少一項文具'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    create.mutate({
      companyId,
      applicantId,
      items: selectedItems.map((item) => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      purpose: purpose || undefined,
    })
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    create.mutate(
      {
        companyId,
        applicantId,
        items: selectedItems.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
        purpose: purpose || undefined,
      },
      {
        onSuccess: (data) => {
          submit.mutate({ id: data.id })
        },
      }
    )
  }

  const selectedCompany = companies.find((c) => c.id === companyId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/stationery">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新增文具申請</h1>
          <p className="text-muted-foreground">選擇需要的文具品項</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 表單區域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 選擇公司 */}
          <Card>
            <CardHeader>
              <CardTitle>選擇公司</CardTitle>
              <CardDescription>選擇要向哪家公司申請文具</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>公司 *</Label>
                <CompanySelect
                  companies={companies}
                  value={companyId}
                  onValueChange={handleCompanyChange}
                  className={errors.companyId ? 'border-red-500' : ''}
                />
                {errors.companyId && (
                  <p className="text-sm text-red-500">{errors.companyId}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 文具選擇 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                選擇文具
              </CardTitle>
              <CardDescription>選擇需要的品項和數量</CardDescription>
            </CardHeader>
            <CardContent>
              {!companyId ? (
                <p className="text-center text-muted-foreground py-8">
                  請先選擇公司
                </p>
              ) : availableItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  此公司尚無文具品項
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>代碼</TableHead>
                        <TableHead>名稱</TableHead>
                        <TableHead>單價</TableHead>
                        <TableHead>庫存</TableHead>
                        <TableHead className="text-center">數量</TableHead>
                        <TableHead className="text-right">小計</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableItems.map((item) => {
                        const quantity = getSelectedQuantity(item.id)
                        const subtotal = quantity * item.unitPrice
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.code}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>${item.unitPrice}</TableCell>
                            <TableCell>
                              <span className={item.stock <= item.alertLevel ? 'text-red-600' : ''}>
                                {item.stock} {item.unit}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8"
                                  onClick={() => updateItemQuantity(item, -1)}
                                  disabled={quantity === 0}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center font-medium">
                                  {quantity}
                                </span>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8"
                                  onClick={() => updateItemQuantity(item, 1)}
                                  disabled={quantity >= item.stock}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {subtotal > 0 ? `$${subtotal.toLocaleString()}` : '-'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  {errors.items && (
                    <p className="text-sm text-red-500 mt-2">{errors.items}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* 用途說明 */}
          <Card>
            <CardHeader>
              <CardTitle>用途說明</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="說明文具用途（選填）"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={2}
              />
            </CardContent>
          </Card>
        </div>

        {/* 側邊欄 */}
        <div className="space-y-6">
          {/* 申請摘要 */}
          <Card>
            <CardHeader>
              <CardTitle>申請摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">申請人</span>
                <span className="font-medium">{applicantName}</span>
              </div>
              {selectedCompany && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">申請公司</span>
                  <span>{selectedCompany.name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">品項數</span>
                <span>{selectedItems.length} 項</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">總數量</span>
                <span>
                  {selectedItems.reduce((sum, item) => sum + item.quantity, 0)} 件
                </span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span className="font-medium">總金額</span>
                  <span className="text-xl font-bold text-primary">
                    ${totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 已選品項明細 */}
          {selectedItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>已選品項</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <div
                      key={item.itemId}
                      className="flex justify-between text-sm py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium">{item.itemName}</p>
                        <p className="text-muted-foreground">
                          ${item.unitPrice} x {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${item.subtotal.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 操作按鈕 */}
          <Card>
            <CardHeader>
              <CardTitle>操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isSubmitting || selectedItems.length === 0}
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? '處理中...' : '提交審批'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSave}
                disabled={isSubmitting || selectedItems.length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                儲存草稿
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
