'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  FileText,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Settings,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface AuditLogListProps {
  userId: string
}

const actionLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CREATE: { label: '新增', icon: <Plus className="h-3 w-3" />, color: 'bg-green-500' },
  UPDATE: { label: '修改', icon: <Pencil className="h-3 w-3" />, color: 'bg-blue-500' },
  DELETE: { label: '刪除', icon: <Trash2 className="h-3 w-3" />, color: 'bg-red-500' },
}

const entityTypeLabels: Record<string, string> = {
  Employee: '員工',
  Department: '部門',
  Position: '職位',
  Company: '公司',
  Group: '集團',
  GroupPermission: '集團權限',
  Customer: '客戶',
  Vendor: '供應商',
  Voucher: '傳票',
  VoucherLine: '傳票分錄',
  AccountChart: '會計科目',
  AccountingPeriod: '會計期間',
  LeaveRequest: '請假申請',
  ExpenseRequest: '費用報銷',
  AttendanceRecord: '出勤紀錄',
  ApprovalFlow: '審批流程',
}

export function AuditLogList({ userId }: AuditLogListProps) {
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState<string>('all')
  const [action, setAction] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

  const logsQuery = trpc.auditLog.list.useQuery({
    userId,
    entityType: entityType === 'all' ? undefined : entityType,
    action: action === 'all' ? undefined : action as 'CREATE' | 'UPDATE' | 'DELETE',
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
    page,
    pageSize: 20,
  })

  const entityTypesQuery = trpc.auditLog.getEntityTypes.useQuery({ userId })
  const statsQuery = trpc.auditLog.getStats.useQuery({ userId, days: 7 })

  const detailQuery = trpc.auditLog.getById.useQuery(
    { userId, id: selectedLogId || '' },
    { enabled: !!selectedLogId }
  )

  const handleViewDetail = (logId: string) => {
    setSelectedLogId(logId)
    setShowDetailDialog(true)
  }

  // 載入中狀態
  if (logsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/system">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">稽核日誌</h1>
              <p className="text-muted-foreground">查看系統操作紀錄</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // 錯誤狀態
  if (logsQuery.error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/system">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">稽核日誌</h1>
              <p className="text-muted-foreground">查看系統操作紀錄</p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-lg font-medium text-red-600">載入失敗</p>
              <p className="text-sm text-muted-foreground mt-2">{logsQuery.error.message}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => logsQuery.refetch()}
              >
                重試
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/system">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">稽核日誌</h1>
            <p className="text-muted-foreground">查看系統操作紀錄</p>
          </div>
        </div>
        <Link href="/dashboard/system/audit-settings">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            稽核設定
          </Button>
        </Link>
      </div>

      {/* 統計卡片 */}
      {statsQuery.data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">近 7 日操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsQuery.data.totalLogs}</div>
              <p className="text-xs text-muted-foreground">筆紀錄</p>
            </CardContent>
          </Card>
          {statsQuery.data.byAction.map((item) => (
            <Card key={item.action}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {actionLabels[item.action]?.icon}
                  {item.label}操作
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.count}</div>
                <p className="text-xs text-muted-foreground">筆</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 篩選條件 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-center">
            <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="資料類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有類型</SelectItem>
                {entityTypesQuery.data?.map((type) => (
                  <SelectItem key={type.type} value={type.type}>
                    {type.label} ({type.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={(v) => { setAction(v); setPage(1) }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="操作類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有操作</SelectItem>
                <SelectItem value="CREATE">新增</SelectItem>
                <SelectItem value="UPDATE">修改</SelectItem>
                <SelectItem value="DELETE">刪除</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="w-[160px]"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="w-[160px]"
              />
            </div>

            {(entityType !== 'all' || action !== 'all' || startDate || endDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEntityType('all')
                  setAction('all')
                  setStartDate('')
                  setEndDate('')
                  setPage(1)
                }}
              >
                清除篩選
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 日誌列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>操作紀錄</span>
            {logsQuery.data && (
              <span className="text-sm font-normal text-muted-foreground">
                共 {logsQuery.data.pagination.total} 筆
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>時間</TableHead>
                <TableHead>操作者</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>資料類型</TableHead>
                <TableHead>變更欄位</TableHead>
                <TableHead>所屬公司</TableHead>
                <TableHead className="text-right">詳情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsQuery.data?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.createdAt), 'MM/dd HH:mm:ss', { locale: zhTW })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.operator.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.operator.employeeNo}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${actionLabels[log.action]?.color} text-white`}>
                      {actionLabels[log.action]?.icon}
                      <span className="ml-1">{actionLabels[log.action]?.label}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entityTypeLabels[log.entityType] || log.entityType}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {log.path || '-'}
                  </TableCell>
                  <TableCell>
                    {log.company?.name || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetail(log.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logsQuery.data?.logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">沒有符合條件的紀錄</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* 分頁 */}
          {logsQuery.data && logsQuery.data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                第 {page} / {logsQuery.data.pagination.totalPages} 頁
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= logsQuery.data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 詳情 Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>稽核日誌詳情</DialogTitle>
          </DialogHeader>
          {detailQuery.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">操作時間</div>
                  <div className="font-medium">
                    {format(new Date(detailQuery.data.createdAt), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">操作者</div>
                  <div className="font-medium">
                    {detailQuery.data.operator.name} ({detailQuery.data.operator.employeeNo})
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">操作類型</div>
                  <Badge className={`${actionLabels[detailQuery.data.action]?.color} text-white`}>
                    {actionLabels[detailQuery.data.action]?.label}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">資料類型</div>
                  <div className="font-medium">
                    {entityTypeLabels[detailQuery.data.entityType] || detailQuery.data.entityType}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">資料 ID</div>
                  <div className="font-mono text-sm">{detailQuery.data.entityId}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">所屬公司</div>
                  <div className="font-medium">
                    {detailQuery.data.company?.name || '-'}
                  </div>
                </div>
              </div>

              {detailQuery.data.path && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">變更欄位</div>
                  <div className="font-mono text-sm bg-muted p-2 rounded">
                    {detailQuery.data.path}
                  </div>
                </div>
              )}

              {detailQuery.data.oldValue && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">修改前的值</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(detailQuery.data.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {detailQuery.data.newValue && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">修改後的值</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(detailQuery.data.newValue, null, 2)}
                  </pre>
                </div>
              )}

              {(detailQuery.data.ipAddress || detailQuery.data.userAgent) && (
                <div className="grid grid-cols-2 gap-4">
                  {detailQuery.data.ipAddress && (
                    <div>
                      <div className="text-sm text-muted-foreground">IP 位址</div>
                      <div className="font-mono text-sm">{detailQuery.data.ipAddress}</div>
                    </div>
                  )}
                  {detailQuery.data.userAgent && (
                    <div>
                      <div className="text-sm text-muted-foreground">User Agent</div>
                      <div className="text-sm truncate">{detailQuery.data.userAgent}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
