'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Settings,
  Loader2,
  UserPlus,
  X,
  Eye,
  EyeOff,
  Building2,
  Users,
  Lock,
  Globe,
  Search,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface ProjectPermissionsProps {
  projectId: string
  companyId: string
  currentUserId: string
  currentVisibility: string
  isManager: boolean
  onVisibilityChange: (visibility: string) => void
}

interface VisibleMemberEmployee {
  id: string
  name: string
  employeeNo: string
  assignments?: Array<{
    department?: { id: string; name: string } | null
    position?: { id: string; name: string } | null
  }>
}

interface VisibleMember {
  id: string
  projectId: string
  employeeId: string
  employee: VisibleMemberEmployee
}

const visibilityOptions = [
  { value: 'PRIVATE', label: '私人', icon: Lock, description: '僅專案成員可見' },
  { value: 'DEPARTMENT', label: '部門', icon: Building2, description: '負責部門全員可見' },
  { value: 'COMPANY', label: '公司', icon: Globe, description: '同公司全員可見' },
  { value: 'CUSTOM', label: '自訂', icon: Users, description: '指定特定人員可見' },
]

export function ProjectPermissions({
  projectId,
  companyId,
  currentUserId,
  currentVisibility,
  isManager,
  onVisibilityChange,
}: ProjectPermissionsProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)

  // 取得可見成員列表
  const { data: visibleMembersData, isLoading: isLoadingMembers, refetch: refetchMembers } =
    trpc.project.getVisibleMembers.useQuery({ projectId })
  // Cast to proper type since tRPC doesn't infer Prisma include types correctly
  const visibleMembers = visibleMembersData as VisibleMember[] | undefined

  // 取得員工列表 (用於新增)
  const { data: employees, isLoading: isLoadingEmployees } = trpc.hr.listEmployees.useQuery({
    companyId,
  })

  // 更新專案
  const updateProject = trpc.project.update.useMutation()

  // 新增可見成員
  const addVisibleMember = trpc.project.addVisibleMember.useMutation({
    onSuccess: () => {
      refetchMembers()
      setIsAddDialogOpen(false)
      setSelectedEmployeeId(null)
      setSearchQuery('')
    },
  })

  // 移除可見成員
  const removeVisibleMember = trpc.project.removeVisibleMember.useMutation({
    onSuccess: () => {
      refetchMembers()
    },
  })

  const handleVisibilityChange = (value: string) => {
    updateProject.mutate({
      id: projectId,
      visibility: value as 'PRIVATE' | 'DEPARTMENT' | 'COMPANY' | 'CUSTOM',
      updatedById: currentUserId,
    })
    onVisibilityChange(value)
  }

  const handleAddMember = () => {
    if (!selectedEmployeeId) return
    addVisibleMember.mutate({
      projectId,
      employeeId: selectedEmployeeId,
      addedById: currentUserId,
    })
  }

  const handleRemoveMember = (employeeId: string) => {
    removeVisibleMember.mutate({
      projectId,
      employeeId,
      removedById: currentUserId,
    })
  }

  // 過濾已加入的員工 (hr.listEmployees 回傳 EmployeeAssignment[], 需要存取 .employee)
  const existingMemberIds = new Set(visibleMembers?.map(m => m.employee.id) || [])
  const filteredEmployees = employees?.filter(assignment => {
    if (existingMemberIds.has(assignment.employee.id)) return false
    if (!searchQuery) return true
    return assignment.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           assignment.employee.employeeNo.toLowerCase().includes(searchQuery.toLowerCase())
  }) || []

  if (!isManager) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <Lock className="h-12 w-12 mx-auto mb-4" />
            <p className="font-medium">無權限存取</p>
            <p className="text-sm">僅專案經理可以管理權限設定</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Visibility Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            專案可見性
          </CardTitle>
          <CardDescription>
            設定誰可以看到這個專案
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibilityOptions.map((option) => {
              const Icon = option.icon
              const isSelected = currentVisibility === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => handleVisibilityChange(option.value)}
                  disabled={updateProject.isPending}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                      {option.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Visibility Members */}
      {currentVisibility === 'CUSTOM' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  自訂可見成員
                </CardTitle>
                <CardDescription>
                  這些人員可以檢視專案（觀察者權限）
                </CardDescription>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    新增成員
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增可見成員</DialogTitle>
                    <DialogDescription>
                      選擇要新增的員工，他們將獲得專案的觀察者權限
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="搜尋員工姓名或編號..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    <ScrollArea className="h-[300px] border rounded-lg">
                      {isLoadingEmployees ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2" />
                          <p>沒有可新增的員工</p>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {filteredEmployees.map((assignment) => (
                            <button
                              key={assignment.employee.id}
                              onClick={() => setSelectedEmployeeId(assignment.employee.id)}
                              className={`w-full p-3 rounded-lg text-left transition-colors ${
                                selectedEmployeeId === assignment.employee.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              <div className="font-medium">{assignment.employee.name}</div>
                              <div className={`text-sm ${
                                selectedEmployeeId === assignment.employee.id
                                  ? 'text-primary-foreground/80'
                                  : 'text-muted-foreground'
                              }`}>
                                {assignment.employee.employeeNo}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      取消
                    </Button>
                    <Button
                      onClick={handleAddMember}
                      disabled={!selectedEmployeeId || addVisibleMember.isPending}
                    >
                      {addVisibleMember.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      新增
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingMembers ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !visibleMembers || visibleMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <EyeOff className="h-12 w-12 mx-auto mb-4" />
                <p className="font-medium">尚無自訂可見成員</p>
                <p className="text-sm">點擊「新增成員」來設定誰可以看到這個專案</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{member.employee.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {member.employee.employeeNo}
                          {member.employee.assignments?.[0] && (
                            <> - {member.employee.assignments[0].department?.name}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">觀察者</Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <X className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>移除可見成員</AlertDialogTitle>
                            <AlertDialogDescription>
                              確定要移除「{member.employee.name}」的專案存取權限嗎？
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveMember(member.employee.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              移除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Access Info */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            權限說明
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>專案成員</strong>：可依角色權限編輯專案內容</p>
          <p><strong>可見成員</strong>：僅能檢視專案，無法編輯（觀察者權限）</p>
          <p><strong>私人</strong>：僅專案成員可見</p>
          <p><strong>部門</strong>：負責部門全員可見</p>
          <p><strong>公司</strong>：同公司全員可見</p>
          <p><strong>自訂</strong>：專案成員 + 指定的可見成員</p>
        </CardContent>
      </Card>
    </div>
  )
}
