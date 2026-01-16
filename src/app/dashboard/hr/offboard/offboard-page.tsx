'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, UserMinus, Search, AlertTriangle, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface OffboardPageProps {
  companyId: string
  companyName: string
  currentUserId: string
}

const offboardReasons = [
  { value: 'VOLUNTARY', label: '自願離職' },
  { value: 'RETIREMENT', label: '退休' },
  { value: 'CONTRACT_END', label: '合約期滿' },
  { value: 'TERMINATION', label: '資遣' },
  { value: 'TRANSFER', label: '調離（集團內）' },
  { value: 'OTHER', label: '其他' },
]

export function OffboardPage({ companyId, companyName, currentUserId }: OffboardPageProps) {
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 使用 tRPC Query 取得資料（排除自己）
  const { data: employees = [], isLoading } = trpc.hr.listEmployees.useQuery({
    companyId,
    status: 'ACTIVE',
    excludeEmployeeId: currentUserId,
  })

  const [formData, setFormData] = useState({
    resignDate: new Date().toISOString().split('T')[0],
    reasonType: '',
    reason: '',
  })

  const filteredEmployees = employees.filter((emp) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      emp.employee.name.toLowerCase().includes(s) ||
      emp.employee.employeeNo.toLowerCase().includes(s) ||
      emp.employee.email.toLowerCase().includes(s)
    )
  })

  const offboard = trpc.hr.offboard.useMutation({
    onSuccess: () => {
      setSelectedEmployee(null)
      setIsSubmitting(false)
      setFormData({ resignDate: new Date().toISOString().split('T')[0], reasonType: '', reason: '' })
      utils.hr.listEmployees.invalidate()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const handleOffboard = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee) return

    const reasonLabel = offboardReasons.find((r) => r.value === formData.reasonType)?.label || ''
    const fullReason = formData.reason
      ? `${reasonLabel}：${formData.reason}`
      : reasonLabel

    setIsSubmitting(true)
    offboard.mutate({
      employeeId: selectedEmployee.employee.id,
      resignDate: new Date(formData.resignDate),
      reason: fullReason || undefined,
    })
  }

  const openOffboard = (emp: typeof employees[0]) => {
    setSelectedEmployee(emp)
    setFormData({
      resignDate: new Date().toISOString().split('T')[0],
      reasonType: '',
      reason: '',
    })
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('zh-TW')
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
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hr">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">離職作業</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {/* 搜尋 */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋員工編號、姓名、Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* 員工列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5" />
            在職員工
          </CardTitle>
          <CardDescription>
            選擇要辦理離職的員工
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8">
              <UserMinus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">找不到符合條件的員工</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">員工編號</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>部門</TableHead>
                  <TableHead>職位</TableHead>
                  <TableHead>到職日</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono">{emp.employee.employeeNo}</TableCell>
                    <TableCell className="font-medium">{emp.employee.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{emp.department.name}</Badge>
                    </TableCell>
                    <TableCell>{emp.position.name}</TableCell>
                    <TableCell>{formatDate(emp.employee.hireDate)}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openOffboard(emp)}
                      >
                        離職
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 離職 Dialog */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              離職作業確認
            </DialogTitle>
            <DialogDescription>
              確定要為員工「{selectedEmployee?.employee.name}」辦理離職嗎？
              此操作會停用該員工的帳號並結束所有任職記錄。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleOffboard} className="space-y-4 pt-4">
            {selectedEmployee && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">員工編號</span>
                  <span className="font-mono">{selectedEmployee.employee.employeeNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">姓名</span>
                  <span className="font-medium">{selectedEmployee.employee.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">部門</span>
                  <span>{selectedEmployee.department.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">職位</span>
                  <span>{selectedEmployee.position.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">到職日</span>
                  <span>{formatDate(selectedEmployee.employee.hireDate)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="resignDate">離職日期 *</Label>
              <Input
                id="resignDate"
                type="date"
                value={formData.resignDate}
                onChange={(e) => setFormData({ ...formData, resignDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>離職類型</Label>
              <Select
                value={formData.reasonType}
                onValueChange={(v) => setFormData({ ...formData, reasonType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇離職類型" />
                </SelectTrigger>
                <SelectContent>
                  {offboardReasons.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">備註（可選）</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="輸入其他備註事項..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setSelectedEmployee(null)}>
                取消
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? '處理中...' : '確認離職'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
