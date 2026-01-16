'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Pencil,
  User,
  Building2,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  ArrowRightLeft,
  UserMinus,
  History,
  Camera,
  Loader2,
  Plus,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { trpc } from '@/lib/trpc'

interface Employee {
  id: string
  employeeNo: string
  name: string
  email: string
  avatarUrl: string | null
  idNumber: string | null
  gender: string | null
  birthDate: Date | null
  phone: string | null
  personalEmail: string | null
  residentialAddress: string | null
  householdAddress: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  hireDate: Date
  resignDate: Date | null
  isActive: boolean
  assignments: Assignment[]
}

interface Assignment {
  id: string
  status: string
  isPrimary: boolean
  startDate: Date
  endDate: Date | null
  company: { id: string; name: string }
  department: { id: string; name: string; code: string }
  position: { id: string; name: string }
  role: { id: string; name: string } | null
  supervisor: { employee: { id: string; name: string; employeeNo: string } } | null
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

interface Supervisor {
  id: string
  employee: { id: string; name: string; employeeNo: string }
  position: { name: string; level: number }
}

interface EmployeeDetailProps {
  employee: Employee
  companyId: string
  companyName: string
  departments: Department[]
  positions: Position[]
  supervisors: Supervisor[]
}

const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  OTHER: '其他',
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  ACTIVE: { label: '在職', variant: 'default' },
  ON_LEAVE: { label: '留停', variant: 'secondary' },
  RESIGNED: { label: '離職', variant: 'destructive' },
}

export function EmployeeDetail({
  employee,
  companyId,
  companyName,
  departments,
  positions,
  supervisors,
}: EmployeeDetailProps) {
  const router = useRouter()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isOffboardOpen, setIsOffboardOpen] = useState(false)
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false)
  const [isEndAssignmentOpen, setIsEndAssignmentOpen] = useState(false)
  const [selectedAssignmentToEnd, setSelectedAssignmentToEnd] = useState<Assignment | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(employee.avatarUrl)

  const currentAssignment = employee.assignments.find(
    (a) => a.status === 'ACTIVE' && a.isPrimary
  )
  const secondaryAssignments = employee.assignments.filter(
    (a) => a.status === 'ACTIVE' && !a.isPrimary
  )
  const isResigned = !currentAssignment || currentAssignment.status === 'RESIGNED'

  // 新增兼任表單資料
  const [addAssignmentData, setAddAssignmentData] = useState({
    companyId: '',
    departmentId: '',
    positionId: '',
    supervisorId: '',
    startDate: new Date().toISOString().split('T')[0],
  })

  // 結束兼任表單資料
  const [endAssignmentDate, setEndAssignmentDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  // 取得可選的公司列表
  const { data: availableCompanies = [] } = trpc.hr.getAvailableCompanies.useQuery(
    { employeeId: employee.id },
    { enabled: isAddAssignmentOpen }
  )

  // 選中公司的部門和職位
  const selectedCompany = availableCompanies.find((c) => c.id === addAssignmentData.companyId)

  const [editData, setEditData] = useState({
    name: employee.name,
    idNumber: employee.idNumber || '',
    gender: employee.gender || '',
    birthDate: employee.birthDate ? new Date(employee.birthDate).toISOString().split('T')[0] : '',
    phone: employee.phone || '',
    personalEmail: employee.personalEmail || '',
    residentialAddress: employee.residentialAddress || '',
    householdAddress: employee.householdAddress || '',
    emergencyContact: employee.emergencyContact || '',
    emergencyPhone: employee.emergencyPhone || '',
  })

  const [transferData, setTransferData] = useState({
    departmentId: currentAssignment?.department.id || '',
    positionId: currentAssignment?.position.id || '',
    supervisorId: currentAssignment?.supervisor?.employee.id || '',
    effectiveDate: new Date().toISOString().split('T')[0],
  })

  const [offboardData, setOffboardData] = useState({
    resignDate: new Date().toISOString().split('T')[0],
    reason: '',
  })

  const updateEmployee = trpc.hr.updateEmployee.useMutation({
    onSuccess: () => {
      setIsEditOpen(false)
      setIsSubmitting(false)
      router.refresh()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const transfer = trpc.hr.transfer.useMutation({
    onSuccess: () => {
      setIsTransferOpen(false)
      setIsSubmitting(false)
      router.refresh()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const offboard = trpc.hr.offboard.useMutation({
    onSuccess: () => {
      setIsOffboardOpen(false)
      setIsSubmitting(false)
      router.refresh()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const addSecondaryAssignment = trpc.hr.addSecondaryAssignment.useMutation({
    onSuccess: () => {
      setIsAddAssignmentOpen(false)
      setIsSubmitting(false)
      setAddAssignmentData({
        companyId: '',
        departmentId: '',
        positionId: '',
        supervisorId: '',
        startDate: new Date().toISOString().split('T')[0],
      })
      router.refresh()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const endSecondaryAssignment = trpc.hr.endSecondaryAssignment.useMutation({
    onSuccess: () => {
      setIsEndAssignmentOpen(false)
      setSelectedAssignmentToEnd(null)
      setIsSubmitting(false)
      router.refresh()
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    updateEmployee.mutate({
      employeeId: employee.id,
      name: editData.name,
      idNumber: editData.idNumber || undefined,
      gender: editData.gender as 'MALE' | 'FEMALE' | 'OTHER' | undefined,
      birthDate: editData.birthDate ? new Date(editData.birthDate) : null,
      phone: editData.phone || undefined,
      personalEmail: editData.personalEmail || undefined,
      residentialAddress: editData.residentialAddress || undefined,
      householdAddress: editData.householdAddress || undefined,
      emergencyContact: editData.emergencyContact || undefined,
      emergencyPhone: editData.emergencyPhone || undefined,
    })
  }

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferData.departmentId || !transferData.positionId) {
      alert('請選擇部門和職位')
      return
    }
    setIsSubmitting(true)
    transfer.mutate({
      employeeId: employee.id,
      companyId,
      departmentId: transferData.departmentId,
      positionId: transferData.positionId,
      supervisorId: transferData.supervisorId || undefined,
      effectiveDate: new Date(transferData.effectiveDate),
    })
  }

  const handleOffboard = () => {
    setIsSubmitting(true)
    offboard.mutate({
      employeeId: employee.id,
      resignDate: new Date(offboardData.resignDate),
      reason: offboardData.reason || undefined,
    })
  }

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addAssignmentData.companyId || !addAssignmentData.departmentId || !addAssignmentData.positionId) {
      alert('請選擇公司、部門和職位')
      return
    }
    setIsSubmitting(true)
    addSecondaryAssignment.mutate({
      employeeId: employee.id,
      companyId: addAssignmentData.companyId,
      departmentId: addAssignmentData.departmentId,
      positionId: addAssignmentData.positionId,
      supervisorId: addAssignmentData.supervisorId || undefined,
      startDate: new Date(addAssignmentData.startDate),
    })
  }

  const handleEndAssignment = () => {
    if (!selectedAssignmentToEnd) return
    setIsSubmitting(true)
    endSecondaryAssignment.mutate({
      assignmentId: selectedAssignmentToEnd.id,
      endDate: new Date(endAssignmentDate),
    })
  }

  const openEndAssignmentDialog = (assignment: Assignment) => {
    setSelectedAssignmentToEnd(assignment)
    setEndAssignmentDate(new Date().toISOString().split('T')[0])
    setIsEndAssignmentOpen(true)
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('zh-TW')
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('檔案大小不可超過 2MB')
      return
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('只接受 JPG、PNG、GIF、WebP 格式')
      return
    }

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('employeeId', employee.id)

      const response = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '上傳失敗')
      }

      const data = await response.json()
      setAvatarUrl(data.url)
    } catch (error) {
      alert(error instanceof Error ? error.message : '上傳頭像失敗')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2)
  }

  return (
    <div className="space-y-6">
      {/* 標題與操作按鈕 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hr/employees">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          {/* 頭像 */}
          <div className="relative group">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl || undefined} alt={employee.name} />
              <AvatarFallback className="text-lg">
                {getInitials(employee.name)}
              </AvatarFallback>
            </Avatar>
            {!isResigned && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                {isUploadingAvatar ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                />
              </label>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{employee.name}</h1>
              <Badge variant="outline" className="font-mono">
                {employee.employeeNo}
              </Badge>
              {currentAssignment && (
                <Badge variant={statusLabels[currentAssignment.status]?.variant || 'default'}>
                  {statusLabels[currentAssignment.status]?.label || currentAssignment.status}
                </Badge>
              )}
              {!employee.isActive && (
                <Badge variant="destructive">帳號停用</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        {!isResigned && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              編輯資料
            </Button>
            <Button variant="outline" onClick={() => setIsTransferOpen(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              調動
            </Button>
            <Button variant="destructive" onClick={() => setIsOffboardOpen(true)}>
              <UserMinus className="h-4 w-4 mr-2" />
              離職
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="job" className="space-y-4">
        <TabsList>
          <TabsTrigger value="job">任職資料</TabsTrigger>
          <TabsTrigger value="info">個人資料</TabsTrigger>
          <TabsTrigger value="history">異動紀錄</TabsTrigger>
        </TabsList>

        {/* 任職資料 */}
        <TabsContent value="job" className="space-y-4">
          {/* 主要任職 */}
          {currentAssignment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  主要任職
                  <Badge variant="default">主要</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">所屬公司</p>
                    <p className="font-medium">{currentAssignment.company.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">部門</p>
                    <p className="font-medium">
                      <Badge variant="outline" className="mr-1">
                        {currentAssignment.department.code}
                      </Badge>
                      {currentAssignment.department.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">職位</p>
                    <p className="font-medium">{currentAssignment.position.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">直屬主管</p>
                    <p className="font-medium">
                      {currentAssignment.supervisor?.employee.name || '-'}
                    </p>
                  </div>
                  {currentAssignment.role && (
                    <div>
                      <p className="text-sm text-muted-foreground">系統角色</p>
                      <p className="font-medium">{currentAssignment.role.name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">到任日期</p>
                    <p className="font-medium">{formatDate(currentAssignment.startDate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 兼任職位 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                兼任職位
                <Badge variant="secondary">{secondaryAssignments.length}</Badge>
              </CardTitle>
              {!isResigned && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddAssignmentOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  新增兼任
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {secondaryAssignments.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  尚無兼任職位
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>公司</TableHead>
                      <TableHead>部門</TableHead>
                      <TableHead>職位</TableHead>
                      <TableHead>到任日期</TableHead>
                      <TableHead className="w-20">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {secondaryAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>{assignment.company.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="mr-1">
                            {assignment.department.code}
                          </Badge>
                          {assignment.department.name}
                        </TableCell>
                        <TableCell>{assignment.position.name}</TableCell>
                        <TableCell>{formatDate(assignment.startDate)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEndAssignmentDialog(assignment)}
                            className="text-destructive hover:text-destructive"
                            title="結束兼任"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 個人資料 */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* 基本資料 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  基本資料
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">身分證字號</p>
                    <p className="font-medium">{employee.idNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">性別</p>
                    <p className="font-medium">
                      {employee.gender ? genderLabels[employee.gender] : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">出生日期</p>
                    <p className="font-medium">{formatDate(employee.birthDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">到職日期</p>
                    <p className="font-medium">{formatDate(employee.hireDate)}</p>
                  </div>
                  {employee.resignDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">離職日期</p>
                      <p className="font-medium text-destructive">
                        {formatDate(employee.resignDate)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 聯絡資訊 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  聯絡資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">公司信箱：</span>
                    <span>{employee.email}</span>
                  </div>
                  {employee.personalEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">個人信箱：</span>
                      <span>{employee.personalEmail}</span>
                    </div>
                  )}
                  {employee.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">手機：</span>
                      <span>{employee.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 地址資訊 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  地址資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">居住地址</p>
                  <p className="font-medium">{employee.residentialAddress || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">戶籍地址</p>
                  <p className="font-medium">{employee.householdAddress || '-'}</p>
                </div>
              </CardContent>
            </Card>

            {/* 緊急聯絡人 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  緊急聯絡人
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">聯絡人姓名</p>
                  <p className="font-medium">{employee.emergencyContact || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">聯絡電話</p>
                  <p className="font-medium">{employee.emergencyPhone || '-'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 異動紀錄 */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                任職異動紀錄
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employee.assignments.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">尚無異動紀錄</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>公司</TableHead>
                      <TableHead>部門</TableHead>
                      <TableHead>職位</TableHead>
                      <TableHead>起始日</TableHead>
                      <TableHead>結束日</TableHead>
                      <TableHead>狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employee.assignments.map((assignment) => {
                      const status = statusLabels[assignment.status] || statusLabels.ACTIVE
                      return (
                        <TableRow key={assignment.id}>
                          <TableCell>{assignment.company.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="mr-1">
                              {assignment.department.code}
                            </Badge>
                            {assignment.department.name}
                          </TableCell>
                          <TableCell>{assignment.position.name}</TableCell>
                          <TableCell>{formatDate(assignment.startDate)}</TableCell>
                          <TableCell>{formatDate(assignment.endDate)}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                            {assignment.isPrimary && (
                              <Badge variant="outline" className="ml-1">
                                主要
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 編輯個人資料 Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>編輯個人資料</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">姓名</Label>
                <Input
                  id="edit-name"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-idNumber">身分證字號</Label>
                <Input
                  id="edit-idNumber"
                  value={editData.idNumber}
                  onChange={(e) => setEditData({ ...editData, idNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>性別</Label>
                <Select
                  value={editData.gender}
                  onValueChange={(v) => setEditData({ ...editData, gender: v })}
                >
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
                <Label htmlFor="edit-birthDate">出生日期</Label>
                <Input
                  id="edit-birthDate"
                  type="date"
                  value={editData.birthDate}
                  onChange={(e) => setEditData({ ...editData, birthDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">手機號碼</Label>
                <Input
                  id="edit-phone"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-personalEmail">個人 Email</Label>
                <Input
                  id="edit-personalEmail"
                  type="email"
                  value={editData.personalEmail}
                  onChange={(e) => setEditData({ ...editData, personalEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-residentialAddress">居住地址</Label>
                <Input
                  id="edit-residentialAddress"
                  value={editData.residentialAddress}
                  onChange={(e) => setEditData({ ...editData, residentialAddress: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-householdAddress">戶籍地址</Label>
                <Input
                  id="edit-householdAddress"
                  value={editData.householdAddress}
                  onChange={(e) => setEditData({ ...editData, householdAddress: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emergencyContact">緊急聯絡人</Label>
                <Input
                  id="edit-emergencyContact"
                  value={editData.emergencyContact}
                  onChange={(e) => setEditData({ ...editData, emergencyContact: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emergencyPhone">緊急聯絡電話</Label>
                <Input
                  id="edit-emergencyPhone"
                  value={editData.emergencyPhone}
                  onChange={(e) => setEditData({ ...editData, emergencyPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 調動 Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>調動作業</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-date">生效日期</Label>
              <Input
                id="transfer-date"
                type="date"
                value={transferData.effectiveDate}
                onChange={(e) => setTransferData({ ...transferData, effectiveDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>部門</Label>
              <Select
                value={transferData.departmentId}
                onValueChange={(v) => setTransferData({ ...transferData, departmentId: v })}
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
              <Label>職位</Label>
              <Select
                value={transferData.positionId}
                onValueChange={(v) => setTransferData({ ...transferData, positionId: v })}
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
                value={transferData.supervisorId}
                onValueChange={(v) => setTransferData({ ...transferData, supervisorId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇主管（可選）" />
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
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsTransferOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '處理中...' : '確認調動'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 離職確認 Dialog */}
      <AlertDialog open={isOffboardOpen} onOpenChange={setIsOffboardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認離職作業</AlertDialogTitle>
            <AlertDialogDescription>
              確定要為員工「{employee.name}」辦理離職嗎？此操作會停用帳號並結束所有任職記錄。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resign-date">離職日期</Label>
              <Input
                id="resign-date"
                type="date"
                value={offboardData.resignDate}
                onChange={(e) => setOffboardData({ ...offboardData, resignDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resign-reason">離職原因（可選）</Label>
              <Input
                id="resign-reason"
                value={offboardData.reason}
                onChange={(e) => setOffboardData({ ...offboardData, reason: e.target.value })}
                placeholder="自願離職、退休等"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOffboard}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? '處理中...' : '確認離職'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 新增兼任 Dialog */}
      <Dialog open={isAddAssignmentOpen} onOpenChange={setIsAddAssignmentOpen}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>新增兼任職位</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddAssignment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-assignment-date">生效日期 *</Label>
              <Input
                id="add-assignment-date"
                type="date"
                value={addAssignmentData.startDate}
                onChange={(e) => setAddAssignmentData({ ...addAssignmentData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>公司 *</Label>
              <Select
                value={addAssignmentData.companyId}
                onValueChange={(v) => setAddAssignmentData({
                  ...addAssignmentData,
                  companyId: v,
                  departmentId: '',
                  positionId: '',
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇公司" />
                </SelectTrigger>
                <SelectContent>
                  {availableCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableCompanies.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  此員工已在所有公司有任職記錄
                </p>
              )}
            </div>
            {selectedCompany && (
              <>
                <div className="space-y-2">
                  <Label>部門 *</Label>
                  <Select
                    value={addAssignmentData.departmentId}
                    onValueChange={(v) => setAddAssignmentData({ ...addAssignmentData, departmentId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇部門" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCompany.departments.map((d) => (
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
                    value={addAssignmentData.positionId}
                    onValueChange={(v) => setAddAssignmentData({ ...addAssignmentData, positionId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇職位" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCompany.positions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddAssignmentOpen(false)}>
                取消
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !addAssignmentData.companyId || !addAssignmentData.departmentId || !addAssignmentData.positionId}
              >
                {isSubmitting ? '處理中...' : '新增兼任'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 結束兼任確認 Dialog */}
      <AlertDialog open={isEndAssignmentOpen} onOpenChange={setIsEndAssignmentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認結束兼任</AlertDialogTitle>
            <AlertDialogDescription>
              確定要結束員工「{employee.name}」在「{selectedAssignmentToEnd?.company.name}」的兼任職位嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="end-assignment-date">結束日期</Label>
              <Input
                id="end-assignment-date"
                type="date"
                value={endAssignmentDate}
                onChange={(e) => setEndAssignmentDate(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndAssignment}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? '處理中...' : '確認結束'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
