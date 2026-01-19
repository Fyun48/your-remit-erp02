'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Progress } from '@/components/ui/progress'
import {
  Target,
  Loader2,
  TrendingUp,
  TrendingDown,
  Clock,
  Star,
  Building2,
  CheckCircle2,
  XCircle,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useSession } from 'next-auth/react'

const MONTHS = [
  { value: 1, label: '一月' },
  { value: 2, label: '二月' },
  { value: 3, label: '三月' },
  { value: 4, label: '四月' },
  { value: 5, label: '五月' },
  { value: 6, label: '六月' },
  { value: 7, label: '七月' },
  { value: 8, label: '八月' },
  { value: 9, label: '九月' },
  { value: 10, label: '十月' },
  { value: 11, label: '十一月' },
  { value: 12, label: '十二月' },
]

export default function ProjectKpiReportPage() {
  const { data: session } = useSession()
  const employeeId = session?.user?.id || ''

  // 取得員工的主要任職公司
  const { data: primaryCompany, isLoading: isLoadingCompany } = trpc.employee.getPrimaryCompany.useQuery(
    { employeeId },
    { enabled: !!employeeId }
  )
  const companyId = primaryCompany?.id || ''

  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)

  // 取得公司 KPI 總覽
  const { data: overview, isLoading: isLoadingOverview, refetch: refetchOverview } =
    trpc.projectKpi.getCompanyKpiOverview.useQuery(
      { companyId, year: selectedYear, month: selectedMonth },
      { enabled: !!companyId }
    )

  // 取得部門排行
  const { data: ranking, isLoading: isLoadingRanking, refetch: refetchRanking } =
    trpc.projectKpi.getCompanyKpiRanking.useQuery(
      { companyId, year: selectedYear, month: selectedMonth },
      { enabled: !!companyId }
    )

  // 取得部門列表（用於更新 KPI）
  const { data: departments } = trpc.department.list.useQuery(
    { companyId },
    { enabled: !!companyId }
  )

  // 批量更新所有部門 KPI
  const saveSummary = trpc.projectKpi.saveDepartmentKpiSummary.useMutation({
    onSuccess: () => {
      refetchOverview()
      refetchRanking()
    },
  })

  const handleRefreshAll = async () => {
    if (!departments) return

    for (const dept of departments) {
      await saveSummary.mutateAsync({
        companyId,
        departmentId: dept.id,
        year: selectedYear,
        month: selectedMonth,
      })
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

  const isLoading = isLoadingCompany || isLoadingOverview || isLoadingRanking

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 標題與篩選 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            專案 KPI 儀表板
          </h1>
          <p className="text-muted-foreground">
            檢視公司各部門的專案績效指標
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month) => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleRefreshAll}
            disabled={saveSummary.isPending}
          >
            {saveSummary.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            更新數據
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 總覽卡片 */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  總體績效
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {overview?.avgOverallScore ?? 0}%
                </div>
                <Progress
                  value={overview?.avgOverallScore ?? 0}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  平均完成率
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {overview?.avgCompletion ?? 0}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {overview?.totalCompleted ?? 0} / {overview?.totalProjects ?? 0} 專案完成
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  平均準時率
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {overview?.avgOnTime ?? 0}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  任務如期完成比例
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  平均品質分數
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">
                  {overview?.avgQuality ?? 0}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {overview?.departmentCount ?? 0} 個部門統計
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 達標統計 */}
          {(overview?.topPerformerCount !== undefined || overview?.underPerformerCount !== undefined) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-green-100">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-green-700">
                        {overview?.topPerformerCount ?? 0}
                      </div>
                      <div className="text-green-600">達標部門</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-red-100">
                      <XCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-red-700">
                        {overview?.underPerformerCount ?? 0}
                      </div>
                      <div className="text-red-600">未達標部門</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 部門排行表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                部門績效排行
              </CardTitle>
              <CardDescription>
                {selectedYear} 年 {selectedMonth} 月各部門專案績效
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!ranking || ranking.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>尚無 KPI 資料</p>
                  <p className="text-sm">點擊「更新數據」按鈕來計算各部門績效</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">排名</TableHead>
                      <TableHead>部門</TableHead>
                      <TableHead className="text-right">專案數</TableHead>
                      <TableHead className="text-right">完成率</TableHead>
                      <TableHead className="text-right">準時率</TableHead>
                      <TableHead className="text-right">品質分</TableHead>
                      <TableHead className="text-right">綜合分數</TableHead>
                      <TableHead className="text-center">狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map((dept) => (
                      <TableRow key={dept.departmentId}>
                        <TableCell>
                          <Badge
                            variant={
                              dept.rank === 1
                                ? 'default'
                                : dept.rank <= 3
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            #{dept.rank}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{dept.departmentName}</div>
                          <div className="text-xs text-muted-foreground">
                            {dept.departmentCode}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {dept.projectCount}
                          <span className="text-muted-foreground text-xs ml-1">
                            ({dept.completedCount} 完成)
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-600 font-medium">
                            {dept.avgCompletion}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-blue-600 font-medium">
                            {dept.avgOnTime}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-amber-600 font-medium">
                            {dept.avgQuality}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress
                              value={dept.overallScore}
                              className="w-16"
                            />
                            <span className="font-bold">{dept.overallScore}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {dept.targetScore ? (
                            dept.achievedTarget ? (
                              <Badge className="bg-green-100 text-green-800">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                達標
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                未達標
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline">未設目標</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
