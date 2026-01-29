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
  Megaphone,
  UserCog,
  Building,
  Briefcase,
  CalendarClock,
  CalendarDays,
  UserMinus,
  Users2,
  Wallet,
  FileSpreadsheet,
  CalendarRange,
  FileInput,
  Contact,
  Store,
  CreditCard,
  Package,
  ClipboardCheck,
  ShieldCheck,
  FileSearch,
  Bell,
  KeyRound,
  Link2,
  Target,
  Menu,
} from 'lucide-react'

export interface SubMenuItem {
  id: string
  name: string
  href: string
  icon?: LucideIcon
  permission?: string
}

export interface MenuItem {
  id: string
  name: string
  href: string
  icon: LucideIcon
  permission?: string
  isLocked?: boolean // 鎖定不可透過介面調整
  children?: SubMenuItem[]
}

// 預設選單順序
export const defaultMenuItems: MenuItem[] = [
  {
    id: 'dashboard',
    name: '個人專區',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'hr',
    name: '人事管理',
    href: '/dashboard/hr',
    icon: Users,
    permission: 'hr.view',
    children: [
      { id: 'employees', name: '員工管理', href: '/dashboard/hr/employees', icon: UserCog },
      { id: 'departments', name: '部門管理', href: '/dashboard/hr/departments', icon: Building },
      { id: 'positions', name: '職位管理', href: '/dashboard/hr/positions', icon: Briefcase },
      { id: 'shifts', name: '班別管理', href: '/dashboard/hr/shifts', icon: CalendarClock },
      { id: 'leave-settings', name: '假別設定', href: '/dashboard/hr/leave-settings', icon: CalendarDays },
      { id: 'leave-balance', name: '假別餘額', href: '/dashboard/hr/leave-balance', icon: CalendarRange },
      { id: 'change-logs', name: '員工異動', href: '/dashboard/hr/change-logs', icon: FileText },
      { id: 'offboard', name: '離職/復職', href: '/dashboard/hr/offboard', icon: UserMinus },
      { id: 'delegation', name: '職務代理', href: '/dashboard/hr/delegation', icon: Users2 },
      { id: 'payroll', name: '薪資管理', href: '/dashboard/hr/payroll', icon: Wallet },
      { id: 'organization', name: '組織圖', href: '/dashboard/organization', icon: Network, permission: 'org.view' },
      { id: 'attendance', name: '出勤管理', href: '/dashboard/attendance', icon: Clock },
      { id: 'leave', name: '請假管理', href: '/dashboard/leave', icon: Calendar },
      { id: 'expense', name: '費用核銷', href: '/dashboard/expense', icon: Receipt },
    ],
  },
  {
    id: 'collaboration',
    name: '協作管理',
    href: '/dashboard/messages',
    icon: MessageSquare,
    children: [
      { id: 'messages', name: '內部訊息', href: '/dashboard/messages', icon: MessageSquare },
      { id: 'projects', name: '專案管理', href: '/dashboard/projects', icon: FolderKanban },
    ],
  },
  {
    id: 'marketing',
    name: '行銷企劃',
    href: '/dashboard/marketing',
    icon: Megaphone,
    children: [],
  },
  {
    id: 'admin',
    name: '行政管理',
    href: '/dashboard/admin',
    icon: Stamp,
    permission: 'admin.view',
    children: [
      { id: 'seal', name: '用印申請', href: '/dashboard/admin/seal', icon: Stamp },
      { id: 'card', name: '名片申請', href: '/dashboard/admin/card', icon: CreditCard },
      { id: 'stationery', name: '文具管理', href: '/dashboard/admin/stationery', icon: Package },
      { id: 'workflow', name: '流程管理', href: '/dashboard/workflow', icon: Workflow, permission: 'workflow.view' },
      { id: 'approval', name: '審核中心', href: '/dashboard/approval', icon: ClipboardCheck },
    ],
  },
  {
    id: 'finance',
    name: '財務會計',
    href: '/dashboard/finance',
    icon: BookOpen,
    permission: 'finance.view',
    children: [
      { id: 'chart', name: '會計科目表', href: '/dashboard/finance/accounting/chart', icon: FileSpreadsheet },
      { id: 'periods', name: '會計期間', href: '/dashboard/finance/accounting/periods', icon: CalendarRange },
      { id: 'vouchers', name: '傳票管理', href: '/dashboard/finance/accounting/vouchers', icon: FileInput },
      { id: 'customers', name: '客戶管理', href: '/dashboard/finance/accounting/customers', icon: Contact },
      { id: 'vendors', name: '供應商管理', href: '/dashboard/finance/accounting/vendors', icon: Store },
    ],
  },
  {
    id: 'reports',
    name: '報表中心',
    href: '/dashboard/reports',
    icon: BarChart3,
    permission: 'reports.view',
    isLocked: true,
  },
  {
    id: 'system',
    name: '系統管理',
    href: '/dashboard/system',
    icon: Building2,
    permission: 'system.admin',
    isLocked: true,
    children: [
      { id: 'groups', name: '集團管理', href: '/dashboard/system/groups', icon: Building2 },
      { id: 'companies', name: '公司管理', href: '/dashboard/system/companies', icon: Building },
      { id: 'permissions', name: '權限管理', href: '/dashboard/system/permissions', icon: ShieldCheck },
      { id: 'audit-logs', name: '稽核日誌', href: '/dashboard/system/audit-logs', icon: FileSearch },
      { id: 'notification-settings', name: '通知設定', href: '/dashboard/system/notification-settings', icon: Bell },
    ],
  },
  {
    id: 'settings',
    name: '系統設定',
    href: '/dashboard/settings',
    icon: Settings,
    permission: 'settings.view',
    isLocked: true,
    children: [
      { id: 'account', name: '帳號設定', href: '/dashboard/settings/account', icon: KeyRound },
      { id: 'approval-flows', name: '審批流程', href: '/dashboard/settings/approval-flows', icon: Workflow },
      { id: 'integrations', name: '整合設定', href: '/dashboard/settings/integrations', icon: Link2 },
      { id: 'project-kpi', name: '專案 KPI', href: '/dashboard/settings/project-kpi', icon: Target },
      { id: 'menu-config', name: '選單設定', href: '/dashboard/settings/menu-config', icon: Menu },
    ],
  },
]

// 取得預設選單 ID 順序
export const getDefaultMenuOrder = (): string[] => {
  return defaultMenuItems.map((item) => item.id)
}

// 根據 ID 取得選單項目
export const getMenuItemById = (id: string): MenuItem | undefined => {
  return defaultMenuItems.find((item) => item.id === id)
}

// 取得所有子選單（扁平化）
export const getAllSubMenuItems = (): SubMenuItem[] => {
  return defaultMenuItems.flatMap((item) => item.children || [])
}

// 根據 href 找到對應的主選單 ID
export const findParentMenuByHref = (href: string): string | undefined => {
  for (const item of defaultMenuItems) {
    if (item.href === href) {
      return item.id
    }
    if (item.children) {
      for (const child of item.children) {
        if (href === child.href || href.startsWith(child.href + '/')) {
          return item.id
        }
      }
    }
  }
  return undefined
}
