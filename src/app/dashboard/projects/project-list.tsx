'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  Layers,
  Building2,
  User,
  Loader2,
  ArrowLeft,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface ProjectListProps {
  companyId: string
  companyName: string
  currentUserId: string
}

type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type ProjectType = 'INTERNAL' | 'CLIENT'
type ViewMode = 'grid' | 'list'
type SortField = 'name' | 'status' | 'type' | 'createdAt' | 'manager' | 'members'
type SortOrder = 'asc' | 'desc'

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

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function ProjectList({ companyId, companyName }: ProjectListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const { data: projects, isLoading } = trpc.project.list.useQuery({
    companyId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
    search: search || undefined,
  })

  // Sort projects
  const sortedProjects = useMemo(() => {
    if (!projects) return []

    return [...projects].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-TW')
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'manager':
          const managerA = a.manager?.name || ''
          const managerB = b.manager?.name || ''
          comparison = managerA.localeCompare(managerB, 'zh-TW')
          break
        case 'members':
          comparison = a._count.members - b._count.members
          break
        default:
          comparison = 0
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [projects, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    )
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">專案管理</h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Link href="/dashboard/projects/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新增專案
            </Button>
          </Link>
        </div>
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

      {/* No Projects */}
      {!sortedProjects || sortedProjects.length === 0 ? (
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
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project) => (
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
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>建立：{formatDate(project.createdAt)}</span>
                    </div>
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
      ) : (
        /* List View */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('name')}
                  >
                    專案名稱
                    <SortIcon field="name" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('status')}
                  >
                    狀態
                    <SortIcon field="status" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('type')}
                  >
                    類型
                    <SortIcon field="type" />
                  </Button>
                </TableHead>
                <TableHead>部門</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('manager')}
                  >
                    負責人
                    <SortIcon field="manager" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('members')}
                  >
                    成員
                    <SortIcon field="members" />
                  </Button>
                </TableHead>
                <TableHead>階段</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('createdAt')}
                  >
                    建立日期
                    <SortIcon field="createdAt" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="max-w-[200px] truncate">{project.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={statusColors[project.status as ProjectStatus]}
                      variant="secondary"
                    >
                      {statusLabels[project.status as ProjectStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={typeColors[project.type as ProjectType]}
                      variant="secondary"
                    >
                      {typeLabels[project.type as ProjectType]}
                    </Badge>
                  </TableCell>
                  <TableCell>{project.department?.name || '-'}</TableCell>
                  <TableCell>{project.manager?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {project._count.members}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      {project._count.phases}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(project.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
