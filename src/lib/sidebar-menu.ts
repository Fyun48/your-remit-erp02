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
  Workflow,
  MessageSquare,
  FolderKanban,
  LucideIcon,
} from 'lucide-react'

export interface MenuItem {
  id: string
  name: string
  href: string
  icon: LucideIcon
  permission?: string // 對應權限代碼，undefined 表示所有人可見
}

// 預設選單順序
export const defaultMenuItems: MenuItem[] = [
  { id: 'dashboard', name: '儀表板', href: '/dashboard', icon: LayoutDashboard },
  { id: 'hr', name: '人事管理', href: '/dashboard/hr', icon: Users, permission: 'hr.view' },
  { id: 'organization', name: '組織圖', href: '/dashboard/organization', icon: Network, permission: 'org.view' },
  { id: 'workflow', name: '流程管理', href: '/dashboard/workflow', icon: Workflow, permission: 'workflow.view' },
  { id: 'attendance', name: '出勤管理', href: '/dashboard/attendance', icon: Clock },
  { id: 'messages', name: '內部訊息', href: '/dashboard/messages', icon: MessageSquare },
  { id: 'projects', name: '專案管理', href: '/dashboard/projects', icon: FolderKanban },
  { id: 'leave', name: '請假管理', href: '/dashboard/leave', icon: Calendar },
  { id: 'expense', name: '費用報銷', href: '/dashboard/expense', icon: Receipt },
  { id: 'approval', name: '審核中心', href: '/dashboard/approval', icon: FileText },
  { id: 'finance', name: '財務會計', href: '/dashboard/finance', icon: BookOpen, permission: 'finance.view' },
  { id: 'admin', name: '行政管理', href: '/dashboard/admin', icon: Stamp, permission: 'admin.view' },
  { id: 'reports', name: '報表中心', href: '/dashboard/reports', icon: BarChart3, permission: 'reports.view' },
  { id: 'system', name: '系統管理', href: '/dashboard/system', icon: Building2, permission: 'system.admin' },
  { id: 'settings', name: '系統設定', href: '/dashboard/settings', icon: Settings, permission: 'settings.view' },
]

// 取得預設選單 ID 順序
export const getDefaultMenuOrder = (): string[] => {
  return defaultMenuItems.map((item) => item.id)
}

// 根據 ID 取得選單項目
export const getMenuItemById = (id: string): MenuItem | undefined => {
  return defaultMenuItems.find((item) => item.id === id)
}
