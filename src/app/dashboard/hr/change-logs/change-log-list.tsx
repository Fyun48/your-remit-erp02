'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  ArrowLeft,
  History,
  Search,
  Trash2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface ChangeLogListProps {
  userId: string
  canDelete: boolean
}

const changeTypeOptions = [
  { value: 'ONBOARD', label: '入職' },
  { value: 'OFFBOARD', label: '離職' },
  { value: 'REINSTATE', label: '復職' },
  { value: 'TRANSFER', label: '調動' },
  { value: 'ON_LEAVE', label: '留停' },
  { value: 'RETURN_FROM_LEAVE', label: '留停復職' },
]

const changeTypeBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ONBOARD: 'default',
  OFFBOARD: 'destructive',
  REINSTATE: 'default',
  TRANSFER: 'secondary',
  ON_LEAVE: 'outline',
  RETURN_FROM_LEAVE: 'secondary',
}

export function ChangeLogList({ userId, canDelete }: ChangeLogListProps) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState<'changeDate' | 'createdAt' | 'employeeNo' | 'employeeName' | 'changeType'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const pageSize = 20

  const { data, isLoading, refetch } = trpc.changeLog.list.useQuery({
    changeTypes: filterType ? [filterType as 'ONBOARD' | 'OFFBOARD' | 'REINSTATE' | 'TRANSFER' | 'ON_LEAVE' | 'RETURN_FROM_LEAVE'] : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    employeeSearch: search || undefined,
    sortBy,
    sortOrder,
    page,
    pageSize,
  })

  const deleteMutation = trpc.changeLog.delete.useMutation({
    onSuccess: () => {
      setDeleteId(null)
      refetch()
    },
    onError: (error) => {
      alert(error.message)
      setDeleteId(null)
    },
  })

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId, userId })
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const SortableHeader = ({ column, children }: { column: typeof sortBy; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-4 w-4 ${sortBy === column ? 'opacity-100' : 'opacity-30'}`} />
      </div>
    </TableHead>
  )

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hr">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">員工異動紀錄</h1>
          </div>
        </div>
      </div>

      {/* 篩選區 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋員工編號、姓名..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1) }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="異動類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部類型</SelectItem>
                {changeTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="w-[140px]"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="w-[140px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>異動紀錄列表</span>
            {data && (
              <Badge variant="secondary">共 {data.total} 筆</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : !data || data.logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暫無異動紀錄
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader column="employeeNo">員工編號</SortableHeader>
                    <SortableHeader column="employeeName">員工姓名</SortableHeader>
                    <SortableHeader column="changeType">異動類型</SortableHeader>
                    <SortableHeader column="changeDate">異動日期</SortableHeader>
                    <TableHead>原部門</TableHead>
                    <TableHead>新部門</TableHead>
                    <TableHead>原職位</TableHead>
                    <TableHead>新職位</TableHead>
                    <TableHead>操作人</TableHead>
                    <SortableHeader column="createdAt">建立時間</SortableHeader>
                    {canDelete && <TableHead className="w-[80px]">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono">{log.employee.employeeNo}</TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/hr/employees/${log.employee.id}`}
                          className="hover:underline text-primary"
                        >
                          {log.employee.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={changeTypeBadgeVariant[log.changeType] || 'default'}>
                          {log.changeTypeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(log.changeDate)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.fromDepartment || '-'}
                      </TableCell>
                      <TableCell>{log.toDepartment || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.fromPosition || '-'}
                      </TableCell>
                      <TableCell>{log.toPosition || '-'}</TableCell>
                      <TableCell>{log.createdBy?.name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      {canDelete && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(log.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分頁 */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    第 {data.page} / {data.totalPages} 頁
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一頁
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= data.totalPages}
                    >
                      下一頁
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 刪除確認 Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除這筆異動紀錄嗎？此操作無法復原且不會被系統記錄。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
