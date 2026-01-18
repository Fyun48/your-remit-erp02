import { prisma } from './prisma'
import { isGroupAdmin } from './group-permission'

/**
 * 系統功能模組定義
 * 每個模組代表一個功能區塊
 * isBasic: true 表示所有員工都擁有
 */
export const SYSTEM_MODULES = {
  // =====================================================
  // 基本權限（所有員工都有）
  // =====================================================
  PROFILE_VIEW: { code: 'profile.view', name: '檢視個人資料', module: 'profile', isBasic: true },
  ATTENDANCE_CLOCK: { code: 'attendance.clock', name: '打卡', module: 'attendance', isBasic: true },
  LEAVE_APPLY: { code: 'leave.apply', name: '請假申請', module: 'leave', isBasic: true },
  EXPENSE_APPLY: { code: 'expense.apply', name: '費用報銷申請', module: 'expense', isBasic: true },
  MESSAGE_USE: { code: 'message.use', name: '內部訊息', module: 'message', isBasic: true },
  APPROVAL_VIEW_OWN: { code: 'approval.view_own', name: '查看自己審核進度', module: 'approval', isBasic: true },
  ORG_VIEW: { code: 'org.view', name: '查看組織圖', module: 'org', isBasic: true },
  // 行政申請（基本權限 - 只能申請，不能管理）
  ADMIN_SEAL_APPLY: { code: 'admin.seal.apply', name: '用印申請', module: 'admin', isBasic: true },
  ADMIN_CARD_APPLY: { code: 'admin.card.apply', name: '名片申請', module: 'admin', isBasic: true },
  ADMIN_STATIONERY_APPLY: { code: 'admin.stationery.apply', name: '文具申請', module: 'admin', isBasic: true },

  // =====================================================
  // 進階權限（需特殊授予或符合條件）
  // =====================================================

  // 人事管理
  HR_VIEW: { code: 'hr.view', name: '人事管理檢視', module: 'hr', isBasic: false },
  HR_EMPLOYEE: { code: 'hr.employee', name: '員工管理', module: 'hr', isBasic: false },
  HR_DEPARTMENT: { code: 'hr.department', name: '部門管理', module: 'hr', isBasic: false },
  HR_POSITION: { code: 'hr.position', name: '職位管理', module: 'hr', isBasic: false },
  HR_TRANSFER: { code: 'hr.transfer', name: '調動作業', module: 'hr', isBasic: false },
  HR_OFFBOARD: { code: 'hr.offboard', name: '離職作業', module: 'hr', isBasic: false },

  // 出勤管理（進階）
  ATTENDANCE_MANAGE: { code: 'attendance.manage', name: '出勤管理', module: 'attendance', isBasic: false },
  ATTENDANCE_SHIFT: { code: 'attendance.shift', name: '班別管理', module: 'attendance', isBasic: false },

  // 請假管理（進階）
  LEAVE_MANAGE: { code: 'leave.manage', name: '請假管理', module: 'leave', isBasic: false },
  LEAVE_TYPE: { code: 'leave.type', name: '假別管理', module: 'leave', isBasic: false },
  LEAVE_APPROVE: { code: 'leave.approve', name: '請假審核', module: 'leave', isBasic: false },

  // 費用管理（進階）
  EXPENSE_MANAGE: { code: 'expense.manage', name: '費用管理', module: 'expense', isBasic: false },
  EXPENSE_APPROVE: { code: 'expense.approve', name: '費用審核', module: 'expense', isBasic: false },
  EXPENSE_CATEGORY: { code: 'expense.category', name: '費用類別管理', module: 'expense', isBasic: false },

  // 財務會計
  FINANCE_VIEW: { code: 'finance.view', name: '財務會計檢視', module: 'finance', isBasic: false },
  FINANCE_VOUCHER: { code: 'finance.voucher', name: '傳票管理', module: 'finance', isBasic: false },
  FINANCE_ACCOUNT: { code: 'finance.account', name: '會計科目管理', module: 'finance', isBasic: false },
  FINANCE_CUSTOMER: { code: 'finance.customer', name: '客戶管理', module: 'finance', isBasic: false },
  FINANCE_VENDOR: { code: 'finance.vendor', name: '供應商管理', module: 'finance', isBasic: false },
  FINANCE_AR: { code: 'finance.ar', name: '應收帳款', module: 'finance', isBasic: false },
  FINANCE_AP: { code: 'finance.ap', name: '應付帳款', module: 'finance', isBasic: false },

  // 行政管理（進階 - 管理功能）
  ADMIN_VIEW: { code: 'admin.view', name: '行政管理', module: 'admin', isBasic: false },
  ADMIN_SEAL: { code: 'admin.seal', name: '用印管理', module: 'admin', isBasic: false },
  ADMIN_CARD: { code: 'admin.card', name: '名片管理', module: 'admin', isBasic: false },
  ADMIN_STATIONERY: { code: 'admin.stationery', name: '文具管理', module: 'admin', isBasic: false },

  // 流程管理
  WORKFLOW_VIEW: { code: 'workflow.view', name: '流程管理檢視', module: 'workflow', isBasic: false },
  WORKFLOW_EDIT: { code: 'workflow.edit', name: '流程編輯', module: 'workflow', isBasic: false },

  // 報表中心
  REPORTS_VIEW: { code: 'reports.view', name: '報表中心', module: 'reports', isBasic: false },

  // 系統管理
  SYSTEM_ADMIN: { code: 'system.admin', name: '系統管理', module: 'system', isBasic: false },
  SYSTEM_COMPANY: { code: 'system.company', name: '公司管理', module: 'system', isBasic: false },
  SYSTEM_PERMISSION: { code: 'system.permission', name: '權限管理', module: 'system', isBasic: false },
  SYSTEM_ROLE: { code: 'system.role', name: '角色管理', module: 'system', isBasic: false },
  SYSTEM_AUDIT: { code: 'system.audit', name: '稽核日誌', module: 'system', isBasic: false },
  SYSTEM_APPROVAL_FLOW: { code: 'system.approval_flow', name: '審核流程管理', module: 'system', isBasic: false },

  // 系統設定
  SETTINGS_VIEW: { code: 'settings.view', name: '系統設定', module: 'settings', isBasic: false },
} as const

export type ModuleCode = typeof SYSTEM_MODULES[keyof typeof SYSTEM_MODULES]['code']

/**
 * 取得所有功能模組（用於 UI 顯示）
 */
export function getAllModules() {
  return Object.values(SYSTEM_MODULES).map(m => ({
    code: m.code,
    name: m.name,
    module: m.module,
    isBasic: m.isBasic,
  }))
}

/**
 * 取得非基本功能模組（可分配的特殊權限）
 */
export function getAssignableModules() {
  return getAllModules().filter(m => !m.isBasic)
}

/**
 * 依模組分組
 */
export function getModulesGrouped() {
  const modules = getAssignableModules()
  const grouped: Record<string, typeof modules> = {}

  const moduleNames: Record<string, string> = {
    hr: '人事管理',
    attendance: '出勤管理',
    leave: '請假管理',
    expense: '費用管理',
    finance: '財務會計',
    admin: '行政庶務',
    system: '系統管理',
  }

  for (const m of modules) {
    if (!grouped[m.module]) {
      grouped[m.module] = []
    }
    grouped[m.module].push(m)
  }

  return Object.entries(grouped).map(([key, items]) => ({
    module: key,
    name: moduleNames[key] || key,
    permissions: items,
  }))
}

/**
 * 檢查員工是否為公司管理人員
 * 條件：管理部（部門名稱包含「管理」）+ 副總經理以上（level >= 7）
 */
export async function isCompanyManager(employeeId: string, companyId: string): Promise<boolean> {
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      companyId,
      status: 'ACTIVE',
    },
    include: {
      department: true,
      position: true,
    },
  })

  if (!assignment) return false

  // 檢查是否在管理部門（名稱包含「管理」）
  const isInManagementDept = assignment.department.name.includes('管理')

  // 檢查是否為副總經理以上（level >= 7）
  const isHighLevel = assignment.position.level >= 7

  return isInManagementDept && isHighLevel
}

/**
 * 取得員工的部門/職位加成權限
 * 根據設計規則：
 * - 財務會計部（非總務職位）：+財務會計
 * - 總務職位（一般）：+人事管理（同公司）
 * - 總務職位（主管級，Level >= 5）：+人事管理（跨公司）
 */
export async function getDepartmentPositionBonusPermissions(
  employeeId: string,
  companyId: string
): Promise<{
  permissions: string[]
  hrScope: 'none' | 'same_company' | 'cross_company'
}> {
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      companyId,
      status: 'ACTIVE',
    },
    include: {
      department: true,
      position: true,
    },
  })

  if (!assignment) {
    return { permissions: [], hrScope: 'none' }
  }

  const permissions = new Set<string>()
  let hrScope: 'none' | 'same_company' | 'cross_company' = 'none'

  const deptName = assignment.department.name
  const positionName = assignment.position.name
  const positionLevel = assignment.position.level

  // 檢查是否為總務職位
  const is總務 = positionName.includes('總務')

  // 規則1: 財務會計部（非總務職位）→ +財務會計
  if (deptName.includes('財務會計') && !is總務) {
    permissions.add('finance.view')
    permissions.add('finance.voucher')
    permissions.add('finance.account')
    permissions.add('finance.customer')
    permissions.add('finance.vendor')
    permissions.add('finance.ar')
    permissions.add('finance.ap')
  }

  // 規則2: 總務職位（一般）→ +人事管理（同公司）
  // 規則3: 總務職位（主管級，Level >= 5）→ +人事管理（跨公司）
  if (is總務) {
    permissions.add('hr.view')
    permissions.add('hr.employee')
    permissions.add('hr.department')
    permissions.add('hr.position')
    permissions.add('hr.transfer')
    permissions.add('hr.offboard')

    if (positionLevel >= 5) {
      hrScope = 'cross_company'
    } else {
      hrScope = 'same_company'
    }
  }

  return { permissions: Array.from(permissions), hrScope }
}

/**
 * 檢查員工是否擁有特定權限
 * 優先順序：特殊權限 > 部門/職位加成 > 角色權限 > 基本權限
 */
export async function hasPermission(
  employeeId: string,
  companyId: string,
  permissionCode: ModuleCode
): Promise<boolean> {
  // 1. 基本權限：所有員工都有
  const systemModule = Object.values(SYSTEM_MODULES).find(m => m.code === permissionCode)
  if (systemModule?.isBasic) {
    return true
  }

  // 2. 集團管理員：擁有所有權限
  const groupAdmin = await isGroupAdmin(employeeId)
  if (groupAdmin) {
    return true
  }

  // 3. 公司管理人員（管理部 + 副總經理以上）：擁有該公司所有權限
  const companyManager = await isCompanyManager(employeeId, companyId)
  if (companyManager) {
    return true
  }

  // 4. 檢查個人特殊權限（最高優先級）
  const permission = await prisma.permission.findUnique({
    where: { code: permissionCode },
  })

  if (permission) {
    const employeePermission = await prisma.employeePermission.findUnique({
      where: {
        employeeId_companyId_permissionId: {
          employeeId,
          companyId,
          permissionId: permission.id,
        },
      },
    })

    if (employeePermission) {
      // 檢查是否為授予且未過期
      if (employeePermission.grantType === 'GRANT') {
        if (!employeePermission.expiresAt || employeePermission.expiresAt > new Date()) {
          return true
        }
      }
      // 如果是 REVOKE 類型，則被拒絕（特殊權限優先級最高）
      if (employeePermission.grantType === 'REVOKE') {
        return false
      }
    }
  }

  // 5. 檢查部門/職位加成權限
  const bonusPermissions = await getDepartmentPositionBonusPermissions(employeeId, companyId)
  if (bonusPermissions.permissions.includes(permissionCode)) {
    return true
  }

  // 6. 檢查角色權限
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      companyId,
      status: 'ACTIVE',
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  if (assignment?.role) {
    const hasRolePermission = assignment.role.permissions.some(
      rp => rp.permission.code === permissionCode
    )
    if (hasRolePermission) {
      return true
    }
  }

  return false
}

/**
 * 取得員工在特定公司的所有權限
 * 包含：基本權限 + 部門/職位加成 + 角色權限 + 特殊權限
 */
export async function getEmployeePermissions(
  employeeId: string,
  companyId: string
): Promise<{
  isGroupAdmin: boolean
  isCompanyManager: boolean
  isSuperAdmin: boolean
  permissions: string[]
  hrScope: 'none' | 'same_company' | 'cross_company' | 'all'
}> {
  const groupAdmin = await isGroupAdmin(employeeId)
  const companyManager = await isCompanyManager(employeeId, companyId)

  // 如果是集團管理員或公司管理人員，擁有所有權限
  if (groupAdmin || companyManager) {
    return {
      isGroupAdmin: groupAdmin,
      isCompanyManager: companyManager,
      isSuperAdmin: groupAdmin,
      permissions: Object.values(SYSTEM_MODULES).map(m => m.code),
      hrScope: 'all',
    }
  }

  // 基本權限
  const permissions = new Set<string>(
    Object.values(SYSTEM_MODULES)
      .filter(m => m.isBasic)
      .map(m => m.code)
  )

  // 部門/職位加成權限
  const bonusPermissions = await getDepartmentPositionBonusPermissions(employeeId, companyId)
  for (const p of bonusPermissions.permissions) {
    permissions.add(p)
  }

  // 角色權限
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      companyId,
      status: 'ACTIVE',
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  if (assignment?.role) {
    for (const rp of assignment.role.permissions) {
      permissions.add(rp.permission.code)
    }
  }

  // 個人特殊權限（最高優先級）
  const employeePermissions = await prisma.employeePermission.findMany({
    where: {
      employeeId,
      companyId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      permission: true,
    },
  })

  for (const ep of employeePermissions) {
    if (ep.grantType === 'GRANT') {
      permissions.add(ep.permission.code)
    } else if (ep.grantType === 'REVOKE') {
      // 特殊權限 REVOKE 可以移除其他來源的權限
      permissions.delete(ep.permission.code)
    }
  }

  return {
    isGroupAdmin: false,
    isCompanyManager: false,
    isSuperAdmin: false,
    permissions: Array.from(permissions),
    hrScope: bonusPermissions.hrScope,
  }
}

/**
 * 授予員工特殊權限
 */
export async function grantPermission(
  employeeId: string,
  companyId: string,
  permissionCode: string,
  grantedById: string,
  expiresAt?: Date
) {
  // 確保 Permission 存在
  let permission = await prisma.permission.findUnique({
    where: { code: permissionCode },
  })

  if (!permission) {
    // 從系統模組中取得資訊
    const systemModule = Object.values(SYSTEM_MODULES).find(m => m.code === permissionCode)
    if (!systemModule) {
      throw new Error(`未知的權限代碼: ${permissionCode}`)
    }

    permission = await prisma.permission.create({
      data: {
        code: permissionCode,
        name: systemModule.name,
        module: systemModule.module,
      },
    })
  }

  // 授予權限
  return prisma.employeePermission.upsert({
    where: {
      employeeId_companyId_permissionId: {
        employeeId,
        companyId,
        permissionId: permission.id,
      },
    },
    update: {
      grantType: 'GRANT',
      grantedById,
      grantedAt: new Date(),
      expiresAt,
    },
    create: {
      employeeId,
      companyId,
      permissionId: permission.id,
      grantType: 'GRANT',
      grantedById,
      expiresAt,
    },
  })
}

/**
 * 移除員工特殊權限
 */
export async function revokePermission(
  employeeId: string,
  companyId: string,
  permissionCode: string
) {
  const permission = await prisma.permission.findUnique({
    where: { code: permissionCode },
  })

  if (!permission) return

  await prisma.employeePermission.deleteMany({
    where: {
      employeeId,
      companyId,
      permissionId: permission.id,
    },
  })
}
