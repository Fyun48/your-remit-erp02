'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  ArrowLeft,
  Plus,
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Edit,
  Power,
  TrendingUp,
  BarChart3,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface StationeryDashboardProps {
  companyId: string
  companyName: string
  currentUserId: string
}

const requestStatusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  PENDING: { label: '待審核', color: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: '待發放', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: '已駁回', color: 'bg-red-100 text-red-700' },
  ISSUED: { label: '已發放', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
}

export function StationeryDashboard({
  companyId,
  companyName,
  currentUserId,
}: StationeryDashboardProps) {
  const utils = trpc.useUtils()
  const [activeTab, setActiveTab] = useState('overview')
  const [itemSearch, setItemSearch] = useState('')
  const [requestSearch, setRequestSearch] = useState('')

  // 使用 tRPC Query 取得資料
  const { data: items = [], isLoading: isLoadingItems } = trpc.stationery.itemList.useQuery({
    companyId,
    includeInactive: true
  })
  const { data: requests = [], isLoading: isLoadingRequests } = trpc.stationery.requestList.useQuery({ companyId })
  const { data: statsData, isLoading: isLoadingStats } = trpc.stationery.statisticsOverview.useQuery({ companyId })
  const stats = statsData ?? { pendingCount: 0, approvedCount: 0, lowStockCount: 0 }

  const invalidateData = () => {
    utils.stationery.itemList.invalidate()
    utils.stationery.requestList.invalidate()
    utils.stationery.statisticsOverview.invalidate()
  }

  // 品項對話框狀態
  const [itemDialog, setItemDialog] = useState<{
    type: 'create' | 'edit' | 'adjust' | null
    item: typeof items[0] | null
  }>({ type: null, item: null })

  const [itemForm, setItemForm] = useState({
    code: '',
    name: '',
    unit: '',
    unitPrice: 0,
    stock: 0,
    alertLevel: 10,
  })

  const [adjustAmount, setAdjustAmount] = useState(0)

  // 申請操作對話框
  const [actionDialog, setActionDialog] = useState<{
    type: 'approve' | 'reject' | 'issue' | null
    request: typeof requests[0] | null
  }>({ type: null, request: null })

  // tRPC mutations
  const createItem = trpc.stationery.itemCreate.useMutation({
    onSuccess: () => {
      setItemDialog({ type: null, item: null })
      invalidateData()
    },
  })

  const updateItem = trpc.stationery.itemUpdate.useMutation({
    onSuccess: () => {
      setItemDialog({ type: null, item: null })
      invalidateData()
    },
  })

  const adjustStock = trpc.stationery.itemAdjustStock.useMutation({
    onSuccess: () => {
      setItemDialog({ type: null, item: null })
      setAdjustAmount(0)
      invalidateData()
    },
  })

  const toggleActive = trpc.stationery.itemToggleActive.useMutation({
    onSuccess: () => invalidateData(),
  })

  const approveRequest = trpc.stationery.requestApprove.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const rejectRequest = trpc.stationery.requestReject.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
  })

  const issueRequest = trpc.stationery.requestIssue.useMutation({
    onSuccess: () => {
      setActionDialog({ type: null, request: null })
      invalidateData()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const filteredItems = items.filter((item) => {
    if (!itemSearch) return true
    const s = itemSearch.toLowerCase()
    return item.code.toLowerCase().includes(s) || item.name.toLowerCase().includes(s)
  })

  const filteredRequests = requests.filter((req) => {
    if (!requestSearch) return true
    const s = requestSearch.toLowerCase()
    return (
      req.requestNo.toLowerCase().includes(s) ||
      req.applicant.name.toLowerCase().includes(s)
    )
  })

  const formatDate = (dateStr: Date | string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-TW')
  }

  const isLoading = isLoadingItems || isLoadingRequests || isLoadingStats

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const openCreateDialog = () => {
    setItemForm({ code: '', name: '', unit: '', unitPrice: 0, stock: 0, alertLevel: 10 })
    setItemDialog({ type: 'create', item: null })
  }

  const openEditDialog = (item: typeof items[0]) => {
    setItemForm({
      code: item.code,
      name: item.name,
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      stock: item.stock,
      alertLevel: item.alertLevel,
    })
    setItemDialog({ type: 'edit', item })
  }

  const openAdjustDialog = (item: typeof items[0]) => {
    setAdjustAmount(0)
    setItemDialog({ type: 'adjust', item })
  }

  const handleItemSubmit = () => {
    if (itemDialog.type === 'create') {
      createItem.mutate({ companyId, ...itemForm })
    } else if (itemDialog.type === 'edit' && itemDialog.item) {
      updateItem.mutate({
        id: itemDialog.item.id,
        name: itemForm.name,
        unit: itemForm.unit,
        unitPrice: itemForm.unitPrice,
        alertLevel: itemForm.alertLevel,
      })
    }
  }

  const handleAdjustSubmit = () => {
    if (itemDialog.item && adjustAmount !== 0) {
      adjustStock.mutate({ id: itemDialog.item.id, adjustment: adjustAmount })
    }
  }

  const executeAction = () => {
    if (!actionDialog.request) return

    switch (actionDialog.type) {
      case 'approve':
        approveRequest.mutate({ id: actionDialog.request.id, approverId: currentUserId })
        break
      case 'reject':
        rejectRequest.mutate({ id: actionDialog.request.id, approverId: currentUserId })
        break
      case 'issue':
        issueRequest.mutate({ id: actionDialog.request.id, issuerId: currentUserId })
        break
    }
  }

  const lowStockItems = items.filter((item) => item.isActive && item.stock <= item.alertLevel)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">文具管理</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Link href="/dashboard/admin/stationery/statistics">
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            統計報表
          </Button>
        </Link>
        <Link href="/dashboard/admin/stationery/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增申請
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">總覽</TabsTrigger>
          <TabsTrigger value="items">品項管理</TabsTrigger>
          <TabsTrigger value="requests">申請列表</TabsTrigger>
        </TabsList>

        {/* 總覽 Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* 統計卡片 */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">待審核</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.pendingCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">待發放</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.approvedCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">庫存警示</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.lowStockCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">品項總數</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{items.filter((i) => i.isActive).length}</div>
              </CardContent>
            </Card>
          </div>

          {/* 庫存警示 */}
          {lowStockItems.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  庫存不足警示
                </CardTitle>
                <CardDescription className="text-red-600">
                  以下品項庫存已低於警戒值，請儘速補充
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-white p-3 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{item.stock} {item.unit}</p>
                        <p className="text-xs text-muted-foreground">警戒值: {item.alertLevel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 最近申請 */}
          <Card>
            <CardHeader>
              <CardTitle>最近申請</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>單號</TableHead>
                    <TableHead>申請人</TableHead>
                    <TableHead>金額</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>申請日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.slice(0, 5).map((req) => {
                    const status = requestStatusConfig[req.status]
                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/admin/stationery/${req.id}`}
                            className="text-primary hover:underline"
                          >
                            {req.requestNo}
                          </Link>
                        </TableCell>
                        <TableCell>{req.applicant.name}</TableCell>
                        <TableCell>${req.totalAmount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={status?.color}>{status?.label}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(req.createdAt)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 品項管理 Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  品項列表
                </CardTitle>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增品項
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋品項代碼或名稱..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>代碼</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>單位</TableHead>
                    <TableHead>單價</TableHead>
                    <TableHead>庫存</TableHead>
                    <TableHead>警戒值</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const isLowStock = item.isActive && item.stock <= item.alertLevel
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>${Number(item.unitPrice)}</TableCell>
                        <TableCell>
                          <span className={isLowStock ? 'text-red-600 font-bold' : ''}>
                            {item.stock}
                          </span>
                          {isLowStock && (
                            <AlertTriangle className="inline h-4 w-4 ml-1 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>{item.alertLevel}</TableCell>
                        <TableCell>
                          <Badge className={item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                            {item.isActive ? '啟用' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openAdjustDialog(item)}
                            >
                              <TrendingUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleActive.mutate({ id: item.id })}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 申請列表 Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                申請列表
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋單號或申請人..."
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>單號</TableHead>
                    <TableHead>申請人</TableHead>
                    <TableHead>金額</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>申請日期</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((req) => {
                    const status = requestStatusConfig[req.status]
                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/admin/stationery/${req.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {req.requestNo}
                          </Link>
                        </TableCell>
                        <TableCell>{req.applicant.name}</TableCell>
                        <TableCell>${req.totalAmount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={status?.color}>{status?.label}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(req.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {req.status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600"
                                  onClick={() => setActionDialog({ type: 'approve', request: req })}
                                >
                                  核准
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={() => setActionDialog({ type: 'reject', request: req })}
                                >
                                  駁回
                                </Button>
                              </>
                            )}
                            {req.status === 'APPROVED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600"
                                onClick={() => setActionDialog({ type: 'issue', request: req })}
                              >
                                發放
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 品項新增/編輯對話框 */}
      <Dialog
        open={itemDialog.type === 'create' || itemDialog.type === 'edit'}
        onOpenChange={() => setItemDialog({ type: null, item: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {itemDialog.type === 'create' ? '新增品項' : '編輯品項'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>品項代碼</Label>
                <Input
                  value={itemForm.code}
                  onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                  disabled={itemDialog.type === 'edit'}
                  placeholder="ST001"
                />
              </div>
              <div className="space-y-2">
                <Label>品項名稱</Label>
                <Input
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="原子筆"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>單位</Label>
                <Input
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  placeholder="盒"
                />
              </div>
              <div className="space-y-2">
                <Label>單價</Label>
                <Input
                  type="number"
                  value={itemForm.unitPrice}
                  onChange={(e) => setItemForm({ ...itemForm, unitPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>警戒庫存</Label>
                <Input
                  type="number"
                  value={itemForm.alertLevel}
                  onChange={(e) => setItemForm({ ...itemForm, alertLevel: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            {itemDialog.type === 'create' && (
              <div className="space-y-2">
                <Label>初始庫存</Label>
                <Input
                  type="number"
                  value={itemForm.stock}
                  onChange={(e) => setItemForm({ ...itemForm, stock: parseInt(e.target.value) || 0 })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog({ type: null, item: null })}>
              取消
            </Button>
            <Button onClick={handleItemSubmit}>
              {itemDialog.type === 'create' ? '新增' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 庫存調整對話框 */}
      <Dialog
        open={itemDialog.type === 'adjust'}
        onOpenChange={() => setItemDialog({ type: null, item: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>調整庫存</DialogTitle>
          </DialogHeader>
          {itemDialog.item && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="font-medium">{itemDialog.item.name}</p>
                <p className="text-sm text-muted-foreground">
                  目前庫存：{itemDialog.item.stock} {itemDialog.item.unit}
                </p>
              </div>
              <div className="space-y-2">
                <Label>調整數量（正數為補充，負數為扣除）</Label>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="text-sm">
                調整後庫存：
                <span className="font-bold">
                  {itemDialog.item.stock + adjustAmount} {itemDialog.item.unit}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog({ type: null, item: null })}>
              取消
            </Button>
            <Button onClick={handleAdjustSubmit} disabled={adjustAmount === 0}>
              確認調整
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 申請操作對話框 */}
      <Dialog
        open={actionDialog.type !== null}
        onOpenChange={() => setActionDialog({ type: null, request: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'approve' && '核准申請'}
              {actionDialog.type === 'reject' && '駁回申請'}
              {actionDialog.type === 'issue' && '發放文具'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {actionDialog.type === 'approve' && '確定要核准此文具申請？'}
            {actionDialog.type === 'reject' && '確定要駁回此文具申請？'}
            {actionDialog.type === 'issue' && '確定要發放文具？發放後將自動扣除庫存。'}
          </p>
          {actionDialog.request && (
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <p className="font-medium">{actionDialog.request.requestNo}</p>
              <p className="text-sm">申請人：{actionDialog.request.applicant.name}</p>
              <p className="text-sm">金額：${actionDialog.request.totalAmount.toLocaleString()}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ type: null, request: null })}>
              取消
            </Button>
            <Button
              className={
                actionDialog.type === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : actionDialog.type === 'issue'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-green-600 hover:bg-green-700'
              }
              onClick={executeAction}
            >
              {actionDialog.type === 'approve' && '核准'}
              {actionDialog.type === 'reject' && '駁回'}
              {actionDialog.type === 'issue' && '確認發放'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
