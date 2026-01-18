'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Plus, Users, Search, Eye } from 'lucide-react'

interface SecondaryAssignment {
  company: { id: string; name: string }
  department: { name: string }
  position: { name: string }
}

interface Employee {
  id: string
  employeeNo: string
  name: string
  email: string
  avatarUrl: string | null
  phone: string | null
  hireDate: Date
  isActive: boolean
  assignments: SecondaryAssignment[]
}

interface EmployeeAssignment {
  id: string
  status: string
  startDate: Date
  employee: Employee
  department: { id: string; name: string; code: string }
  position: { id: string; name: string }
  supervisor: { employee: { name: string } } | null
}

interface Department {
  id: string
  code: string
  name: string
}

interface Position {
  id: string
  name: string
}

interface EmployeeListProps {
  companyId: string
  companyName: string
  employees: EmployeeAssignment[]
  departments: Department[]
  positions: Position[]
  showResigned: boolean
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  ACTIVE: { label: '在職', variant: 'default' },
  ON_LEAVE: { label: '留停', variant: 'secondary' },
  RESIGNED: { label: '離職', variant: 'destructive' },
}

export function EmployeeList({
  companyName,
  employees,
  departments,
  showResigned,
}: EmployeeListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // 切換顯示離職員工
  const handleShowResignedChange = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('showResigned', 'true')
    } else {
      params.delete('showResigned')
    }
    router.push(`/dashboard/hr/employees?${params.toString()}`)
  }

  const filteredEmployees = employees.filter((emp) => {
    // 搜尋
    if (search) {
      const s = search.toLowerCase()
      if (
        !emp.employee.name.toLowerCase().includes(s) &&
        !emp.employee.employeeNo.toLowerCase().includes(s) &&
        !emp.employee.email.toLowerCase().includes(s)
      ) {
        return false
      }
    }

    // 部門篩選
    if (filterDept && emp.department.id !== filterDept) {
      return false
    }

    // 狀態篩選
    if (filterStatus && emp.status !== filterStatus) {
      return false
    }

    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hr">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">員工資料</h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <Link href="/dashboard/hr/employees/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增人員
          </Button>
        </Link>
      </div>

      {/* 篩選列 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋員工編號、姓名、Email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="篩選部門" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部部門</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="篩選狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部狀態</SelectItem>
                <SelectItem value="ACTIVE">在職</SelectItem>
                <SelectItem value="ON_LEAVE">留停</SelectItem>
                {showResigned && <SelectItem value="RESIGNED">離職</SelectItem>}
              </SelectContent>
            </Select>

            {/* 顯示離職員工勾選框 */}
            <div className="flex items-center space-x-2 ml-auto">
              <Checkbox
                id="showResigned"
                checked={showResigned}
                onCheckedChange={handleShowResignedChange}
              />
              <Label
                htmlFor="showResigned"
                className="text-sm font-medium cursor-pointer select-none"
              >
                顯示已離職員工
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 員工列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            員工列表
            <Badge variant="secondary" className="ml-2">
              {filteredEmployees.length} 人
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
                  <TableHead>兼任</TableHead>
                  <TableHead>直屬主管</TableHead>
                  <TableHead>到職日</TableHead>
                  <TableHead className="text-center">狀態</TableHead>
                  <TableHead className="w-20">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => {
                  const status = statusLabels[emp.status] || statusLabels.ACTIVE
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono">{emp.employee.employeeNo}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={emp.employee.avatarUrl || undefined} alt={emp.employee.name} />
                            <AvatarFallback className="text-xs">
                              {emp.employee.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{emp.employee.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{emp.department.name}</Badge>
                      </TableCell>
                      <TableCell>{emp.position.name}</TableCell>
                      <TableCell>
                        {emp.employee.assignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {emp.employee.assignments.map((a, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs whitespace-nowrap">
                                {a.company.name} · {a.position.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {emp.supervisor?.employee.name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(emp.employee.hireDate).toLocaleDateString('zh-TW')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/hr/employees/${emp.employee.id}${showResigned ? '?showResigned=true' : ''}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
