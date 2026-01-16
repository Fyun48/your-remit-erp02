'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Clock,
  Printer,
  CreditCard,
  TrendingUp,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface CardStatisticsProps {
  companyId: string
  companyName: string
}

const statusLabels: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待審核',
  APPROVED: '已核准',
  REJECTED: '已駁回',
  PRINTING: '印刷中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  PENDING: 'bg-blue-500',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-500',
  PRINTING: 'bg-orange-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-gray-400',
}

export function CardStatistics({ companyId, companyName }: CardStatisticsProps) {
  const { data: stats, isLoading } = trpc.businessCard.statistics.useQuery({
    companyId,
  })

  // 取得各狀態數量
  const { data: statusCounts } = trpc.businessCard.list.useQuery({
    companyId,
  })

  // 計算狀態分佈
  const statusDistribution = statusCounts?.reduce(
    (acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  ) || {}

  const totalRequests = Object.values(statusDistribution).reduce((a, b) => a + b, 0)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/card">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">名片統計報表</h1>
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
        <Link href="/dashboard/admin/card">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">名片統計報表</h1>
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
            <CardTitle className="text-sm font-medium">印刷中</CardTitle>
            <Printer className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.printingCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">進行中</p>
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
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
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

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/dashboard/admin/card">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              查看所有申請
            </Button>
          </Link>
          <Link href="/dashboard/admin/card/new">
            <Button>
              <CreditCard className="h-4 w-4 mr-2" />
              新增名片申請
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
