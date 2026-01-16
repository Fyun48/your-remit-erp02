'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Stamp,
  TrendingUp,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface SealStatisticsProps {
  companyId: string
  companyName: string
}

const sealTypeLabels: Record<string, string> = {
  COMPANY_SEAL: '公司大章',
  COMPANY_SMALL_SEAL: '公司小章',
  CONTRACT_SEAL: '合約用印',
  INVOICE_SEAL: '發票章',
  BOARD_SEAL: '董事會印鑑',
  BANK_SEAL: '銀行印鑑',
}

const sealTypeColors: Record<string, string> = {
  COMPANY_SEAL: 'bg-blue-500',
  COMPANY_SMALL_SEAL: 'bg-cyan-500',
  CONTRACT_SEAL: 'bg-green-500',
  INVOICE_SEAL: 'bg-yellow-500',
  BOARD_SEAL: 'bg-purple-500',
  BANK_SEAL: 'bg-pink-500',
}

export function SealStatistics({ companyId, companyName }: SealStatisticsProps) {
  const { data: stats, isLoading } = trpc.sealRequest.statistics.useQuery({
    companyId,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/seal">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">用印統計報表</h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  const maxCount = Math.max(
    ...(stats?.byType.map((t) => t._count) || [1]),
    1
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/seal">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">用印統計報表</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {/* 概覽統計卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
            <CardTitle className="text-sm font-medium">待審批</CardTitle>
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
            <CardTitle className="text-sm font-medium">處理中</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.processingCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">用印中</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">逾期未歸還</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.overdueCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">需追蹤</p>
          </CardContent>
        </Card>
      </div>

      {/* 印章類型分佈 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            印章類型使用分佈
          </CardTitle>
          <CardDescription>本年度各類型印章使用統計</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.byType && stats.byType.length > 0 ? (
            <div className="space-y-4">
              {Object.keys(sealTypeLabels).map((type) => {
                const typeData = stats.byType.find((t) => t.sealType === type)
                const count = typeData?._count || 0
                const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0

                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Stamp className="h-4 w-4 text-muted-foreground" />
                        <span>{sealTypeLabels[type]}</span>
                      </div>
                      <span className="font-medium">{count} 次</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${sealTypeColors[type]} transition-all duration-500`}
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
          <Link href="/dashboard/admin/seal">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              查看所有申請
            </Button>
          </Link>
          <Link href="/dashboard/admin/seal/new">
            <Button>
              <Stamp className="h-4 w-4 mr-2" />
              新增用印申請
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
