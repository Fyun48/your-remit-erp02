'use client'

import { useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Printer,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { format, differenceInDays, isPast } from 'date-fns'
import { zhTW } from 'date-fns/locale'

type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW'

interface Task {
  id: string
  name: string
  status: string
  priority: string
  dueDate?: Date | null
  estimatedHours?: number | null
  assignee?: {
    id: string
    name: string
  } | null
}

interface Phase {
  id: string
  name: string
  status: string
  plannedEndDate?: Date | null
  tasks: Task[]
}

interface Member {
  employeeId: string
  employee: {
    id: string
    name: string
    employeeNo: string
  }
  role: string
  leftAt?: Date | null
}

interface ProjectReportProps {
  projectName: string
  projectStatus: string
  projectType: string
  companyName: string
  departmentName?: string
  managerName?: string
  plannedStartDate?: Date | null
  plannedEndDate?: Date | null
  actualStartDate?: Date | null
  createdAt: Date
  phases: Phase[]
  members: Member[]
}

const statusLabels: Record<string, string> = {
  PLANNING: '規劃中',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  PENDING: '未開始',
  TODO: '待辦',
}

const priorityLabels: Record<TaskPriority, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
}

const roleLabels: Record<string, string> = {
  MANAGER: '專案經理',
  MEMBER: '成員',
  OBSERVER: '觀察者',
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return '-'
  return format(new Date(date), 'yyyy/MM/dd', { locale: zhTW })
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function ProjectReport({
  projectName,
  projectStatus,
  projectType,
  companyName,
  departmentName,
  managerName,
  plannedStartDate,
  plannedEndDate,
  actualStartDate,
  createdAt,
  phases,
  members,
}: ProjectReportProps) {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const reportRef = useRef<HTMLDivElement>(null)

  const stats = useMemo(() => {
    let totalTasks = 0
    let todoTasks = 0
    let inProgressTasks = 0
    let completedTasks = 0
    let overdueTasks = 0
    let totalEstimatedHours = 0

    phases.forEach((phase) => {
      phase.tasks.forEach((task) => {
        totalTasks++
        if (task.status === 'TODO') todoTasks++
        if (task.status === 'IN_PROGRESS') inProgressTasks++
        if (task.status === 'COMPLETED') completedTasks++
        if (task.estimatedHours) totalEstimatedHours += task.estimatedHours
        if (task.dueDate && task.status !== 'COMPLETED' && isPast(new Date(task.dueDate))) {
          overdueTasks++
        }
      })
    })

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    let daysRemaining = null
    if (plannedEndDate) {
      daysRemaining = differenceInDays(new Date(plannedEndDate), new Date())
    }

    return {
      totalTasks,
      todoTasks,
      inProgressTasks,
      completedTasks,
      overdueTasks,
      totalEstimatedHours,
      completionRate,
      daysRemaining,
      totalPhases: phases.length,
      completedPhases: phases.filter((p) => p.status === 'COMPLETED').length,
      activeMembers: members.filter((m) => !m.leftAt).length,
    }
  }, [phases, members, plannedEndDate])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Actions - hidden in print */}
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-lg font-semibold">專案報表</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            列印報表
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="space-y-6 print:p-8">
        {/* Header */}
        <div className="text-center border-b pb-6">
          <h1 className="text-2xl font-bold mb-2">{projectName}</h1>
          <p className="text-muted-foreground">專案進度報表</p>
          <p className="text-sm text-muted-foreground mt-2">
            報表產生日期：{format(new Date(), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })}
          </p>
        </div>

        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle>專案基本資訊</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">公司</p>
                <p className="font-medium">{companyName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">部門</p>
                <p className="font-medium">{departmentName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">負責人</p>
                <p className="font-medium">{managerName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">專案狀態</p>
                <Badge variant="outline">{statusLabels[projectStatus] || projectStatus}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">預計開始</p>
                <p className="font-medium">{formatDate(plannedStartDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">預計完成</p>
                <p className="font-medium">{formatDate(plannedEndDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">實際開始</p>
                <p className="font-medium">{formatDate(actualStartDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">專案建立</p>
                <p className="font-medium">{formatDate(createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle>進度摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary">{stats.completionRate}%</div>
                <p className="text-sm text-muted-foreground mt-1">整體完成率</p>
                <Progress value={stats.completionRate} className="mt-2" />
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold">{stats.completedTasks}/{stats.totalTasks}</div>
                <p className="text-sm text-muted-foreground mt-1">任務完成</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold">{stats.completedPhases}/{stats.totalPhases}</div>
                <p className="text-sm text-muted-foreground mt-1">階段完成</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold">
                  {stats.daysRemaining !== null ? (
                    stats.daysRemaining >= 0 ? stats.daysRemaining : '逾期'
                  ) : '-'}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.daysRemaining !== null && stats.daysRemaining >= 0 ? '剩餘天數' : '天'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Clock className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-muted-foreground">待辦任務</p>
                  <p className="text-xl font-bold">{stats.todoTasks}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">進行中</p>
                  <p className="text-xl font-bold">{stats.inProgressTasks}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">逾期任務</p>
                  <p className="text-xl font-bold text-red-600">{stats.overdueTasks}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase Details */}
        <Card>
          <CardHeader>
            <CardTitle>階段詳情</CardTitle>
          </CardHeader>
          <CardContent>
            {phases.length === 0 ? (
              <p className="text-muted-foreground">尚無階段</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>階段名稱</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>預計完成</TableHead>
                    <TableHead className="text-center">任務數</TableHead>
                    <TableHead className="text-center">完成率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phases.map((phase) => {
                    const phaseTasks = phase.tasks.length
                    const phaseCompleted = phase.tasks.filter((t) => t.status === 'COMPLETED').length
                    const phaseProgress = phaseTasks > 0 ? Math.round((phaseCompleted / phaseTasks) * 100) : 0

                    return (
                      <TableRow key={phase.id}>
                        <TableCell className="font-medium">{phase.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {statusLabels[phase.status] || phase.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(phase.plannedEndDate)}</TableCell>
                        <TableCell className="text-center">{phaseTasks}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={phaseProgress} className="w-16 h-2" />
                            <span className="text-sm">{phaseProgress}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Task List */}
        <Card>
          <CardHeader>
            <CardTitle>任務清單</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.totalTasks === 0 ? (
              <p className="text-muted-foreground">尚無任務</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任務名稱</TableHead>
                    <TableHead>所屬階段</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>優先級</TableHead>
                    <TableHead>指派人員</TableHead>
                    <TableHead>截止日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phases.flatMap((phase) =>
                    phase.tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.name}</TableCell>
                        <TableCell>{phase.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {statusLabels[task.status] || task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{priorityLabels[task.priority as TaskPriority]}</TableCell>
                        <TableCell>{task.assignee?.name || '-'}</TableCell>
                        <TableCell>
                          {task.dueDate ? (
                            <span className={isPast(new Date(task.dueDate)) && task.status !== 'COMPLETED' ? 'text-red-600' : ''}>
                              {formatDate(task.dueDate)}
                            </span>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>專案成員</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-muted-foreground">尚無成員</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>員工編號</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>狀態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.employeeId}>
                      <TableCell className="font-medium">{member.employee.name}</TableCell>
                      <TableCell>{member.employee.employeeNo}</TableCell>
                      <TableCell>{roleLabels[member.role] || member.role}</TableCell>
                      <TableCell>
                        {member.leftAt ? (
                          <Badge variant="outline" className="text-muted-foreground">已離開</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600">活躍</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground border-t pt-4 print:mt-8">
          <p>此報表由系統自動產生</p>
          <p>© {new Date().getFullYear()} {companyName}</p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:p-8,
          .print\\:p-8 * {
            visibility: visible;
          }
          .print\\:p-8 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  )
}
