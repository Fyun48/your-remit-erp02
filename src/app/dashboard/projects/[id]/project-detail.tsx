'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ArrowLeft,
  Building2,
  User,
  Users,
  Calendar,
  Layers,
  CheckSquare,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Activity,
  Briefcase,
  UserPlus,
  UserMinus,
  Kanban,
  GanttChart,
  PieChart,
  FileText,
  UserCheck,
  MessageSquare,
  Paperclip,
  Bell,
  Copy,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format } from 'date-fns'
import { ProjectKanban } from './project-kanban'
import { ProjectGantt } from './project-gantt'
import { ProjectStats } from './project-stats'
import { ProjectReport } from './project-report'
import { ProjectActivities } from './project-activities'
import { ProjectTeamAvailability } from './project-team-availability'
import { ProjectComments } from './project-comments'
import { ProjectAttachments } from './project-attachments'
import { ProjectReminders } from './project-reminders'

interface ProjectDetailProps {
  projectId: string
  companyId: string
  currentUserId: string
}

type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type ProjectType = 'INTERNAL' | 'CLIENT'
type PhaseStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW'
type MemberRole = 'MANAGER' | 'MEMBER' | 'OBSERVER'

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: '規劃中',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

const statusColors: Record<ProjectStatus, string> = {
  PLANNING: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const typeLabels: Record<ProjectType, string> = {
  INTERNAL: '內部專案',
  CLIENT: '客戶專案',
}

const typeColors: Record<ProjectType, string> = {
  INTERNAL: 'bg-purple-100 text-purple-800',
  CLIENT: 'bg-orange-100 text-orange-800',
}

const phaseStatusLabels: Record<PhaseStatus, string> = {
  PENDING: '未開始',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
}

const phaseStatusColors: Record<PhaseStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
}

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: '待辦',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
}

const taskStatusColors: Record<TaskStatus, string> = {
  TODO: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
}

const taskPriorityLabels: Record<TaskPriority, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
}

const taskPriorityColors: Record<TaskPriority, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-gray-100 text-gray-800',
}

const memberRoleLabels: Record<MemberRole, string> = {
  MANAGER: '專案經理',
  MEMBER: '成員',
  OBSERVER: '觀察者',
}

export function ProjectDetail({ projectId, companyId, currentUserId }: ProjectDetailProps) {
  const utils = trpc.useUtils()

  // State for dialogs
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false)
  const [isAddPhaseOpen, setIsAddPhaseOpen] = useState(false)
  const [isEditPhaseOpen, setIsEditPhaseOpen] = useState(false)
  const [isDeletePhaseOpen, setIsDeletePhaseOpen] = useState(false)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false)
  const [isDeleteTaskOpen, setIsDeleteTaskOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false)
  const [isRemoveMemberOpen, setIsRemoveMemberOpen] = useState(false)
  const [isSaveAsTemplateOpen, setIsSaveAsTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')
  const [templateTags, setTemplateTags] = useState('')

  // State for selected items
  const [selectedPhase, setSelectedPhase] = useState<{
    id: string
    name: string
    description?: string | null
    status: string
    plannedEndDate?: Date | null
  } | null>(null)
  const [selectedTask, setSelectedTask] = useState<{
    id: string
    phaseId: string
    name: string
    description?: string | null
    status: string
    priority: string
    assigneeId?: string | null
    dueDate?: Date | null
    estimatedHours?: number | null
  } | null>(null)
  const [selectedMember, setSelectedMember] = useState<{
    employeeId: string
    name: string
    role: string
  } | null>(null)
  const [selectedPhaseIdForTask, setSelectedPhaseIdForTask] = useState<string>('')

  // State for expanded phases
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())

  // Form states
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'PLANNING' as ProjectStatus,
  })

  const [phaseForm, setPhaseForm] = useState({
    name: '',
    description: '',
    status: 'PENDING' as PhaseStatus,
    plannedEndDate: '',
  })

  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    status: 'TODO' as TaskStatus,
    priority: 'MEDIUM' as TaskPriority,
    assigneeId: '',
    dueDate: '',
    estimatedHours: '',
  })

  const [memberForm, setMemberForm] = useState({
    employeeId: '',
    role: 'MEMBER' as MemberRole,
  })

  // Fetch project data
  const { data: project, isLoading, error } = trpc.project.getById.useQuery({ id: projectId })

  // Fetch employees for member selection
  const { data: employees } = trpc.hr.listEmployees.useQuery(
    { companyId, status: 'ACTIVE' },
    { enabled: isAddMemberOpen || isAddTaskOpen || isEditTaskOpen }
  )

  // Mutations
  const updateProject = trpc.project.update.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsEditProjectOpen(false)
    },
  })

  const createPhase = trpc.project.createPhase.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsAddPhaseOpen(false)
      resetPhaseForm()
    },
  })

  const updatePhase = trpc.project.updatePhase.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsEditPhaseOpen(false)
      setSelectedPhase(null)
    },
  })

  const deletePhase = trpc.project.deletePhase.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsDeletePhaseOpen(false)
      setSelectedPhase(null)
    },
  })

  const createTask = trpc.project.createTask.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsAddTaskOpen(false)
      resetTaskForm()
    },
  })

  const updateTask = trpc.project.updateTask.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsEditTaskOpen(false)
      setSelectedTask(null)
    },
  })

  const deleteTask = trpc.project.deleteTask.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsDeleteTaskOpen(false)
      setSelectedTask(null)
    },
  })

  const addMember = trpc.project.addMember.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsAddMemberOpen(false)
      resetMemberForm()
    },
  })

  const updateMemberRole = trpc.project.updateMemberRole.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsEditMemberOpen(false)
      setSelectedMember(null)
    },
  })

  const removeMember = trpc.project.removeMember.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId })
      setIsRemoveMemberOpen(false)
      setSelectedMember(null)
    },
  })

  const createTemplateFromProject = trpc.project.createTemplateFromProject.useMutation({
    onSuccess: () => {
      setIsSaveAsTemplateOpen(false)
      setTemplateName('')
      setTemplateCategory('')
      setTemplateTags('')
    },
  })

  // Helper functions
  const resetPhaseForm = () => {
    setPhaseForm({
      name: '',
      description: '',
      status: 'PENDING',
      plannedEndDate: '',
    })
  }

  const resetTaskForm = () => {
    setTaskForm({
      name: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeId: '',
      dueDate: '',
      estimatedHours: '',
    })
  }

  const resetMemberForm = () => {
    setMemberForm({
      employeeId: '',
      role: 'MEMBER',
    })
  }

  const togglePhaseExpanded = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId)
      } else {
        newSet.add(phaseId)
      }
      return newSet
    })
  }

  const openEditProject = () => {
    if (project) {
      setProjectForm({
        name: project.name,
        description: project.description || '',
        status: project.status as ProjectStatus,
      })
      setIsEditProjectOpen(true)
    }
  }

  const openEditPhase = (phase: typeof selectedPhase) => {
    if (phase) {
      setSelectedPhase(phase)
      setPhaseForm({
        name: phase.name,
        description: phase.description || '',
        status: phase.status as PhaseStatus,
        plannedEndDate: phase.plannedEndDate
          ? format(new Date(phase.plannedEndDate), 'yyyy-MM-dd')
          : '',
      })
      setIsEditPhaseOpen(true)
    }
  }

  const openDeletePhase = (phase: typeof selectedPhase) => {
    setSelectedPhase(phase)
    setIsDeletePhaseOpen(true)
  }

  const openAddTask = (phaseId: string) => {
    setSelectedPhaseIdForTask(phaseId)
    resetTaskForm()
    setIsAddTaskOpen(true)
  }

  const openEditTask = (task: typeof selectedTask) => {
    if (task) {
      setSelectedTask(task)
      setTaskForm({
        name: task.name,
        description: task.description || '',
        status: task.status as TaskStatus,
        priority: task.priority as TaskPriority,
        assigneeId: task.assigneeId || '',
        dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
        estimatedHours: task.estimatedHours?.toString() || '',
      })
      setIsEditTaskOpen(true)
    }
  }

  const openDeleteTask = (task: typeof selectedTask) => {
    setSelectedTask(task)
    setIsDeleteTaskOpen(true)
  }

  const openEditMember = (member: typeof selectedMember) => {
    if (member) {
      setSelectedMember(member)
      setMemberForm({
        employeeId: member.employeeId,
        role: member.role as MemberRole,
      })
      setIsEditMemberOpen(true)
    }
  }

  const openRemoveMember = (member: typeof selectedMember) => {
    setSelectedMember(member)
    setIsRemoveMemberOpen(true)
  }

  // Calculate statistics
  const calculateProjectStats = () => {
    if (!project) return { totalTasks: 0, completedTasks: 0, progress: 0 }

    let totalTasks = 0
    let completedTasks = 0

    project.phases.forEach((phase) => {
      phase.tasks.forEach((task) => {
        totalTasks++
        if (task.status === 'COMPLETED') completedTasks++
        // Count children as well
        task.children?.forEach((child) => {
          totalTasks++
          if (child.status === 'COMPLETED') completedTasks++
        })
      })
    })

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    return { totalTasks, completedTasks, progress }
  }

  const calculatePhaseProgress = (phase: { tasks: Array<{ status: string; children?: Array<{ status: string }> }> }) => {
    let totalTasks = 0
    let completedTasks = 0

    phase.tasks.forEach((task) => {
      totalTasks++
      if (task.status === 'COMPLETED') completedTasks++
      task.children?.forEach((child) => {
        totalTasks++
        if (child.status === 'COMPLETED') completedTasks++
      })
    })

    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  }

  // Get available employees for adding as members (exclude current members)
  const getAvailableEmployees = () => {
    if (!employees || !project) return []
    const currentMemberIds = new Set(project.members.map((m) => m.employee.id))
    return employees.filter((e) => !currentMemberIds.has(e.employee.id))
  }

  // Format date
  const formatDate = (date: Date | string | null) => {
    if (!date) return '-'
    return format(new Date(date), 'yyyy/MM/dd')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">專案不存在或無法載入</p>
        <Link href="/dashboard/projects">
          <Button variant="outline">返回專案列表</Button>
        </Link>
      </div>
    )
  }

  const stats = calculateProjectStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <Badge className={statusColors[project.status as ProjectStatus]} variant="secondary">
                {statusLabels[project.status as ProjectStatus]}
              </Badge>
              <Badge className={typeColors[project.type as ProjectType]} variant="secondary">
                {typeLabels[project.type as ProjectType]}
              </Badge>
            </div>
            <p className="text-muted-foreground">{project.company.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsSaveAsTemplateOpen(true)}>
            <Copy className="h-4 w-4 mr-2" />
            存為範本
          </Button>
          <Button variant="outline" onClick={openEditProject}>
            <Pencil className="h-4 w-4 mr-2" />
            編輯專案
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">部門</p>
                <p className="font-medium">{project.department?.name || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">負責人</p>
                <p className="font-medium">{project.manager?.name || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Layers className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">階段 / 任務</p>
                <p className="font-medium">
                  {project.phases.length} 階段 / {stats.totalTasks} 任務
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <CheckSquare className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">完成進度</p>
                <div className="flex items-center gap-2">
                  <Progress value={stats.progress} className="w-20 h-2" />
                  <span className="font-medium">{stats.progress}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Details */}
      {(project.description || project.customer || project.plannedStartDate || project.plannedEndDate) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              專案資訊
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">專案描述</p>
                <p>{project.description}</p>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {project.customer && (
                <div>
                  <p className="text-sm text-muted-foreground">客戶</p>
                  <p className="font-medium">{project.customer.name}</p>
                </div>
              )}
              {project.plannedStartDate && (
                <div>
                  <p className="text-sm text-muted-foreground">預計開始</p>
                  <p className="font-medium">{formatDate(project.plannedStartDate)}</p>
                </div>
              )}
              {project.plannedEndDate && (
                <div>
                  <p className="text-sm text-muted-foreground">預計完成</p>
                  <p className="font-medium">{formatDate(project.plannedEndDate)}</p>
                </div>
              )}
              {project.actualStartDate && (
                <div>
                  <p className="text-sm text-muted-foreground">實際開始</p>
                  <p className="font-medium">{formatDate(project.actualStartDate)}</p>
                </div>
              )}
              {project.actualEndDate && (
                <div>
                  <p className="text-sm text-muted-foreground">實際完成</p>
                  <p className="font-medium">{formatDate(project.actualEndDate)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="phases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="phases" className="gap-2">
            <Layers className="h-4 w-4" />
            階段與任務
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2">
            <Kanban className="h-4 w-4" />
            看板
          </TabsTrigger>
          <TabsTrigger value="gantt" className="gap-2">
            <GanttChart className="h-4 w-4" />
            甘特圖
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <PieChart className="h-4 w-4" />
            統計
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-2">
            <FileText className="h-4 w-4" />
            報表
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            成員 ({project.members.filter((m) => !m.leftAt).length})
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            討論
          </TabsTrigger>
          <TabsTrigger value="attachments" className="gap-2">
            <Paperclip className="h-4 w-4" />
            附件
          </TabsTrigger>
          <TabsTrigger value="team-status" className="gap-2">
            <UserCheck className="h-4 w-4" />
            團隊狀態
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            活動紀錄
          </TabsTrigger>
          <TabsTrigger value="reminders" className="gap-2">
            <Bell className="h-4 w-4" />
            提醒
          </TabsTrigger>
        </TabsList>

        {/* Phases & Tasks Tab */}
        <TabsContent value="phases" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">專案階段</h3>
            <Button onClick={() => setIsAddPhaseOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新增階段
            </Button>
          </div>

          {project.phases.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">尚無階段</p>
                  <p className="text-sm text-muted-foreground mb-4">建立專案階段來組織任務</p>
                  <Button onClick={() => setIsAddPhaseOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    新增第一個階段
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {project.phases.map((phase) => {
                const phaseProgress = calculatePhaseProgress(phase)
                const isExpanded = expandedPhases.has(phase.id)

                return (
                  <Card key={phase.id}>
                    <Collapsible open={isExpanded} onOpenChange={() => togglePhaseExpanded(phase.id)}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CollapsibleTrigger className="flex items-center gap-3 hover:opacity-80">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <CardTitle className="text-base">{phase.name}</CardTitle>
                            <Badge
                              className={phaseStatusColors[phase.status as PhaseStatus]}
                              variant="secondary"
                            >
                              {phaseStatusLabels[phase.status as PhaseStatus]}
                            </Badge>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 mr-4">
                              <Progress value={phaseProgress} className="w-24 h-2" />
                              <span className="text-sm text-muted-foreground">{phaseProgress}%</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditPhase(phase)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeletePhase(phase)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {phase.description && (
                          <p className="text-sm text-muted-foreground ml-7">{phase.description}</p>
                        )}
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="space-y-2 ml-7">
                            {phase.tasks.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4">此階段尚無任務</p>
                            ) : (
                              phase.tasks.map((task) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                                >
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{task.name}</span>
                                        <Badge
                                          className={taskStatusColors[task.status as TaskStatus]}
                                          variant="secondary"
                                        >
                                          {taskStatusLabels[task.status as TaskStatus]}
                                        </Badge>
                                        <Badge
                                          className={taskPriorityColors[task.priority as TaskPriority]}
                                          variant="secondary"
                                        >
                                          {taskPriorityLabels[task.priority as TaskPriority]}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                        {task.assignee && (
                                          <span className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {task.assignee.name}
                                          </span>
                                        )}
                                        {task.dueDate && (
                                          <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(task.dueDate)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Select
                                      value={task.status}
                                      onValueChange={(value) =>
                                        updateTask.mutate({
                                          id: task.id,
                                          status: value as TaskStatus,
                                          actorId: currentUserId,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="w-28 h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="TODO">待辦</SelectItem>
                                        <SelectItem value="IN_PROGRESS">進行中</SelectItem>
                                        <SelectItem value="COMPLETED">已完成</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        openEditTask({
                                          id: task.id,
                                          phaseId: phase.id,
                                          name: task.name,
                                          description: task.description,
                                          status: task.status,
                                          priority: task.priority,
                                          assigneeId: task.assignee?.id,
                                          dueDate: task.dueDate,
                                          estimatedHours: task.estimatedHours,
                                        })
                                      }
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        openDeleteTask({
                                          id: task.id,
                                          phaseId: phase.id,
                                          name: task.name,
                                          description: task.description,
                                          status: task.status,
                                          priority: task.priority,
                                          assigneeId: task.assignee?.id,
                                          dueDate: task.dueDate,
                                          estimatedHours: task.estimatedHours,
                                        })
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => openAddTask(phase.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              新增任務
                            </Button>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Kanban Tab */}
        <TabsContent value="kanban" className="space-y-4">
          <ProjectKanban
            tasks={project.phases.flatMap((phase) =>
              phase.tasks.map((task) => ({
                id: task.id,
                name: task.name,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                estimatedHours: task.estimatedHours,
                assignee: task.assignee,
                phase: {
                  id: phase.id,
                  name: phase.name,
                },
              }))
            )}
            onTaskStatusChange={(taskId, newStatus) => {
              updateTask.mutate({
                id: taskId,
                status: newStatus,
                actorId: currentUserId,
              })
            }}
            onAddTask={(phaseId) => openAddTask(phaseId)}
            isUpdating={updateTask.isPending}
            phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
          />
        </TabsContent>

        {/* Gantt Tab */}
        <TabsContent value="gantt" className="space-y-4">
          <ProjectGantt
            projectName={project.name}
            plannedStartDate={project.plannedStartDate}
            plannedEndDate={project.plannedEndDate}
            phases={project.phases.map((phase) => ({
              id: phase.id,
              name: phase.name,
              status: phase.status,
              plannedEndDate: phase.plannedEndDate,
              tasks: phase.tasks.map((task) => ({
                id: task.id,
                name: task.name,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                estimatedHours: task.estimatedHours,
                assignee: task.assignee,
              })),
            }))}
          />
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <ProjectStats
            projectName={project.name}
            projectStatus={project.status}
            plannedStartDate={project.plannedStartDate}
            plannedEndDate={project.plannedEndDate}
            actualStartDate={project.actualStartDate}
            phases={project.phases.map((phase) => ({
              id: phase.id,
              name: phase.name,
              status: phase.status,
              plannedEndDate: phase.plannedEndDate,
              tasks: phase.tasks.map((task) => ({
                id: task.id,
                name: task.name,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                estimatedHours: task.estimatedHours,
                assignee: task.assignee,
              })),
            }))}
            members={project.members}
          />
        </TabsContent>

        {/* Report Tab */}
        <TabsContent value="report" className="space-y-4">
          <ProjectReport
            projectName={project.name}
            projectStatus={project.status}
            projectType={project.type}
            companyName={project.company.name}
            departmentName={project.department?.name}
            managerName={project.manager?.name}
            plannedStartDate={project.plannedStartDate}
            plannedEndDate={project.plannedEndDate}
            actualStartDate={project.actualStartDate}
            createdAt={project.createdAt}
            phases={project.phases.map((phase) => ({
              id: phase.id,
              name: phase.name,
              status: phase.status,
              plannedEndDate: phase.plannedEndDate,
              tasks: phase.tasks.map((task) => ({
                id: task.id,
                name: task.name,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                estimatedHours: task.estimatedHours,
                assignee: task.assignee,
              })),
            }))}
            members={project.members.map((m) => ({
              employeeId: m.employee.id,
              employee: {
                id: m.employee.id,
                name: m.employee.name,
                employeeNo: m.employee.employeeNo,
              },
              role: m.role,
              leftAt: m.leftAt,
            }))}
          />
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">專案成員</h3>
            <Button onClick={() => setIsAddMemberOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              新增成員
            </Button>
          </div>

          {project.members.filter((m) => !m.leftAt).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">尚無成員</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {project.members
                .filter((m) => !m.leftAt)
                .map((member) => (
                  <Card key={member.employee.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{member.employee.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {member.employee.employeeNo}
                            </p>
                            <Badge variant="outline" className="mt-1">
                              {memberRoleLabels[member.role as MemberRole]}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              openEditMember({
                                employeeId: member.employee.id,
                                name: member.employee.name,
                                role: member.role,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              openRemoveMember({
                                employeeId: member.employee.id,
                                name: member.employee.name,
                                role: member.role,
                              })
                            }
                          >
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-4">
          <ProjectComments
            projectId={projectId}
            currentUserId={currentUserId}
            members={project.members.filter((m) => !m.leftAt)}
          />
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments" className="space-y-4">
          <ProjectAttachments
            projectId={projectId}
            currentUserId={currentUserId}
          />
        </TabsContent>

        {/* Team Status Tab */}
        <TabsContent value="team-status" className="space-y-4">
          <ProjectTeamAvailability projectId={projectId} />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <ProjectActivities projectId={projectId} />
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-4">
          <ProjectReminders
            projectId={projectId}
            employeeId={currentUserId}
            companyId={companyId}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Project Dialog */}
      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯專案</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>專案名稱</Label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>專案描述</Label>
              <Textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>狀態</Label>
              <Select
                value={projectForm.status}
                onValueChange={(value) =>
                  setProjectForm({ ...projectForm, status: value as ProjectStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNING">規劃中</SelectItem>
                  <SelectItem value="IN_PROGRESS">進行中</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditProjectOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                updateProject.mutate({
                  id: projectId,
                  name: projectForm.name,
                  description: projectForm.description,
                  status: projectForm.status,
                  updatedById: currentUserId,
                })
              }
              disabled={updateProject.isPending}
            >
              {updateProject.isPending ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Phase Dialog */}
      <Dialog open={isAddPhaseOpen} onOpenChange={setIsAddPhaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增階段</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>階段名稱 *</Label>
              <Input
                value={phaseForm.name}
                onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}
                placeholder="例如：需求分析、設計階段"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={phaseForm.description}
                onChange={(e) => setPhaseForm({ ...phaseForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>預計完成日期</Label>
              <Input
                type="date"
                value={phaseForm.plannedEndDate}
                onChange={(e) => setPhaseForm({ ...phaseForm, plannedEndDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPhaseOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                createPhase.mutate({
                  projectId,
                  name: phaseForm.name,
                  description: phaseForm.description || undefined,
                  plannedEndDate: phaseForm.plannedEndDate
                    ? new Date(phaseForm.plannedEndDate)
                    : undefined,
                  actorId: currentUserId,
                })
              }
              disabled={!phaseForm.name || createPhase.isPending}
            >
              {createPhase.isPending ? '新增中...' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Phase Dialog */}
      <Dialog open={isEditPhaseOpen} onOpenChange={setIsEditPhaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯階段</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>階段名稱 *</Label>
              <Input
                value={phaseForm.name}
                onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={phaseForm.description}
                onChange={(e) => setPhaseForm({ ...phaseForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>狀態</Label>
              <Select
                value={phaseForm.status}
                onValueChange={(value) =>
                  setPhaseForm({ ...phaseForm, status: value as PhaseStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">未開始</SelectItem>
                  <SelectItem value="IN_PROGRESS">進行中</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>預計完成日期</Label>
              <Input
                type="date"
                value={phaseForm.plannedEndDate}
                onChange={(e) => setPhaseForm({ ...phaseForm, plannedEndDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPhaseOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                selectedPhase &&
                updatePhase.mutate({
                  id: selectedPhase.id,
                  name: phaseForm.name,
                  description: phaseForm.description || undefined,
                  status: phaseForm.status,
                  plannedEndDate: phaseForm.plannedEndDate
                    ? new Date(phaseForm.plannedEndDate)
                    : null,
                  actorId: currentUserId,
                })
              }
              disabled={!phaseForm.name || updatePhase.isPending}
            >
              {updatePhase.isPending ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Phase Dialog */}
      <AlertDialog open={isDeletePhaseOpen} onOpenChange={setIsDeletePhaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除階段</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除階段「{selectedPhase?.name}」嗎？此操作將同時刪除該階段下的所有任務，且無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                selectedPhase &&
                deletePhase.mutate({
                  id: selectedPhase.id,
                  actorId: currentUserId,
                })
              }
            >
              {deletePhase.isPending ? '刪除中...' : '確定刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增任務</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>任務名稱 *</Label>
              <Input
                value={taskForm.name}
                onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                placeholder="任務名稱"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>優先級</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(value) =>
                    setTaskForm({ ...taskForm, priority: value as TaskPriority })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">高</SelectItem>
                    <SelectItem value="MEDIUM">中</SelectItem>
                    <SelectItem value="LOW">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>指派給</Label>
                <Select
                  value={taskForm.assigneeId}
                  onValueChange={(value) => setTaskForm({ ...taskForm, assigneeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇成員" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">未指派</SelectItem>
                    {project.members
                      .filter((m) => !m.leftAt)
                      .map((member) => (
                        <SelectItem key={member.employee.id} value={member.employee.id}>
                          {member.employee.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>截止日期</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>預估工時 (小時)</Label>
                <Input
                  type="number"
                  value={taskForm.estimatedHours}
                  onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })}
                  placeholder="例如：8"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                createTask.mutate({
                  phaseId: selectedPhaseIdForTask,
                  name: taskForm.name,
                  description: taskForm.description || undefined,
                  priority: taskForm.priority,
                  assigneeId: taskForm.assigneeId || undefined,
                  dueDate: taskForm.dueDate ? new Date(taskForm.dueDate) : undefined,
                  estimatedHours: taskForm.estimatedHours
                    ? parseFloat(taskForm.estimatedHours)
                    : undefined,
                  actorId: currentUserId,
                })
              }
              disabled={!taskForm.name || createTask.isPending}
            >
              {createTask.isPending ? '新增中...' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditTaskOpen} onOpenChange={setIsEditTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯任務</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>任務名稱 *</Label>
              <Input
                value={taskForm.name}
                onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>狀態</Label>
                <Select
                  value={taskForm.status}
                  onValueChange={(value) =>
                    setTaskForm({ ...taskForm, status: value as TaskStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">待辦</SelectItem>
                    <SelectItem value="IN_PROGRESS">進行中</SelectItem>
                    <SelectItem value="COMPLETED">已完成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>優先級</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(value) =>
                    setTaskForm({ ...taskForm, priority: value as TaskPriority })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">高</SelectItem>
                    <SelectItem value="MEDIUM">中</SelectItem>
                    <SelectItem value="LOW">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>指派給</Label>
                <Select
                  value={taskForm.assigneeId}
                  onValueChange={(value) => setTaskForm({ ...taskForm, assigneeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇成員" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">未指派</SelectItem>
                    {project.members
                      .filter((m) => !m.leftAt)
                      .map((member) => (
                        <SelectItem key={member.employee.id} value={member.employee.id}>
                          {member.employee.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>截止日期</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>預估工時 (小時)</Label>
                <Input
                  type="number"
                  value={taskForm.estimatedHours}
                  onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTaskOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                selectedTask &&
                updateTask.mutate({
                  id: selectedTask.id,
                  name: taskForm.name,
                  description: taskForm.description || undefined,
                  status: taskForm.status,
                  priority: taskForm.priority,
                  assigneeId: taskForm.assigneeId || null,
                  dueDate: taskForm.dueDate ? new Date(taskForm.dueDate) : null,
                  estimatedHours: taskForm.estimatedHours
                    ? parseFloat(taskForm.estimatedHours)
                    : null,
                  actorId: currentUserId,
                })
              }
              disabled={!taskForm.name || updateTask.isPending}
            >
              {updateTask.isPending ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Task Dialog */}
      <AlertDialog open={isDeleteTaskOpen} onOpenChange={setIsDeleteTaskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除任務</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除任務「{selectedTask?.name}」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                selectedTask &&
                deleteTask.mutate({
                  id: selectedTask.id,
                  actorId: currentUserId,
                })
              }
            >
              {deleteTask.isPending ? '刪除中...' : '確定刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增成員</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>選擇員工 *</Label>
              <Select
                value={memberForm.employeeId}
                onValueChange={(value) => setMemberForm({ ...memberForm, employeeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇員工" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableEmployees().map((emp) => (
                    <SelectItem key={emp.employee.id} value={emp.employee.id}>
                      {emp.employee.name} ({emp.employee.employeeNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={memberForm.role}
                onValueChange={(value) =>
                  setMemberForm({ ...memberForm, role: value as MemberRole })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">專案經理</SelectItem>
                  <SelectItem value="MEMBER">成員</SelectItem>
                  <SelectItem value="OBSERVER">觀察者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddMemberOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                addMember.mutate({
                  projectId,
                  employeeId: memberForm.employeeId,
                  role: memberForm.role,
                  actorId: currentUserId,
                })
              }
              disabled={!memberForm.employeeId || addMember.isPending}
            >
              {addMember.isPending ? '新增中...' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Role Dialog */}
      <Dialog open={isEditMemberOpen} onOpenChange={setIsEditMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>變更成員角色</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              變更「{selectedMember?.name}」的角色
            </p>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={memberForm.role}
                onValueChange={(value) =>
                  setMemberForm({ ...memberForm, role: value as MemberRole })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">專案經理</SelectItem>
                  <SelectItem value="MEMBER">成員</SelectItem>
                  <SelectItem value="OBSERVER">觀察者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditMemberOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                selectedMember &&
                updateMemberRole.mutate({
                  projectId,
                  employeeId: selectedMember.employeeId,
                  role: memberForm.role,
                  actorId: currentUserId,
                })
              }
              disabled={updateMemberRole.isPending}
            >
              {updateMemberRole.isPending ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={isRemoveMemberOpen} onOpenChange={setIsRemoveMemberOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除成員</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將「{selectedMember?.name}」從專案中移除嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                selectedMember &&
                removeMember.mutate({
                  projectId,
                  employeeId: selectedMember.employeeId,
                  actorId: currentUserId,
                })
              }
            >
              {removeMember.isPending ? '移除中...' : '確定移除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save as Template Dialog */}
      <Dialog open={isSaveAsTemplateOpen} onOpenChange={setIsSaveAsTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>存為專案範本</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>範本名稱</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="輸入範本名稱"
              />
            </div>
            <div className="space-y-2">
              <Label>分類</Label>
              <Input
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                placeholder="例：軟體開發、行銷活動"
              />
            </div>
            <div className="space-y-2">
              <Label>標籤（以逗號分隔）</Label>
              <Input
                value={templateTags}
                onChange={(e) => setTemplateTags(e.target.value)}
                placeholder="例：敏捷, MVP, 快速"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              將保存專案的所有階段與任務結構作為範本，不包含實際資料和成員。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveAsTemplateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                createTemplateFromProject.mutate({
                  projectId,
                  name: templateName,
                  category: templateCategory || undefined,
                  createdById: currentUserId,
                  tags: templateTags ? templateTags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
                })
              }}
              disabled={!templateName || createTemplateFromProject.isPending}
            >
              {createTemplateFromProject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              儲存範本
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
