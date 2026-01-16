'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  FileText,
  Settings,
  Receipt,
  BarChart3,
  BookOpen,
  Building2,
  Stamp,
  Network,
} from 'lucide-react'

const navigation = [
  { name: '儀表板', href: '/dashboard', icon: LayoutDashboard },
  { name: '人事管理', href: '/dashboard/hr', icon: Users },
  { name: '組織圖', href: '/dashboard/organization', icon: Network },
  { name: '出勤管理', href: '/dashboard/attendance', icon: Clock },
  { name: '請假管理', href: '/dashboard/leave', icon: Calendar },
  { name: '費用報銷', href: '/dashboard/expense', icon: Receipt },
  { name: '審核中心', href: '/dashboard/approval', icon: FileText },
  { name: '財務會計', href: '/dashboard/finance', icon: BookOpen },
  { name: '行政管理', href: '/dashboard/admin', icon: Stamp },
  { name: '報表中心', href: '/dashboard/reports', icon: BarChart3 },
  { name: '系統管理', href: '/dashboard/system', icon: Building2 },
  { name: '系統設定', href: '/dashboard/settings', icon: Settings },
]

interface SidebarProps {
  groupName?: string
}

export function Sidebar({ groupName = '集團' }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">{groupName} ERP</h1>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center rounded-md px-2 py-2 text-sm font-medium',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
