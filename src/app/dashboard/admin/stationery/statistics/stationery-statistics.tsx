'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Clock,
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface StationeryStatisticsProps {
  companyId: string
  companyName: string
}

const statusLabels: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待審核',
  APPROVED: '已核准',
  REJECTED: '已駁回',
  ISSUED: '已發放',
  CANCELLED: '已取消',
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  PENDING: 'bg-blue-500',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-500',
  ISSUED: 'bg-emerald-500',
  CANCELLED: 'bg-gray-400',
}

export function StationeryStatistics({ companyId, companyName }: StationeryStatisticsProps) {
  const { data: stats, isLoading } = trpc.stationery.statisticsOverview.useQuery({
    companyId,
  })

  const { data: requests } = trpc.stationery.requestList.useQuery({
    companyId,
  })

  const { data: items } = trpc.stationery.itemList.useQuery({
    companyId,
  })

  // 計算狀態分佈
  const statusDistribution = requests?.reduce(
    (acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  ) || {}

  const totalRequests = Object.values(statusDistribution).reduce((a, b) => a + b, 0)

  // 計算低庫存品項數
  const lowStockCount = items?.filter(item => item.stock <= item.alertLevel).length || 0

  // 計算總庫存價值
  const totalInventoryValue = items?.reduce(
    (sum, item) => sum + (item.stock * Number(item.unitPrice)),
    0
  ) || 0

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/stationery">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">文具統計報表</h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/stationery">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">文具統計報表</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {/* 概覽統計卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月申請</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">份申請單</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本年累計</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalThisYear || 0}</div>
            <p className="text-xs text-muted-foreground">份申請單</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待審核</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.pendingCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">待處理</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">低庫存警示</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground">項品需補充</p>
          </CardContent>
        </Card>
      </div>

      {/* 庫存與成本統計 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              庫存概況
            </CardTitle>
            <CardDescription>文具品項庫存狀態</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">品項總數</span>
                <span className="font-medium">{items?.length || 0} 項</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">庫存總價值</span>
                <span className="font-medium text-green-600">
                  NT$ {totalInventoryValue.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">低庫存品項</span>
                <span className={`font-medium ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {lowStockCount} 項
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">啟用品項</span>
                <span className="font-medium">
                  {items?.filter(i => i.isActive).length || 0} 項
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              成本統計
            </CardTitle>
            <CardDescription>申請金額統計</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">本月發放金額</span>
                <span className="font-medium">
                  NT$ {Number(stats?.monthlyAmount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">待發放數量</span>
                <span className="font-medium text-green-600">
                  {stats?.approvedCount || 0} 件
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">平均每單金額</span>
                <span className="font-medium">
                  NT$ {totalRequests > 0
                    ? Math.round(requests?.reduce((sum, req) => sum + Number(req.totalAmount), 0) || 0 / totalRequests).toLocaleString()
                    : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 狀態分佈 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            申請狀態分佈
          </CardTitle>
          <CardDescription>各狀態申請數量統計</CardDescription>
        </CardHeader>
        <CardContent>
          {totalRequests > 0 ? (
            <div className="space-y-4">
              {Object.entries(statusLabels).map(([status, label]) => {
                const count = statusDistribution[status] || 0
                const percentage = totalRequests > 0 ? (count / totalRequests) * 100 : 0

                if (count === 0) return null

                return (
                  <div key={status} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{label}</span>
                      </div>
                      <span className="font-medium">{count} 件 ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${statusColors[status]} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暫無統計資料</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 低庫存警示清單 */}
      {lowStockCount > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              低庫存警示
            </CardTitle>
            <CardDescription>以下品項庫存低於警示水位，建議補充</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items
                ?.filter(item => item.stock <= item.alertLevel)
                .map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-red-600">{item.stock} {item.unit}</p>
                      <p className="text-xs text-muted-foreground">警示水位: {item.alertLevel}</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/dashboard/admin/stationery">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              查看所有申請
            </Button>
          </Link>
          <Link href="/dashboard/admin/stationery/new">
            <Button>
              <Package className="h-4 w-4 mr-2" />
              新增文具申請
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
