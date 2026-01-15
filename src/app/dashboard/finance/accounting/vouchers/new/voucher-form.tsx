'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AccountSelect } from '@/components/ui/account-select'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'

interface VoucherLine {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  debitAmount: number
  creditAmount: number
  description: string
}

// 傳票類型中文對應
const voucherTypeLabels: Record<string, string> = {
  RECEIPT: '收款傳票',
  PAYMENT: '付款傳票',
  TRANSFER: '轉帳傳票',
}

interface VoucherFormProps {
  companyId: string
  companyName: string
  employeeId: string
}

export function VoucherForm({ companyId, companyName, employeeId }: VoucherFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createVoucher = trpc.voucher.create.useMutation({
    onSuccess: () => {
      router.push('/dashboard/finance/accounting/vouchers')
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })
  const [voucherType, setVoucherType] = useState<string>('')
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<VoucherLine[]>([
    { id: '1', accountId: '', accountCode: '', accountName: '', debitAmount: 0, creditAmount: 0, description: '' },
    { id: '2', accountId: '', accountCode: '', accountName: '', debitAmount: 0, creditAmount: 0, description: '' },
  ])

  const totalDebit = lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0)
  const totalCredit = lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Date.now().toString(),
        accountId: '',
        accountCode: '',
        accountName: '',
        debitAmount: 0,
        creditAmount: 0,
        description: '',
      },
    ])
  }

  const removeLine = (id: string) => {
    if (lines.length > 2) {
      setLines(lines.filter((line) => line.id !== id))
    }
  }

  const updateLine = (id: string, field: keyof VoucherLine, value: string | number) => {
    setLines(
      lines.map((line) =>
        line.id === id ? { ...line, [field]: value } : line
      )
    )
  }

  const updateLineAccount = (
    id: string,
    accountId: string,
    accountCode: string,
    accountName: string
  ) => {
    setLines(
      lines.map((line) =>
        line.id === id
          ? { ...line, accountId, accountCode, accountName }
          : line
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!voucherType || !voucherDate) {
      alert('請填寫傳票類型和日期')
      return
    }

    if (!isBalanced) {
      alert('借貸金額不平衡，請檢查分錄')
      return
    }

    const validLines = lines.filter(
      (line) => line.accountId && (line.debitAmount > 0 || line.creditAmount > 0)
    )

    if (validLines.length < 2) {
      alert('至少需要兩筆有效的分錄')
      return
    }

    setIsSubmitting(true)

    createVoucher.mutate({
      companyId,
      voucherDate: new Date(voucherDate),
      voucherType: voucherType as 'RECEIPT' | 'PAYMENT' | 'TRANSFER',
      description: description || undefined,
      createdById: employeeId,
      lines: validLines.map((line) => ({
        accountId: line.accountId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description || undefined,
      })),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/finance/accounting/vouchers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新增傳票</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* 傳票基本資訊 */}
          <Card>
            <CardHeader>
              <CardTitle>傳票資訊</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="voucherType">傳票類型 *</Label>
                <Select value={voucherType} onValueChange={setVoucherType}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇類型">
                      {voucherType ? voucherTypeLabels[voucherType] : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEIPT">收款傳票</SelectItem>
                    <SelectItem value="PAYMENT">付款傳票</SelectItem>
                    <SelectItem value="TRANSFER">轉帳傳票</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voucherDate">傳票日期 *</Label>
                <Input
                  id="voucherDate"
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="description">摘要</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="傳票摘要說明"
                  rows={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* 傳票分錄 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>傳票分錄</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-2" />
                新增分錄
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 w-8">#</th>
                      <th className="text-left py-2 px-2 min-w-[280px]">會計科目</th>
                      <th className="text-left py-2 px-2 min-w-[150px]">摘要</th>
                      <th className="text-right py-2 px-2 w-32">借方金額</th>
                      <th className="text-right py-2 px-2 w-32">貸方金額</th>
                      <th className="text-center py-2 px-2 w-16">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id} className="border-b">
                        <td className="py-2 px-2 text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="py-2 px-2">
                          <AccountSelect
                            companyId={companyId}
                            value={line.accountId}
                            displayValue={
                              line.accountCode && line.accountName
                                ? `${line.accountCode} ${line.accountName}`
                                : ''
                            }
                            onChange={(accountId, accountCode, accountName) =>
                              updateLineAccount(line.id, accountId, accountCode, accountName)
                            }
                            placeholder="輸入代碼或名稱搜尋..."
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            placeholder="分錄說明"
                            value={line.description}
                            onChange={(e) =>
                              updateLine(line.id, 'description', e.target.value)
                            }
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-right"
                            value={line.debitAmount || ''}
                            onChange={(e) =>
                              updateLine(
                                line.id,
                                'debitAmount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-right"
                            value={line.creditAmount || ''}
                            onChange={(e) =>
                              updateLine(
                                line.id,
                                'creditAmount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(line.id)}
                            disabled={lines.length <= 2}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-medium">
                      <td colSpan={3} className="py-3 px-2 text-right">
                        合計
                      </td>
                      <td className="py-3 px-2 text-right font-mono">
                        ${totalDebit.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right font-mono">
                        ${totalCredit.toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="py-2 px-2">
                        <div
                          className={`text-sm ${
                            isBalanced ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {isBalanced
                            ? '借貸平衡'
                            : `借貸不平衡，差額: $${Math.abs(
                                totalDebit - totalCredit
                              ).toLocaleString()}`}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 操作按鈕 */}
          <div className="flex justify-end gap-4">
            <Link href="/dashboard/finance/accounting/vouchers">
              <Button type="button" variant="outline">
                取消
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting || !isBalanced}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? '儲存中...' : '儲存傳票'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
