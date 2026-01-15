'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Building,
  Shield,
  FileText,
  Users,
  Building2,
  Activity,
} from 'lucide-react'

interface SystemDashboardProps {
  userId: string
  permissions: {
    isGroupAdmin: boolean
    canManageCompany: boolean
    canViewAuditLog: boolean
  }
  stats: {
    totalGroups: number
    totalCompanies: number
    totalEmployees: number
    recentAuditLogs: number
  }
}

export function SystemDashboard({ permissions, stats }: SystemDashboardProps) {
  const menuItems = [
    {
      title: '公司管理',
      description: '管理集團與分公司',
      icon: Building,
      href: '/dashboard/system/companies',
      color: 'text-blue-500',
      show: permissions.canManageCompany,
    },
    {
      title: '權限管理',
      description: '管理集團級特殊權限',
      icon: Shield,
      href: '/dashboard/system/permissions',
      color: 'text-purple-500',
      show: permissions.isGroupAdmin,
    },
    {
      title: '稽核日誌',
      description: '查看系統操作紀錄',
      icon: FileText,
      href: '/dashboard/system/audit-logs',
      color: 'text-orange-500',
      show: permissions.canViewAuditLog,
    },
  ].filter((item) => item.show)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">系統管理</h1>
        <p className="text-muted-foreground">集團級系統設定與管理</p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">集團數量</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGroups}</div>
            <p className="text-xs text-muted-foreground">個集團</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">公司數量</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
            <p className="text-xs text-muted-foreground">家公司</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">員工總數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">位員工</p>
          </CardContent>
        </Card>

        {permissions.canViewAuditLog && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">近 7 日操作</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentAuditLogs}</div>
              <p className="text-xs text-muted-foreground">筆紀錄</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 功能選單 */}
      <div className="grid gap-4 md:grid-cols-3">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <item.icon className={`h-6 w-6 ${item.color}`} />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 權限說明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">您目前的權限</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {permissions.isGroupAdmin && (
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-purple-500" />
                <span className="font-medium">集團超級管理員</span>
                <span className="text-muted-foreground">- 擁有所有系統管理權限</span>
              </div>
            )}
            {permissions.canManageCompany && !permissions.isGroupAdmin && (
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 text-blue-500" />
                <span className="font-medium">公司管理</span>
                <span className="text-muted-foreground">- 可創建、編輯、停用公司</span>
              </div>
            )}
            {permissions.canViewAuditLog && !permissions.isGroupAdmin && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-orange-500" />
                <span className="font-medium">稽核日誌檢視</span>
                <span className="text-muted-foreground">- 可檢視系統操作紀錄</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
