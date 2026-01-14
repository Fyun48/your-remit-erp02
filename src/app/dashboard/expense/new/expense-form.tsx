'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trpc } from '@/lib/trpc'
import { Receipt, Plus, Trash2, ArrowLeft, Save, Send } from 'lucide-react'

interface ExpenseItem {
  id: string
  categoryId: string
  date: string
  description: string
  amount: string
  vendorName: string
  receiptNo: string
}

interface ExpenseFormProps {
  employeeId: string
  companyId: string
  companyName: string
}

function generateTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function ExpenseForm({ employeeId, companyId, companyName }: ExpenseFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 表單資料
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    periodStart: '',
    periodEnd: '',
  })

  // 費用明細列表
  const [items, setItems] = useState<ExpenseItem[]>([
    {
      id: generateTempId(),
      categoryId: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      vendorName: '',
      receiptNo: '',
    },
  ])

  // 取得費用類別
  const { data: categories, isLoading: isCategoriesLoading } = trpc.expenseCategory.list.useQuery({ companyId })

  // tRPC mutations
  const createMutation = trpc.expenseRequest.create.useMutation()
  const submitMutation = trpc.expenseRequest.submit.useMutation()

  // 計算總金額
  const totalAmount = items.reduce((sum, item) => {
    const amount = parseFloat(item.amount) || 0
    return sum + amount
  }, 0)

  // 新增明細項目
  const addItem = () => {
    setItems([
      ...items,
      {
        id: generateTempId(),
        categoryId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        vendorName: '',
        receiptNo: '',
      },
    ])
  }

  // 移除明細項目
  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  // 更新明細項目
  const updateItem = (id: string, field: keyof ExpenseItem, value: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // 驗證表單
  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError('請填寫報銷標題')
      return false
    }
    if (!formData.periodStart || !formData.periodEnd) {
      setError('請選擇報銷期間')
      return false
    }
    if (new Date(formData.periodStart) > new Date(formData.periodEnd)) {
      setError('報銷結束日期不可早於開始日期')
      return false
    }
    for (const item of items) {
      if (!item.categoryId) {
        setError('請選擇所有明細的費用類別')
        return false
      }
      if (!item.date) {
        setError('請選擇所有明細的消費日期')
        return false
      }
      if (!item.description.trim()) {
        setError('請填寫所有明細的費用說明')
        return false
      }
      const amount = parseFloat(item.amount)
      if (isNaN(amount) || amount <= 0) {
        setError('請填寫有效的金額')
        return false
      }
    }
    setError(null)
    return true
  }

  // 儲存草稿
  const handleSaveDraft = async () => {
    if (!validateForm()) return

    setIsLoading(true)
    setError(null)

    try {
      await createMutation.mutateAsync({
        employeeId,
        companyId,
        title: formData.title,
        description: formData.description || undefined,
        periodStart: new Date(formData.periodStart),
        periodEnd: new Date(formData.periodEnd),
        items: items.map(item => ({
          categoryId: item.categoryId,
          date: new Date(item.date),
          description: item.description,
          amount: parseFloat(item.amount),
          vendorName: item.vendorName || undefined,
          receiptNo: item.receiptNo || undefined,
        })),
      })

      router.push('/dashboard/expense')
    } catch (err) {
      console.error('Save draft error:', err)
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setIsLoading(false)
    }
  }

  // 送出審核
  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsLoading(true)
    setError(null)

    try {
      // 先建立申請單
      const request = await createMutation.mutateAsync({
        employeeId,
        companyId,
        title: formData.title,
        description: formData.description || undefined,
        periodStart: new Date(formData.periodStart),
        periodEnd: new Date(formData.periodEnd),
        items: items.map(item => ({
          categoryId: item.categoryId,
          date: new Date(item.date),
          description: item.description,
          amount: parseFloat(item.amount),
          vendorName: item.vendorName || undefined,
          receiptNo: item.receiptNo || undefined,
        })),
      })

      // 送出審核
      await submitMutation.mutateAsync({ id: request.id })

      router.push('/dashboard/expense')
    } catch (err) {
      console.error('Submit error:', err)
      setError(err instanceof Error ? err.message : '送出失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/expense">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新增費用報銷</h1>
          <p className="text-sm text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* 基本資訊 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            報銷資訊
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">報銷標題 *</Label>
            <Input
              id="title"
              placeholder="例：2024年1月差旅費報銷"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">說明</Label>
            <textarea
              id="description"
              className="w-full border rounded-md p-2 min-h-[80px]"
              placeholder="報銷說明（選填）"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodStart">報銷起始日 *</Label>
              <Input
                id="periodStart"
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">報銷結束日 *</Label>
              <Input
                id="periodEnd"
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 費用明細 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>費用明細</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              新增明細
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  明細 #{index + 1}
                </span>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    className="h-8 w-8 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>費用類別 *</Label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={item.categoryId}
                    onChange={(e) => updateItem(item.id, 'categoryId', e.target.value)}
                    disabled={isCategoriesLoading}
                    required
                  >
                    {isCategoriesLoading ? (
                      <option value="">載入中...</option>
                    ) : (
                      <>
                        <option value="">請選擇類別</option>
                        {categories?.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>消費日期 *</Label>
                  <Input
                    type="date"
                    value={item.date}
                    onChange={(e) => updateItem(item.id, 'date', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>費用說明 *</Label>
                <Input
                  placeholder="例：台北-高雄高鐵來回票"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>金額 (TWD) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={item.amount}
                    onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>廠商名稱</Label>
                  <Input
                    placeholder="選填"
                    value={item.vendorName}
                    onChange={(e) => updateItem(item.id, 'vendorName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>發票號碼</Label>
                  <Input
                    placeholder="選填"
                    value={item.receiptNo}
                    onChange={(e) => updateItem(item.id, 'receiptNo', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* 總金額 */}
          <div className="flex justify-end items-center gap-4 pt-4 border-t">
            <span className="text-lg font-medium">總金額：</span>
            <span className="text-2xl font-bold text-primary">
              ${totalAmount.toLocaleString()} TWD
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 操作按鈕 */}
      <div className="flex justify-end gap-4">
        <Link href="/dashboard/expense">
          <Button variant="outline" disabled={isLoading}>
            取消
          </Button>
        </Link>
        <Button
          variant="secondary"
          onClick={handleSaveDraft}
          disabled={isLoading}
        >
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? '處理中...' : '儲存草稿'}
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          <Send className="h-4 w-4 mr-2" />
          {isLoading ? '處理中...' : '送出審核'}
        </Button>
      </div>
    </div>
  )
}
