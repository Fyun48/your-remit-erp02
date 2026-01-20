'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Settings, Calendar, List, FileText, Check } from 'lucide-react'
import Link from 'next/link'

interface LeaveSettingsPageProps {
  companyId: string
  companyName: string
  userId: string
}

export function LeaveSettingsPage({
  companyId,
  companyName,
  userId,
}: LeaveSettingsPageProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const { data: annualLeaveSettings, refetch: refetchSettings } =
    trpc.company.getAnnualLeaveSettings.useQuery({ companyId })

  const { data: leaveTypes } = trpc.leaveType.list.useQuery({ companyId })

  const updateSettingsMutation = trpc.company.updateAnnualLeaveSettings.useMutation({
    onSuccess: () => {
      refetchSettings()
      setIsUpdating(false)
    },
  })

  const handleUpdateAnnualLeaveMethod = async (method: 'ANNIVERSARY' | 'CALENDAR') => {
    setIsUpdating(true)
    await updateSettingsMutation.mutateAsync({
      userId,
      companyId,
      annualLeaveMethod: method,
    })
  }

  const getMinUnitLabel = (minUnit: string) => {
    switch (minUnit) {
      case 'DAY':
        return '天'
      case 'HALF_DAY':
        return '半天'
      case 'HOUR':
        return '小時'
      default:
        return minUnit
    }
  }

  const getQuotaTypeLabel = (quotaType: string) => {
    switch (quotaType) {
      case 'FIXED':
        return '固定額度'
      case 'SENIORITY':
        return '依年資計算'
      case 'UNLIMITED':
        return '無限制'
      default:
        return quotaType
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">假別設定</h1>
        <p className="text-muted-foreground">{companyName}</p>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            特休制度
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            假別列表
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            假別範本
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                特休計算制度
              </CardTitle>
              <CardDescription>
                選擇公司的特休假計算方式。變更後會影響所有員工的特休天數計算。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 週年制 */}
                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    annualLeaveSettings?.annualLeaveMethod === 'ANNIVERSARY'
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => handleUpdateAnnualLeaveMethod('ANNIVERSARY')}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        週年制
                        {annualLeaveSettings?.annualLeaveMethod === 'ANNIVERSARY' && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        以員工到職日為起算點，每滿一年重新計算特休天數
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-sm">
                    <p className="font-medium">適用情境：</p>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                      <li>員工到職日期分散</li>
                      <li>希望員工在到職週年後立即獲得特休</li>
                      <li>計算較為直觀</li>
                    </ul>
                  </div>
                </div>

                {/* 曆年制 */}
                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    annualLeaveSettings?.annualLeaveMethod === 'CALENDAR'
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => handleUpdateAnnualLeaveMethod('CALENDAR')}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        曆年制
                        {annualLeaveSettings?.annualLeaveMethod === 'CALENDAR' && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        每年 1/1 重新計算，依年資比例換算當年度特休天數
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-sm">
                    <p className="font-medium">適用情境：</p>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                      <li>希望統一管理年度特休</li>
                      <li>方便年底結算和遞延處理</li>
                      <li>新進員工按比例計算當年度特休</li>
                    </ul>
                  </div>
                </div>
              </div>

              {isUpdating && (
                <p className="text-sm text-muted-foreground">
                  更新中...
                </p>
              )}

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">台灣勞基法特休天數規定</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>年資</TableHead>
                      <TableHead className="text-right">特休天數</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>6個月以上未滿1年</TableCell>
                      <TableCell className="text-right">3 天</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>1年以上未滿2年</TableCell>
                      <TableCell className="text-right">7 天</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>2年以上未滿3年</TableCell>
                      <TableCell className="text-right">10 天</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>3年以上未滿5年</TableCell>
                      <TableCell className="text-right">14 天</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>5年以上未滿10年</TableCell>
                      <TableCell className="text-right">15 天</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>10年以上</TableCell>
                      <TableCell className="text-right">每年加1天（最高30天）</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types">
          <Card>
            <CardHeader>
              <CardTitle>假別列表</CardTitle>
              <CardDescription>
                公司可用的假別及其設定
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaveTypes && leaveTypes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>代碼</TableHead>
                      <TableHead>名稱</TableHead>
                      <TableHead>類別</TableHead>
                      <TableHead>最小單位</TableHead>
                      <TableHead>額度類型</TableHead>
                      <TableHead className="text-right">年度額度</TableHead>
                      <TableHead>狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveTypes.map((lt) => (
                      <TableRow key={lt.id}>
                        <TableCell className="font-mono">{lt.code}</TableCell>
                        <TableCell className="font-medium">{lt.name}</TableCell>
                        <TableCell>
                          <Badge variant={lt.category === 'STATUTORY' ? 'default' : 'secondary'}>
                            {lt.category === 'STATUTORY' ? '法定假' : '公司假'}
                          </Badge>
                        </TableCell>
                        <TableCell>{getMinUnitLabel(lt.minUnit)}</TableCell>
                        <TableCell>{getQuotaTypeLabel(lt.quotaType)}</TableCell>
                        <TableCell className="text-right">
                          {lt.quotaType === 'UNLIMITED'
                            ? '無限'
                            : lt.quotaType === 'SENIORITY'
                            ? '依年資'
                            : `${lt.annualQuotaDays} 天`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={lt.isActive ? 'default' : 'outline'}>
                            {lt.isActive ? '啟用' : '停用'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  沒有設定任何假別
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>假別範本管理</CardTitle>
              <CardDescription>
                建立和套用假別範本，方便在不同公司間複製假別設定
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  前往假別範本管理頁面進行操作
                </p>
                <Button asChild>
                  <Link href="/dashboard/hr/leave-settings/templates">
                    管理假別範本
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
