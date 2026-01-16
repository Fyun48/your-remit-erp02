'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  ArrowLeft,
  FileText,
  Users,
  UserPlus,
  UserMinus,
  Building2,
  Briefcase,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

interface Stats {
  totalActive: number
  totalOnLeave: number
  totalResigned: number
  newHiresThisMonth: number
  newHiresThisYear: number
  resignedThisMonth: number
  resignedThisYear: number
}

interface DepartmentStat {
  name: string
  code: string
  count: number
}

interface PositionStat {
  name: string
  count: number
}

interface GenderStat {
  gender: string | null
  count: number
}

interface RecentEmployee {
  id: string
  employeeNo: string
  name: string
  hireDate?: Date
  resignDate?: Date | null
  assignments: {
    department: { name: string }
    position: { name: string }
  }[]
}

interface HRReportsProps {
  companyName: string
  stats: Stats
  departmentStats: DepartmentStat[]
  positionStats: PositionStat[]
  genderStats: GenderStat[]
  recentHires: RecentEmployee[]
  recentResigns: RecentEmployee[]
}

const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  OTHER: '其他',
}

export function HRReports({
  companyName,
  stats,
  departmentStats,
  positionStats,
  genderStats,
  recentHires,
  recentResigns,
}: HRReportsProps) {
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('zh-TW')
  }

  // 計算離職率
  const turnoverRate = stats.totalActive > 0
    ? ((stats.resignedThisYear / (stats.totalActive + stats.resignedThisYear)) * 100).toFixed(1)
    : '0'

  // 部門統計百分比
  const totalInDepts = departmentStats.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hr">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">人事報表</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {/* 人員概況 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">在職人數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActive}</div>
            <p className="text-xs text-muted-foreground">
              留停 {stats.totalOnLeave} 人
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月新進</CardTitle>
            <UserPlus className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.newHiresThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              本年累計 {stats.newHiresThisYear} 人
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月離職</CardTitle>
            <UserMinus className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.resignedThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              本年累計 {stats.resignedThisYear} 人
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">離職率</CardTitle>
            {parseFloat(turnoverRate) > 10 ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{turnoverRate}%</div>
            <p className="text-xs text-muted-foreground">本年度</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 部門人數分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              部門人數分布
            </CardTitle>
            <CardDescription>各部門在職人數統計</CardDescription>
          </CardHeader>
          <CardContent>
            {departmentStats.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">尚無資料</p>
            ) : (
              <div className="space-y-3">
                {departmentStats.map((dept, i) => {
                  const percentage = totalInDepts > 0
                    ? Math.round((dept.count / totalInDepts) * 100)
                    : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>
                          <Badge variant="outline" className="mr-2 font-mono">
                            {dept.code}
                          </Badge>
                          {dept.name}
                        </span>
                        <span className="font-medium">{dept.count} 人</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 職位分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              職位分布
            </CardTitle>
            <CardDescription>各職位人數統計</CardDescription>
          </CardHeader>
          <CardContent>
            {positionStats.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">尚無資料</p>
            ) : (
              <div className="space-y-2">
                {positionStats.slice(0, 10).map((pos, i) => (
                  <div key={i} className="flex justify-between items-center py-1">
                    <span className="text-sm">{pos.name}</span>
                    <Badge variant="secondary">{pos.count} 人</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 性別分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              性別分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8 justify-center">
              {genderStats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl font-bold">{stat.count}</div>
                  <div className="text-sm text-muted-foreground">
                    {stat.gender ? genderLabels[stat.gender] : '未填寫'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 人員異動趨勢 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              年度統計摘要
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">期初人數（估計）</span>
                <span className="font-medium">
                  {stats.totalActive + stats.resignedThisYear - stats.newHiresThisYear}
                </span>
              </div>
              <div className="flex justify-between items-center text-green-600">
                <span>+ 本年新進</span>
                <span className="font-medium">{stats.newHiresThisYear}</span>
              </div>
              <div className="flex justify-between items-center text-red-600">
                <span>- 本年離職</span>
                <span className="font-medium">{stats.resignedThisYear}</span>
              </div>
              <hr />
              <div className="flex justify-between items-center">
                <span className="font-medium">目前在職</span>
                <span className="text-xl font-bold">{stats.totalActive}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 最近異動 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 最近新進 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-500" />
              最近新進員工
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentHires.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">尚無資料</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>員工</TableHead>
                    <TableHead>部門</TableHead>
                    <TableHead>到職日</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentHires.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {emp.employeeNo}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {emp.assignments[0]?.department.name || '-'}
                      </TableCell>
                      <TableCell>{formatDate(emp.hireDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 最近離職 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-red-500" />
              最近離職員工
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentResigns.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">尚無資料</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>員工</TableHead>
                    <TableHead>部門</TableHead>
                    <TableHead>離職日</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentResigns.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {emp.employeeNo}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {emp.assignments[0]?.department.name || '-'}
                      </TableCell>
                      <TableCell>{formatDate(emp.resignDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
