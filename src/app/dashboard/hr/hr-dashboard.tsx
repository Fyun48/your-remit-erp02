'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  Building2,
  Briefcase,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  FileText,
  Network,
  Wallet,
  Clock,
  UserCheck,
  Calendar,
  Settings,
} from 'lucide-react'

interface HRDashboardProps {
  companyId: string
  companyName: string
  stats: {
    totalActive: number
    totalDepartments: number
    totalPositions: number
    recentHires: number
  }
}

export function HRDashboard({ companyName, stats }: HRDashboardProps) {
  const menuItems = [
    {
      title: '員工資料',
      description: '查詢與管理員工個人資料',
      icon: Users,
      href: '/dashboard/hr/employees',
      color: 'text-blue-500',
    },
    {
      title: '部門管理',
      description: '管理公司部門架構',
      icon: Building2,
      href: '/dashboard/hr/departments',
      color: 'text-green-500',
    },
    {
      title: '職位管理',
      description: '管理職位與職級',
      icon: Briefcase,
      href: '/dashboard/hr/positions',
      color: 'text-purple-500',
    },
    {
      title: '新增人員',
      description: '新增員工資料',
      icon: UserPlus,
      href: '/dashboard/hr/employees/new',
      color: 'text-emerald-500',
    },
    {
      title: '離職作業',
      description: '員工離職處理',
      icon: UserMinus,
      href: '/dashboard/hr/offboard',
      color: 'text-red-500',
    },
    {
      title: '調動作業',
      description: '部門、職位調動',
      icon: ArrowRightLeft,
      href: '/dashboard/hr/transfer',
      color: 'text-orange-500',
    },
    {
      title: '組織圖',
      description: '查看公司組織架構',
      icon: Network,
      href: '/dashboard/hr/organization',
      color: 'text-cyan-500',
    },
    {
      title: '人事報表',
      description: '人員統計與分析',
      icon: FileText,
      href: '/dashboard/hr/reports',
      color: 'text-indigo-500',
    },
    {
      title: '薪資管理',
      description: '薪資設定、計算與發放',
      icon: Wallet,
      href: '/dashboard/hr/payroll',
      color: 'text-yellow-500',
    },
    {
      title: '班別設定',
      description: '管理上下班時間與遲到早退寬限',
      icon: Clock,
      href: '/dashboard/hr/shifts',
      color: 'text-teal-500',
    },
    {
      title: '職務代理',
      description: '設定職務代理人與代理權限',
      icon: UserCheck,
      href: '/dashboard/hr/delegation',
      color: 'text-pink-500',
    },
    {
      title: '假別設定',
      description: '特休制度、假別列表與範本管理',
      icon: Settings,
      href: '/dashboard/hr/leave-settings',
      color: 'text-slate-500',
    },
    {
      title: '假別餘額管理',
      description: '查詢與調整員工假別餘額',
      icon: Calendar,
      href: '/dashboard/hr/leave-balance',
      color: 'text-amber-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">人事管理</h1>
        <p className="text-muted-foreground">{companyName}</p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">在職人數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActive}</div>
            <p className="text-xs text-muted-foreground">位員工</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">部門數量</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDepartments}</div>
            <p className="text-xs text-muted-foreground">個部門</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">職位數量</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPositions}</div>
            <p className="text-xs text-muted-foreground">個職位</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月新進</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentHires}</div>
            <p className="text-xs text-muted-foreground">位員工</p>
          </CardContent>
        </Card>
      </div>

      {/* 功能選單 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
    </div>
  )
}
