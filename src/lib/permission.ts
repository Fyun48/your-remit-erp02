import { prisma } from './prisma'
import { isGroupAdmin } from './group-permission'

/**
 * 系統功能模組定義
 * 每個模組代表一個功能區塊，有權限就能執行該模組的所有操作（新增/修改/刪除/查看）
 */
export const SYSTEM_MODULES = {
  // 基本權限（所有員工都有）
  PROFILE_VIEW: { code: 'profile.view', name: '檢視個人資料', module: 'profile', isBasic: true },
  ATTENDANCE_CLOCK: { code: 'attendance.clock', name: '打卡', module: 'attendance', isBasic: true },
  LEAVE_APPLY: { code: 'leave.apply', name: '請假申請', module: 'leave', isBasic: true },
  EXPENSE_APPLY: { code: 'expense.apply', name: '費用報銷', module: 'expense', isBasic: true },

  // 人事管理
  HR_EMPLOYEE: { code: 'hr.employee', name: '員工管理', module: 'hr', isBasic: false },
  HR_DEPARTMENT: { code: 'hr.department', name: '部門管理', module: 'hr', isBasic: false },
  HR_POSITION: { code: 'hr.position', name: '職位管理', module: 'hr', isBasic: false },
  HR_TRANSFER: { code: 'hr.transfer', name: '調動作業', module: 'hr', isBasic: false },
  HR_OFFBOARD: { code: 'hr.offboard', name: '離職作業', module: 'hr', isBasic: false },

  // 出勤管理
  ATTENDANCE_MANAGE: { code: 'attendance.manage', name: '出勤管理', module: 'attendance', isBasic: false },
  ATTENDANCE_SHIFT: { code: 'attendance.shift', name: '班別管理', module: 'attendance', isBasic: false },

  // 請假管理
  LEAVE_MANAGE: { code: 'leave.manage', name: '請假管理', module: 'leave', isBasic: false },
  LEAVE_TYPE: { code: 'leave.type', name: '假別管理', module: 'leave', isBasic: false },
  LEAVE_APPROVE: { code: 'leave.approve', name: '請假審核', module: 'leave', isBasic: false },

  // 費用管理
  EXPENSE_MANAGE: { code: 'expense.manage', name: '費用管理', module: 'expense', isBasic: false },
  EXPENSE_APPROVE: { code: 'expense.approve', name: '費用審核', module: 'expense', isBasic: false },
  EXPENSE_CATEGORY: { code: 'expense.category', name: '費用類別管理', module: 'expense', isBasic: false },

  // 財務會計
  FINANCE_VOUCHER: { code: 'finance.voucher', name: '傳票管理', module: 'finance', isBasic: false },
  FINANCE_ACCOUNT: { code: 'finance.account', name: '會計科目管理', module: 'finance', isBasic: false },
  FINANCE_CUSTOMER: { code: 'finance.customer', name: '客戶管理', module: 'finance', isBasic: false },
  FINANCE_VENDOR: { code: 'finance.vendor', name: '供應商管理', module: 'finance', isBasic: false },
  FINANCE_AR: { code: 'finance.ar', name: '應收帳款', module: 'finance', isBasic: false },
  FINANCE_AP: { code: 'finance.ap', name: '應付帳款', module: 'finance', isBasic: false },

  // 行政庶務
  ADMIN_SEAL: { code: 'admin.seal', name: '用印管理', module: 'admin', isBasic: false },
  ADMIN_CARD: { code: 'admin.card', name: '名片管理', module: 'admin', isBasic: false },
  ADMIN_STATIONERY: { code: 'admin.stationery', name: '文具管理', module: 'admin', isBasic: false },

  // 系統管理
  SYSTEM_COMPANY: { code: 'system.company', name: '公司管理', module: 'system', isBasic: false },
  SYSTEM_PERMISSION: { code: 'system.permission', name: '權限管理', module: 'system', isBasic: false },
  SYSTEM_ROLE: { code: 'system.role', name: '角色管理', module: 'system', isBasic: false },
  SYSTEM_AUDIT: { code: 'system.audit', name: '稽核日誌', module: 'system', isBasic: false },
  SYSTEM_APPROVAL_FLOW: { code: 'system.approval_flow', name: '審核流程管理', module: 'system', isBasic: false },
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
 * 檢查員工是否擁有特定權限
 */
export async function hasPermission(
  employeeId: string,
  companyId: string,
  permissionCode: ModuleCode
): Promise<boolean> {
  // 1. 基本權限：所有員工都有
  const module = Object.values(SYSTEM_MODULES).find(m => m.code === permissionCode)
  if (module?.isBasic) {
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

  // 4. 檢查角色權限
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

  // 5. 檢查個人特殊權限
  const permission = await prisma.permission.findUnique({
    where: { code: permissionCode },
  })

  if (!permission) return false

  const employeePermission = await prisma.employeePermission.findUnique({
    where: {
      employeeId_companyId_permissionId: {
        employeeId,
        companyId,
        permissionId: permission.id,
      },
    },
  })

  if (!employeePermission) return false

  // 檢查是否為授予且未過期
  if (employeePermission.grantType !== 'GRANT') return false
  if (employeePermission.expiresAt && employeePermission.expiresAt < new Date()) return false

  return true
}

/**
 * 取得員工在特定公司的所有權限
 */
export async function getEmployeePermissions(
  employeeId: string,
  companyId: string
): Promise<{
  isGroupAdmin: boolean
  isCompanyManager: boolean
  permissions: string[]
}> {
  const groupAdmin = await isGroupAdmin(employeeId)
  const companyManager = await isCompanyManager(employeeId, companyId)

  // 如果是集團管理員或公司管理人員，擁有所有權限
  if (groupAdmin || companyManager) {
    return {
      isGroupAdmin: groupAdmin,
      isCompanyManager: companyManager,
      permissions: Object.values(SYSTEM_MODULES).map(m => m.code),
    }
  }

  // 基本權限
  const permissions = new Set<string>(
    Object.values(SYSTEM_MODULES)
      .filter(m => m.isBasic)
      .map(m => m.code)
  )

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

  // 個人特殊權限
  const employeePermissions = await prisma.employeePermission.findMany({
    where: {
      employeeId,
      companyId,
      grantType: 'GRANT',
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
    permissions.add(ep.permission.code)
  }

  return {
    isGroupAdmin: false,
    isCompanyManager: false,
    permissions: Array.from(permissions),
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
    const module = Object.values(SYSTEM_MODULES).find(m => m.code === permissionCode)
    if (!module) {
      throw new Error(`未知的權限代碼: ${permissionCode}`)
    }

    permission = await prisma.permission.create({
      data: {
        code: permissionCode,
        name: module.name,
        module: module.module,
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
