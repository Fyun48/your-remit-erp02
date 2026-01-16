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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, ArrowRightLeft, Search, ArrowRight, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface TransferPageProps {
  companyId: string
  companyName: string
}

export function TransferPage({
  companyId,
  companyName,
}: TransferPageProps) {
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 使用 tRPC Query 取得資料
  const { data: employees = [], isLoading: isLoadingEmployees } = trpc.hr.listEmployees.useQuery({
    companyId,
    status: 'ACTIVE',
  })
  const { data: departments = [], isLoading: isLoadingDepts } = trpc.department.list.useQuery({ companyId })
  const { data: positions = [], isLoading: isLoadingPos } = trpc.position.list.useQuery({ companyId })

  const [formData, setFormData] = useState({
    departmentId: '',
    positionId: '',
    supervisorId: '',
    effectiveDate: new Date().toISOString().split('T')[0],
  })

  const filteredEmployees = employees.filter((emp) => {
    if (search) {
      const s = search.toLowerCase()
      if (
        !emp.employee.name.toLowerCase().includes(s) &&
        !emp.employee.employeeNo.toLowerCase().includes(s)
      ) {
        return false
      }
    }
    if (filterDept && emp.department.id !== filterDept) {
      return false
    }
    return true
  })

  // 取得可選的主管（排除當前選擇的員工）
  const availableSupervisors = employees.filter(
    (emp) => selectedEmployee && emp.employee.id !== selectedEmployee.employee.id
  )

  const transfer = trpc.hr.transfer.useMutation({
    onSuccess: () => {
      setSelectedEmployee(null)
      setIsSubmitting(false)
      setFormData({
        departmentId: '',
        positionId: '',
        supervisorId: '',
        effectiveDate: new Date().toISOString().split('T')[0],
      })
      utils.hr.listEmployees.invalidate()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee) return

    if (!formData.departmentId || !formData.positionId) {
      alert('請選擇部門和職位')
      return
    }

    setIsSubmitting(true)
    transfer.mutate({
      employeeId: selectedEmployee.employee.id,
      companyId,
      departmentId: formData.departmentId,
      positionId: formData.positionId,
      supervisorId: formData.supervisorId || undefined,
      effectiveDate: new Date(formData.effectiveDate),
    })
  }

  const openTransfer = (emp: typeof employees[0]) => {
    setSelectedEmployee(emp)
    setFormData({
      departmentId: emp.department.id,
      positionId: emp.position.id,
      supervisorId: emp.supervisor?.employee.id || '',
      effectiveDate: new Date().toISOString().split('T')[0],
    })
  }

  const isLoading = isLoadingEmployees || isLoadingDepts || isLoadingPos

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 取得變更的項目
  const getChanges = () => {
    if (!selectedEmployee) return []
    const changes: { label: string; from: string; to: string }[] = []

    if (formData.departmentId !== selectedEmployee.department.id) {
      const newDept = departments.find((d) => d.id === formData.departmentId)
      changes.push({
        label: '部門',
        from: selectedEmployee.department.name,
        to: newDept?.name || '',
      })
    }

    if (formData.positionId !== selectedEmployee.position.id) {
      const newPos = positions.find((p) => p.id === formData.positionId)
      changes.push({
        label: '職位',
        from: selectedEmployee.position.name,
        to: newPos?.name || '',
      })
    }

    const currentSupervisorId = selectedEmployee.supervisor?.employee.id || ''
    if (formData.supervisorId !== currentSupervisorId) {
      const newSupervisor = employees.find((e) => e.employee.id === formData.supervisorId)
      changes.push({
        label: '直屬主管',
        from: selectedEmployee.supervisor?.employee.name || '無',
        to: newSupervisor?.employee.name || '無',
      })
    }

    return changes
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
          <h1 className="text-2xl font-bold">調動作業</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {/* 篩選 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋員工編號、姓名..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="篩選部門" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部部門</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.code} {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 員工列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            在職員工
          </CardTitle>
          <CardDescription>
            選擇要調動的員工
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8">
              <ArrowRightLeft className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
                  <TableHead>直屬主管</TableHead>
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
                    <TableCell>
                      {emp.supervisor?.employee.name || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openTransfer(emp)}>
                        調動
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 調動 Dialog */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>調動作業</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-4">
            {selectedEmployee && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">員工</p>
                    <p className="font-medium">
                      {selectedEmployee.employee.employeeNo} {selectedEmployee.employee.name}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="effectiveDate">生效日期 *</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>部門 *</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(v) => setFormData({ ...formData, departmentId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇部門" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>職位 *</Label>
              <Select
                value={formData.positionId}
                onValueChange={(v) => setFormData({ ...formData, positionId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇職位" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>直屬主管</Label>
              <Select
                value={formData.supervisorId}
                onValueChange={(v) => setFormData({ ...formData, supervisorId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇主管（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">無</SelectItem>
                  {availableSupervisors.map((emp) => (
                    <SelectItem key={emp.id} value={emp.employee.id}>
                      {emp.employee.employeeNo} {emp.employee.name} - {emp.position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 變更預覽 */}
            {getChanges().length > 0 && (
              <div className="border rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">變更預覽</p>
                {getChanges().map((change, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{change.label}：</span>
                    <span>{change.from}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-primary">{change.to}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setSelectedEmployee(null)}>
                取消
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || getChanges().length === 0}
              >
                {isSubmitting ? '處理中...' : '確認調動'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
