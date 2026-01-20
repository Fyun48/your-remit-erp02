'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Users,
  Loader2,
  Plus,
  Search,
  Edit,
  AlertCircle,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'

interface EmployeeSalaryListProps {
  companyId: string
  companyName: string
}

export default function EmployeeSalaryList({ companyId, companyName }: EmployeeSalaryListProps) {
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [editingSalary, setEditingSalary] = useState<{
    baseSalary: string
    laborInsuranceGrade: string
    healthInsuranceGrade: string
    laborPensionGrade: string
    employeePensionRate: string
    dependents: string
  }>({
    baseSalary: '',
    laborInsuranceGrade: '',
    healthInsuranceGrade: '',
    laborPensionGrade: '',
    employeePensionRate: '0',
    dependents: '0',
  })

  const utils = trpc.useUtils()

  const { data: salaries, isLoading } = trpc.payroll.listEmployeeSalaries.useQuery({
    companyId,
    isActive: true,
    search: search || undefined,
  })

  // 取得所有員工（用於新增薪資）
  const { data: employees } = trpc.hr.listEmployees.useQuery({
    companyId,
    status: 'ACTIVE',
  })

  const upsertMutation = trpc.payroll.upsertEmployeeSalary.useMutation({
    onSuccess: () => {
      toast.success('薪資資料已儲存')
      utils.payroll.listEmployeeSalaries.invalidate({ companyId })
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      toast.error(`儲存失敗: ${error.message}`)
    },
  })

  const resetForm = () => {
    setSelectedEmployeeId('')
    setEditingSalary({
      baseSalary: '',
      laborInsuranceGrade: '',
      healthInsuranceGrade: '',
      laborPensionGrade: '',
      employeePensionRate: '0',
      dependents: '0',
    })
  }

  const handleSave = () => {
    if (!selectedEmployeeId) {
      toast.error('請選擇員工')
      return
    }

    const baseSalary = parseFloat(editingSalary.baseSalary)
    if (isNaN(baseSalary) || baseSalary <= 0) {
      toast.error('請輸入有效的底薪')
      return
    }

    upsertMutation.mutate({
      employeeId: selectedEmployeeId,
      companyId,
      baseSalary,
      laborInsuranceGrade: parseFloat(editingSalary.laborInsuranceGrade) || baseSalary,
      healthInsuranceGrade: parseFloat(editingSalary.healthInsuranceGrade) || baseSalary,
      laborPensionGrade: parseFloat(editingSalary.laborPensionGrade) || baseSalary,
      employeePensionRate: parseFloat(editingSalary.employeePensionRate) / 100 || 0,
      dependents: parseInt(editingSalary.dependents) || 0,
      effectiveDate: new Date(),
    })
  }

  const handleEdit = (salary: NonNullable<typeof salaries>[number]) => {
    setSelectedEmployeeId(salary.employeeId)
    setEditingSalary({
      baseSalary: String(salary.baseSalary),
      laborInsuranceGrade: String(salary.laborInsuranceGrade),
      healthInsuranceGrade: String(salary.healthInsuranceGrade),
      laborPensionGrade: String(salary.laborPensionGrade),
      employeePensionRate: String(Number(salary.employeePensionRate) * 100),
      dependents: String(salary.dependents),
    })
    setIsDialogOpen(true)
  }

  const formatAmount = (amount: number | string | { toString(): string } | null) => {
    if (amount === null) return '-'
    const num = typeof amount === 'string' ? parseFloat(amount) :
                typeof amount === 'number' ? amount : parseFloat(amount.toString())
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  // 取得尚未建立薪資的員工
  const employeesWithoutSalary = employees?.filter(
    emp => !salaries?.some(s => s.employeeId === emp.employeeId)
  ) || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hr/payroll">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              員工薪資檔案
            </h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新增員工薪資
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedEmployeeId && salaries?.some(s => s.employeeId === selectedEmployeeId)
                  ? '編輯員工薪資'
                  : '新增員工薪資'}
              </DialogTitle>
              <DialogDescription>
                設定員工的底薪與投保級距
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>員工</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇員工" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeesWithoutSalary.map(emp => (
                      <SelectItem key={emp.employeeId} value={emp.employeeId}>
                        {emp.employee.employeeNo} - {emp.employee.name}
                      </SelectItem>
                    ))}
                    {salaries?.map(s => (
                      <SelectItem key={s.employeeId} value={s.employeeId}>
                        {s.employee.employeeNo} - {s.employee.name} (已建檔)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseSalary">月底薪</Label>
                <Input
                  id="baseSalary"
                  type="number"
                  placeholder="輸入底薪"
                  value={editingSalary.baseSalary}
                  onChange={(e) => setEditingSalary(prev => ({ ...prev, baseSalary: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="laborInsuranceGrade">勞保投保薪資</Label>
                  <Input
                    id="laborInsuranceGrade"
                    type="number"
                    placeholder="留空則與底薪相同"
                    value={editingSalary.laborInsuranceGrade}
                    onChange={(e) => setEditingSalary(prev => ({ ...prev, laborInsuranceGrade: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="healthInsuranceGrade">健保投保薪資</Label>
                  <Input
                    id="healthInsuranceGrade"
                    type="number"
                    placeholder="留空則與底薪相同"
                    value={editingSalary.healthInsuranceGrade}
                    onChange={(e) => setEditingSalary(prev => ({ ...prev, healthInsuranceGrade: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="laborPensionGrade">勞退提繳工資</Label>
                  <Input
                    id="laborPensionGrade"
                    type="number"
                    placeholder="留空則與底薪相同"
                    value={editingSalary.laborPensionGrade}
                    onChange={(e) => setEditingSalary(prev => ({ ...prev, laborPensionGrade: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeePensionRate">員工自提 (%)</Label>
                  <Input
                    id="employeePensionRate"
                    type="number"
                    min="0"
                    max="6"
                    step="0.1"
                    placeholder="0-6%"
                    value={editingSalary.employeePensionRate}
                    onChange={(e) => setEditingSalary(prev => ({ ...prev, employeePensionRate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dependents">健保眷屬人數</Label>
                <Input
                  id="dependents"
                  type="number"
                  min="0"
                  max="3"
                  value={editingSalary.dependents}
                  onChange={(e) => setEditingSalary(prev => ({ ...prev, dependents: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">眷屬最多計 3 人</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜尋 */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜尋員工姓名或編號..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 員工列表 */}
      <Card>
        <CardHeader>
          <CardTitle>員工薪資檔案</CardTitle>
          <CardDescription>
            共 {salaries?.length || 0} 位員工已建立薪資檔案
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!salaries || salaries.length === 0) ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">尚無員工薪資資料</h3>
              <p className="text-muted-foreground mb-4">
                點擊「新增員工薪資」按鈕開始建立
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>員工編號</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead className="text-right">底薪</TableHead>
                  <TableHead className="text-right">勞保投保</TableHead>
                  <TableHead className="text-right">健保投保</TableHead>
                  <TableHead className="text-right">勞退提繳</TableHead>
                  <TableHead className="text-center">自提</TableHead>
                  <TableHead className="text-center">眷屬</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaries.map((salary) => (
                  <TableRow key={salary.id}>
                    <TableCell className="font-mono">
                      {salary.employee.employeeNo}
                    </TableCell>
                    <TableCell className="font-medium">
                      {salary.employee.name}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(salary.baseSalary)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(salary.laborInsuranceGrade)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(salary.healthInsuranceGrade)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(salary.laborPensionGrade)}
                    </TableCell>
                    <TableCell className="text-center">
                      {Number(salary.employeePensionRate) > 0 ? (
                        <Badge variant="secondary">
                          {(Number(salary.employeePensionRate) * 100).toFixed(0)}%
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {salary.dependents > 0 ? salary.dependents : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(salary)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
