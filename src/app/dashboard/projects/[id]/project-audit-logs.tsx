'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Shield,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Eye,
  User,
  BarChart3,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface ProjectAuditLogsProps {
  projectId: string
}

const actionLabels: Record<string, string> = {
  CREATE: '建立',
  UPDATE: '更新',
  DELETE: '刪除',
  STATUS_CHANGE: '狀態變更',
  MEMBER_ADD: '新增成員',
  MEMBER_REMOVE: '移除成員',
  PHASE_CREATE: '建立階段',
  PHASE_UPDATE: '更新階段',
  TASK_CREATE: '建立任務',
  TASK_UPDATE: '更新任務',
  TASK_STATUS_CHANGE: '任務狀態變更',
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  STATUS_CHANGE: 'bg-purple-100 text-purple-800',
  MEMBER_ADD: 'bg-green-100 text-green-800',
  MEMBER_REMOVE: 'bg-orange-100 text-orange-800',
  PHASE_CREATE: 'bg-green-100 text-green-800',
  PHASE_UPDATE: 'bg-blue-100 text-blue-800',
  TASK_CREATE: 'bg-green-100 text-green-800',
  TASK_UPDATE: 'bg-blue-100 text-blue-800',
  TASK_STATUS_CHANGE: 'bg-purple-100 text-purple-800',
}

const targetTypeLabels: Record<string, string> = {
  PROJECT: '專案',
  PHASE: '階段',
  TASK: '任務',
  MEMBER: '成員',
  COMMENT: '評論',
  ATTACHMENT: '附件',
}

const PAGE_SIZE = 20

export function ProjectAuditLogs({ projectId }: ProjectAuditLogsProps) {
  const [page, setPage] = useState(0)
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<{
    beforeData: unknown
    afterData: unknown
    action: string
  } | null>(null)

  const { data, isLoading } = trpc.project.getAuditLogs.useQuery({
    projectId,
    action: actionFilter === 'all' ? undefined : actionFilter,
    targetType: targetTypeFilter === 'all' ? undefined : targetTypeFilter,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })

  const { data: stats, isLoading: isStatsLoading } = trpc.project.getAuditStats.useQuery({
    projectId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {!isStatsLoading && stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                總紀錄數
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLogs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                操作類型分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {stats.byAction.slice(0, 5).map(item => (
                  <Badge key={item.action} variant="outline" className="text-xs">
                    {actionLabels[item.action] || item.action}: {item.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                最活躍使用者
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {stats.byActor.slice(0, 3).map(item => (
                  <Badge key={item.actorId} variant="outline" className="text-xs">
                    {item.actorName}: {item.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              稽核紀錄
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0) }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="操作類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部操作</SelectItem>
                  <SelectItem value="CREATE">建立</SelectItem>
                  <SelectItem value="UPDATE">更新</SelectItem>
                  <SelectItem value="DELETE">刪除</SelectItem>
                  <SelectItem value="STATUS_CHANGE">狀態變更</SelectItem>
                  <SelectItem value="MEMBER_ADD">新增成員</SelectItem>
                  <SelectItem value="MEMBER_REMOVE">移除成員</SelectItem>
                </SelectContent>
              </Select>

              <Select value={targetTypeFilter} onValueChange={v => { setTargetTypeFilter(v); setPage(0) }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="目標類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部目標</SelectItem>
                  <SelectItem value="PROJECT">專案</SelectItem>
                  <SelectItem value="PHASE">階段</SelectItem>
                  <SelectItem value="TASK">任務</SelectItem>
                  <SelectItem value="MEMBER">成員</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!data?.logs || data.logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>尚無稽核紀錄</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>時間</TableHead>
                      <TableHead>操作者</TableHead>
                      <TableHead>操作</TableHead>
                      <TableHead>目標類型</TableHead>
                      <TableHead>詳情</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.createdAt), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-3 w-3" />
                            </div>
                            <span>{log.actor.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={actionColors[log.action] || 'bg-gray-100 text-gray-800'}>
                            {actionLabels[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {targetTypeLabels[log.targetType] || log.targetType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(log.beforeData || log.afterData) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog({
                                beforeData: log.beforeData,
                                afterData: log.afterData,
                                action: log.action,
                              })}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              檢視
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  共 {data.total} 筆紀錄
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    第 {page + 1} / {totalPages || 1} 頁
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              變更詳情
              {selectedLog && (
                <Badge className={actionColors[selectedLog.action] || 'bg-gray-100'}>
                  {actionLabels[selectedLog.action] || selectedLog.action}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2 text-red-600">變更前</h4>
                <ScrollArea className="h-[300px] border rounded-lg p-3 bg-red-50/50">
                  <pre className="text-xs whitespace-pre-wrap">
                    {selectedLog.beforeData
                      ? JSON.stringify(selectedLog.beforeData, null, 2)
                      : '(無)'}
                  </pre>
                </ScrollArea>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-green-600">變更後</h4>
                <ScrollArea className="h-[300px] border rounded-lg p-3 bg-green-50/50">
                  <pre className="text-xs whitespace-pre-wrap">
                    {selectedLog.afterData
                      ? JSON.stringify(selectedLog.afterData, null, 2)
                      : '(無)'}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
