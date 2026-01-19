'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  Layers,
  Building2,
  User,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface ProjectListProps {
  companyId: string
  companyName: string
  currentUserId: string
}

type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type ProjectType = 'INTERNAL' | 'CLIENT'

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

export function ProjectList({ companyId, companyName }: ProjectListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all')

  const { data: projects, isLoading } = trpc.project.list.useQuery({
    companyId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
    search: search || undefined,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">專案管理</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增專案
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋專案名稱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ProjectStatus | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="專案狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有狀態</SelectItem>
            <SelectItem value="PLANNING">規劃中</SelectItem>
            <SelectItem value="IN_PROGRESS">進行中</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="CANCELLED">已取消</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as ProjectType | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="專案類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有類型</SelectItem>
            <SelectItem value="INTERNAL">內部專案</SelectItem>
            <SelectItem value="CLIENT">客戶專案</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Project Grid */}
      {!projects || projects.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">尚無專案</h3>
              <p className="text-muted-foreground mb-6">
                建立您的第一個專案，開始管理任務與團隊
              </p>
              <Link href="/dashboard/projects/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  建立第一個專案
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="block"
            >
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">
                      {project.name}
                    </CardTitle>
                  </div>
                  <div className="flex gap-2 flex-wrap mt-2">
                    <Badge
                      className={statusColors[project.status as ProjectStatus]}
                      variant="secondary"
                    >
                      {statusLabels[project.status as ProjectStatus]}
                    </Badge>
                    <Badge
                      className={typeColors[project.type as ProjectType]}
                      variant="secondary"
                    >
                      {typeLabels[project.type as ProjectType]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {project.description && (
                    <p className="text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    {project.department && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{project.department.name}</span>
                      </div>
                    )}
                    {project.manager && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>負責人：{project.manager.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{project._count.members} 成員</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Layers className="h-4 w-4" />
                        <span>{project._count.phases} 階段</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
