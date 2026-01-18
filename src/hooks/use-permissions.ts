'use client'

import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc'
import { useMemo } from 'react'

// 嚴格控管的模組（無權限 = 隱藏選單）
const STRICT_MODULES = ['finance', 'system', 'reports', 'settings']

// 基本權限（所有員工都有）
const BASIC_PERMISSIONS = [
  'profile.view',
  'attendance.clock',
  'leave.apply',
  'expense.apply',
  'message.use',
  'approval.view_own',
  'org.view',
  'admin.seal.apply',
  'admin.card.apply',
  'admin.stationery.apply',
]

export interface PermissionInfo {
  permissions: string[]
  isGroupAdmin: boolean
  isCompanyManager: boolean
  isSuperAdmin: boolean
  hrScope: 'none' | 'same_company' | 'cross_company' | 'all'
  isLoading: boolean
}

export function usePermissions(companyId?: string): PermissionInfo {
  const { data: session } = useSession()
  const userId = (session?.user as { id?: string })?.id

  // 取得使用者的主要公司
  const { data: assignments } = trpc.employee.getAssignments.useQuery(
    { employeeId: userId! },
    { enabled: !!userId }
  )

  const primaryCompanyId = companyId || assignments?.find(a => a.isPrimary)?.companyId

  // 取得權限資料
  const { data: permissionData, isLoading } = trpc.permission.getEmployeePermissions.useQuery(
    { employeeId: userId!, companyId: primaryCompanyId! },
    { enabled: !!userId && !!primaryCompanyId }
  )

  return useMemo(() => ({
    permissions: permissionData?.permissions || BASIC_PERMISSIONS,
    isGroupAdmin: permissionData?.isGroupAdmin || false,
    isCompanyManager: permissionData?.isCompanyManager || false,
    isSuperAdmin: permissionData?.isSuperAdmin || false,
    hrScope: permissionData?.hrScope || 'none',
    isLoading,
  }), [permissionData, isLoading])
}

/**
 * 檢查是否有特定權限
 */
export function useHasPermission(permissionCode: string, companyId?: string): boolean {
  const { permissions, isGroupAdmin, isCompanyManager } = usePermissions(companyId)

  // 超級管理員和公司管理者擁有所有權限
  if (isGroupAdmin || isCompanyManager) {
    return true
  }

  // 基本權限所有人都有
  if (BASIC_PERMISSIONS.includes(permissionCode)) {
    return true
  }

  return permissions.includes(permissionCode)
}

/**
 * 檢查選單項目是否應該顯示
 * @param permission 權限代碼
 * @param userPermissions 使用者擁有的權限
 * @param isAdmin 是否為管理員
 * @returns { visible: boolean, accessible: boolean }
 */
export function checkMenuVisibility(
  permission: string | undefined,
  userPermissions: string[],
  isAdmin: boolean
): { visible: boolean; accessible: boolean } {
  // 無權限設定 = 完全開放
  if (!permission) {
    return { visible: true, accessible: true }
  }

  // 管理員看到且可訪問所有
  if (isAdmin) {
    return { visible: true, accessible: true }
  }

  const hasPermission = userPermissions.includes(permission)
  const moduleName = permission.split('.')[0]
  const isStrict = STRICT_MODULES.includes(moduleName)

  if (isStrict) {
    // 嚴格模組：無權限 = 不顯示
    return { visible: hasPermission, accessible: hasPermission }
  } else {
    // 非嚴格模組：顯示但可能無法訪問
    return { visible: true, accessible: hasPermission }
  }
}

/**
 * 取得嚴格控管的模組列表
 */
export function getStrictModules(): string[] {
  return STRICT_MODULES
}

/**
 * 取得基本權限列表
 */
export function getBasicPermissions(): string[] {
  return BASIC_PERMISSIONS
}
