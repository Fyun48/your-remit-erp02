'use client'

import { useState, useCallback } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Search,
  Download,
  FileSpreadsheet,
  File,
  RotateCcw,
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
  EmployeeAssignment: '員工任職',
  EmployeeChangeLog: '員工異動',
  LeaveType: '假別',
  LeaveBalance: '假別餘額',
  ExpenseCategory: '費用類別',
  SealRequest: '用印申請',
  BusinessCardRequest: '名片申請',
  StationeryRequest: '文具申請',
  WorkShift: '班別',
  Project: '專案',
  Notification: '通知',
  FlowTemplate: '流程範本',
  FlowExecution: '流程執行',
  Delegation: '職務代理',
}

// 欄位名稱中文對照表
const fieldLabels: Record<string, string> = {
  // 通用欄位
  id: '編號',
  name: '名稱',
  code: '代碼',
  description: '描述',
  isActive: '啟用狀態',
  status: '狀態',
  createdAt: '建立時間',
  updatedAt: '更新時間',
  sortOrder: '排序',
  note: '備註',
  remark: '備註',

  // 公司/集團
  taxId: '統一編號',
  address: '地址',
  phone: '電話',
  groupId: '所屬集團',
  companyId: '所屬公司',
  annualLeaveMethod: '特休計算制度',

  // 員工
  employeeNo: '員工編號',
  email: '電子郵件',
  password: '密碼',
  avatar: '頭像',
  hireDate: '到職日',
  resignDate: '離職日',
  birthDate: '生日',
  gender: '性別',
  idNumber: '身分證字號',
  emergencyContact: '緊急聯絡人',
  emergencyPhone: '緊急聯絡電話',
  lineId: 'LINE ID',
  lineUserId: 'LINE 用戶 ID',
  notificationEnabled: '通知啟用',
  notificationPreferences: '通知偏好',

  // 員工任職
  employeeId: '員工',
  departmentId: '部門',
  positionId: '職位',
  roleId: '角色',
  supervisorId: '直屬主管',
  isPrimary: '主要任職',
  startDate: '開始日期',
  endDate: '結束日期',

  // 部門/職位
  parentId: '上層部門',
  level: '職等',

  // 請假
  leaveTypeId: '假別',
  startTime: '開始時間',
  endTime: '結束時間',
  hours: '時數',
  reason: '原因',
  approvalStatus: '審核狀態',
  approvedById: '審核者',
  approvedAt: '審核時間',
  rejectReason: '駁回原因',

  // 假別
  isPaidLeave: '有薪假',
  requiresProof: '需要證明',
  maxDaysPerYear: '年度上限天數',
  minHoursPerRequest: '單次最少時數',
  maxHoursPerRequest: '單次最多時數',
  allowHalfDay: '允許半天',
  allowHourly: '允許按小時',
  carryOverDays: '可結轉天數',
  isDefault: '預設假別',

  // 假別餘額
  year: '年度',
  entitledDays: '應有天數',
  usedDays: '已使用天數',
  remainingDays: '剩餘天數',
  carryOverFromLastYear: '去年結轉',
  expiryDate: '到期日',
  adjustedDays: '調整天數',
  adjustmentReason: '調整原因',

  // 費用報銷
  expenseNo: '報銷單號',
  totalAmount: '總金額',
  currency: '幣別',
  paymentMethod: '付款方式',
  paymentDate: '付款日期',
  paymentNote: '付款備註',

  // 費用類別
  requiresReceipt: '需要收據',
  maxAmountPerItem: '單項上限金額',
  maxAmountPerMonth: '月度上限金額',
  requiresPreApproval: '需要預先審核',

  // 出勤
  clockIn: '上班打卡',
  clockOut: '下班打卡',
  workDate: '工作日期',
  shiftId: '班別',
  isLate: '遲到',
  isEarlyLeave: '早退',
  lateMinutes: '遲到分鐘',
  earlyLeaveMinutes: '早退分鐘',
  overtimeHours: '加班時數',

  // 傳票
  voucherNo: '傳票編號',
  voucherDate: '傳票日期',
  voucherType: '傳票類型',
  periodId: '會計期間',
  debitTotal: '借方總額',
  creditTotal: '貸方總額',
  attachment: '附件',
  postedAt: '過帳時間',
  postedById: '過帳者',

  // 會計科目
  accountCode: '科目代碼',
  accountName: '科目名稱',
  accountType: '科目類型',
  parentCode: '上層科目',
  isCashFlow: '現金流量',
  isBankAccount: '銀行帳戶',

  // 會計期間
  periodName: '期間名稱',
  isClosed: '已結帳',
  closedAt: '結帳時間',
  closedById: '結帳者',

  // 審批流程
  module: '模組',
  conditions: '條件',
  steps: '步驟',

  // 權限
  permission: '權限',
  grantedById: '授權者',
  grantedAt: '授權時間',
  expiresAt: '到期時間',

  // 其他
  title: '標題',
  content: '內容',
  type: '類型',
  priority: '優先順序',
  dueDate: '到期日',
  completedAt: '完成時間',
  assigneeId: '負責人',
  amount: '金額',
  quantity: '數量',
  unitPrice: '單價',
  unit: '單位',
}

// 將欄位名稱轉換為中文
function translateFieldName(fieldPath: string): string {
  if (!fieldPath) return '-'

  // 處理多個欄位（以逗號分隔）
  const fields = fieldPath.split(',').map(f => f.trim())

  const translatedFields = fields.map(field => {
    // 移除可能的前綴（如 employee.name -> name）
    const parts = field.split('.')
    const fieldName = parts[parts.length - 1]
    return fieldLabels[fieldName] || field
  })

  return translatedFields.join('、')
}

// 將操作類型轉換為中文
function translateAction(action: string): string {
  return actionLabels[action]?.label || action
}

export function AuditLogList({ userId }: AuditLogListProps) {
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState<string>('all')
  const [action, setAction] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // 查詢條件狀態（用於實際查詢）
  const [searchParams, setSearchParams] = useState({
    entityType: 'all',
    action: 'all',
    startDate: '',
    endDate: '',
  })

  const logsQuery = trpc.auditLog.list.useQuery({
    userId,
    entityType: searchParams.entityType === 'all' ? undefined : searchParams.entityType,
    action: searchParams.action === 'all' ? undefined : searchParams.action as 'CREATE' | 'UPDATE' | 'DELETE',
    startDate: searchParams.startDate ? new Date(searchParams.startDate) : undefined,
    endDate: searchParams.endDate ? new Date(searchParams.endDate + 'T23:59:59') : undefined,
    page,
    pageSize: 20,
  }, {
    enabled: hasSearched, // 只有點擊查詢後才執行
  })

  // 匯出查詢（取得所有符合條件的資料）
  const exportQuery = trpc.auditLog.list.useQuery({
    userId,
    entityType: searchParams.entityType === 'all' ? undefined : searchParams.entityType,
    action: searchParams.action === 'all' ? undefined : searchParams.action as 'CREATE' | 'UPDATE' | 'DELETE',
    startDate: searchParams.startDate ? new Date(searchParams.startDate) : undefined,
    endDate: searchParams.endDate ? new Date(searchParams.endDate + 'T23:59:59') : undefined,
    page: 1,
    pageSize: 10000, // 匯出時取得更多資料
  }, {
    enabled: false, // 手動觸發
  })

  const entityTypesQuery = trpc.auditLog.getEntityTypes.useQuery({ userId })

  const detailQuery = trpc.auditLog.getById.useQuery(
    { userId, id: selectedLogId || '' },
    { enabled: !!selectedLogId }
  )

  const handleSearch = () => {
    setSearchParams({
      entityType,
      action,
      startDate,
      endDate,
    })
    setPage(1)
    setHasSearched(true)
  }

  const handleReset = () => {
    setEntityType('all')
    setAction('all')
    setStartDate('')
    setEndDate('')
    setSearchParams({
      entityType: 'all',
      action: 'all',
      startDate: '',
      endDate: '',
    })
    setPage(1)
    setHasSearched(false)
  }

  const handleViewDetail = (logId: string) => {
    setSelectedLogId(logId)
    setShowDetailDialog(true)
  }

  // 匯出為 CSV
  const exportToCsv = useCallback(async () => {
    if (!hasSearched) return

    setIsExporting(true)
    try {
      const result = await exportQuery.refetch()
      const logs = result.data?.logs || []

      if (logs.length === 0) {
        alert('沒有可匯出的資料')
        return
      }

      // 建立 CSV 內容
      const headers = [
        '操作時間',
        '操作者姓名',
        '操作者工號',
        '操作類型',
        '資料類型',
        '資料 ID',
        '變更欄位',
        '所屬公司',
        'IP 位址',
      ]

      const rows = logs.map(log => [
        format(new Date(log.createdAt), 'yyyy/MM/dd HH:mm:ss'),
        log.operator.name,
        log.operator.employeeNo,
        translateAction(log.action),
        entityTypeLabels[log.entityType] || log.entityType,
        log.entityId,
        translateFieldName(log.path || ''),
        log.company?.name || '',
        log.ipAddress || '',
      ])

      // 加入 BOM 以支援 Excel 正確顯示中文
      const BOM = '\uFEFF'
      const csvContent = BOM + [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      // 下載檔案
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `稽核日誌_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('匯出失敗:', error)
      alert('匯出失敗，請稍後再試')
    } finally {
      setIsExporting(false)
    }
  }, [hasSearched, exportQuery])

  // 匯出為 Excel (使用 HTML 表格格式)
  const exportToExcel = useCallback(async () => {
    if (!hasSearched) return

    setIsExporting(true)
    try {
      const result = await exportQuery.refetch()
      const logs = result.data?.logs || []

      if (logs.length === 0) {
        alert('沒有可匯出的資料')
        return
      }

      // 建立 HTML 表格
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8">
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #4472C4; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #D9E2F3; }
            .create { color: #28a745; }
            .update { color: #007bff; }
            .delete { color: #dc3545; }
          </style>
        </head>
        <body>
          <h2>稽核日誌報表</h2>
          <p>匯出時間：${format(new Date(), 'yyyy/MM/dd HH:mm:ss')}</p>
          <p>查詢條件：${searchParams.entityType !== 'all' ? `資料類型: ${entityTypeLabels[searchParams.entityType] || searchParams.entityType}` : ''}${searchParams.action !== 'all' ? ` 操作類型: ${translateAction(searchParams.action)}` : ''}${searchParams.startDate ? ` 開始日期: ${searchParams.startDate}` : ''}${searchParams.endDate ? ` 結束日期: ${searchParams.endDate}` : ''}</p>
          <p>共 ${logs.length} 筆紀錄</p>
          <table>
            <thead>
              <tr>
                <th>操作時間</th>
                <th>操作者姓名</th>
                <th>操作者工號</th>
                <th>操作類型</th>
                <th>資料類型</th>
                <th>資料 ID</th>
                <th>變更欄位</th>
                <th>所屬公司</th>
                <th>IP 位址</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td>${format(new Date(log.createdAt), 'yyyy/MM/dd HH:mm:ss')}</td>
                  <td>${log.operator.name}</td>
                  <td>${log.operator.employeeNo}</td>
                  <td class="${log.action.toLowerCase()}">${translateAction(log.action)}</td>
                  <td>${entityTypeLabels[log.entityType] || log.entityType}</td>
                  <td style="font-family: monospace; font-size: 11px;">${log.entityId}</td>
                  <td>${translateFieldName(log.path || '')}</td>
                  <td>${log.company?.name || '-'}</td>
                  <td>${log.ipAddress || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `

      // 下載檔案
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `稽核日誌_${format(new Date(), 'yyyyMMdd_HHmmss')}.xls`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('匯出失敗:', error)
      alert('匯出失敗，請稍後再試')
    } finally {
      setIsExporting(false)
    }
  }, [hasSearched, exportQuery, searchParams])

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

      {/* 查詢條件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">查詢條件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap items-end">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">資料類型</label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="資料類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有類型</SelectItem>
                  {entityTypesQuery.data?.map((type) => (
                    <SelectItem key={type.type} value={type.type}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">操作類型</label>
              <Select value={action} onValueChange={setAction}>
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
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">開始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[160px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">結束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[160px]"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={logsQuery.isFetching}>
                {logsQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                查詢
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                重設
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日誌列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>操作紀錄</span>
            <div className="flex items-center gap-2">
              {hasSearched && logsQuery.data && (
                <span className="text-sm font-normal text-muted-foreground">
                  共 {logsQuery.data.pagination.total} 筆
                </span>
              )}
              {hasSearched && logsQuery.data && logsQuery.data.logs.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting}>
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      匯出
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      匯出 Excel (.xls)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToCsv}>
                      <File className="h-4 w-4 mr-2" />
                      匯出 CSV (.csv)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">請設定查詢條件</p>
              <p className="text-sm text-muted-foreground mt-2">選擇查詢條件後點擊「查詢」按鈕</p>
            </div>
          ) : logsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logsQuery.error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
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
          ) : (
            <>
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
                      <TableCell className="max-w-[200px] truncate" title={log.path || undefined}>
                        {translateFieldName(log.path || '')}
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
            </>
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
                  <div className="text-sm bg-muted p-2 rounded">
                    <span className="font-medium">{translateFieldName(detailQuery.data.path)}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-xs">({detailQuery.data.path})</span>
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
