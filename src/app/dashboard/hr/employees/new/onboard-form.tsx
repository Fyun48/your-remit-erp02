'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { ArrowLeft, UserPlus, User, Briefcase, Building2, Check, X } from 'lucide-react'
import { trpc } from '@/lib/trpc'

// Password validation rules
const PASSWORD_RULES = [
  { label: '至少 8 個字元', test: (p: string) => p.length >= 8 },
  { label: '包含大寫字母 (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: '包含小寫字母 (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { label: '包含數字 (0-9)', test: (p: string) => /[0-9]/.test(p) },
]

function validatePassword(password: string): string[] {
  return PASSWORD_RULES.filter(rule => !rule.test(password)).map(rule => rule.label)
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  const passed = PASSWORD_RULES.filter(rule => rule.test(password)).length
  if (passed === 0) return { score: 0, label: '', color: '' }
  if (passed === 1) return { score: 1, label: '弱', color: 'bg-red-500' }
  if (passed === 2) return { score: 2, label: '普通', color: 'bg-orange-500' }
  if (passed === 3) return { score: 3, label: '中等', color: 'bg-yellow-500' }
  return { score: 4, label: '強', color: 'bg-green-500' }
}

interface Department {
  id: string
  code: string
  name: string
}

interface Position {
  id: string
  name: string
  level: number
}

interface Role {
  id: string
  name: string
}

interface Supervisor {
  id: string
  employee: { id: string; name: string; employeeNo: string }
  position: { name: string; level: number }
}

interface OnboardFormProps {
  companyId: string
  companyName: string
  departments: Department[]
  positions: Position[]
  roles: Role[]
  supervisors: Supervisor[]
  suggestedEmployeeNo: string
}

export function OnboardForm({
  companyId,
  companyName,
  departments,
  positions,
  roles,
  supervisors,
  suggestedEmployeeNo,
}: OnboardFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    // 帳號資料
    employeeNo: suggestedEmployeeNo,
    name: '',
    email: '',
    password: '',
    // 個人資料
    idNumber: '',
    gender: '',
    birthDate: '',
    phone: '',
    personalEmail: '',
    residentialAddress: '',
    householdAddress: '',
    emergencyContact: '',
    emergencyPhone: '',
    // 任職資料
    departmentId: '',
    positionId: '',
    supervisorId: '',
    roleId: '',
    hireDate: new Date().toISOString().split('T')[0],
  })

  const onboard = trpc.hr.onboard.useMutation({
    onSuccess: () => {
      router.push('/dashboard/hr/employees')
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.employeeNo || !formData.name || !formData.email || !formData.password) {
      alert('請填寫必要欄位：員工編號、姓名、Email、密碼')
      return
    }

    if (!formData.departmentId || !formData.positionId) {
      alert('請選擇部門和職位')
      return
    }

    const passwordErrors = validatePassword(formData.password)
    if (passwordErrors.length > 0) {
      alert(`密碼不符合規則：\n${passwordErrors.join('\n')}`)
      return
    }

    setIsSubmitting(true)

    onboard.mutate({
      employeeNo: formData.employeeNo,
      name: formData.name,
      email: formData.email,
      password: formData.password,
      idNumber: formData.idNumber || undefined,
      gender: formData.gender as 'MALE' | 'FEMALE' | 'OTHER' | undefined,
      birthDate: formData.birthDate ? new Date(formData.birthDate) : undefined,
      phone: formData.phone || undefined,
      personalEmail: formData.personalEmail || undefined,
      residentialAddress: formData.residentialAddress || undefined,
      householdAddress: formData.householdAddress || undefined,
      emergencyContact: formData.emergencyContact || undefined,
      emergencyPhone: formData.emergencyPhone || undefined,
      companyId,
      departmentId: formData.departmentId,
      positionId: formData.positionId,
      supervisorId: formData.supervisorId || undefined,
      roleId: formData.roleId || undefined,
      hireDate: new Date(formData.hireDate),
    })
  }

  const update = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hr/employees">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">到職作業</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 帳號資料 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              帳號資料
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employeeNo">員工編號 *</Label>
              <Input
                id="employeeNo"
                value={formData.employeeNo}
                onChange={(e) => update('employeeNo', e.target.value)}
                placeholder="EMP001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email（登入帳號）*</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="password">密碼 *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="請輸入密碼"
              />
              {formData.password && (
                <div className="space-y-2 mt-2">
                  {/* Password strength bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getPasswordStrength(formData.password).color}`}
                        style={{ width: `${(getPasswordStrength(formData.password).score / 4) * 100}%` }}
                      />
                    </div>
                    {getPasswordStrength(formData.password).label && (
                      <span className="text-xs text-muted-foreground min-w-[3rem]">
                        {getPasswordStrength(formData.password).label}
                      </span>
                    )}
                  </div>
                  {/* Password rules */}
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {PASSWORD_RULES.map((rule, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-1 ${
                          rule.test(formData.password)
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {rule.test(formData.password) ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        {rule.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 任職資料 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              任職資料
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hireDate">到職日期 *</Label>
              <Input
                id="hireDate"
                type="date"
                value={formData.hireDate}
                onChange={(e) => update('hireDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>部門 *</Label>
              <Select value={formData.departmentId} onValueChange={(v) => update('departmentId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇部門" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {d.code} {d.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>職位 *</Label>
              <Select value={formData.positionId} onValueChange={(v) => update('positionId', v)}>
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
              <Select value={formData.supervisorId} onValueChange={(v) => update('supervisorId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇直屬主管（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">無</SelectItem>
                  {supervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.employee.employeeNo} {s.employee.name} - {s.position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>系統角色</Label>
              <Select value={formData.roleId} onValueChange={(v) => update('roleId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇角色（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">無特定角色</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 個人資料 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              個人資料
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="idNumber">身分證字號</Label>
              <Input
                id="idNumber"
                value={formData.idNumber}
                onChange={(e) => update('idNumber', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>性別</Label>
              <Select value={formData.gender} onValueChange={(v) => update('gender', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇性別" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">男</SelectItem>
                  <SelectItem value="FEMALE">女</SelectItem>
                  <SelectItem value="OTHER">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">出生日期</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => update('birthDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">手機號碼</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personalEmail">個人 Email</Label>
              <Input
                id="personalEmail"
                type="email"
                value={formData.personalEmail}
                onChange={(e) => update('personalEmail', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="residentialAddress">居住地址</Label>
              <Input
                id="residentialAddress"
                value={formData.residentialAddress}
                onChange={(e) => update('residentialAddress', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="householdAddress">戶籍地址</Label>
              <Input
                id="householdAddress"
                value={formData.householdAddress}
                onChange={(e) => update('householdAddress', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContact">緊急聯絡人</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => update('emergencyContact', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">緊急聯絡電話</Label>
              <Input
                id="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={(e) => update('emergencyPhone', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 操作按鈕 */}
        <div className="flex justify-end gap-4">
          <Link href="/dashboard/hr/employees">
            <Button type="button" variant="outline">
              取消
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            <UserPlus className="h-4 w-4 mr-2" />
            {isSubmitting ? '處理中...' : '建立員工帳號'}
          </Button>
        </div>
      </form>
    </div>
  )
}
