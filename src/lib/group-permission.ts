import { prisma } from './prisma'
import type { GroupPermissionType } from '@prisma/client'

/**
 * 檢查員工是否擁有指定的集團級權限
 */
export async function hasGroupPermission(
  employeeId: string,
  permission: GroupPermissionType
): Promise<boolean> {
  const perm = await prisma.groupPermission.findUnique({
    where: {
      employeeId_permission: {
        employeeId,
        permission,
      },
    },
  })

  if (!perm) return false
  if (!perm.isActive) return false
  if (perm.expiresAt && perm.expiresAt < new Date()) return false

  return true
}

/**
 * 檢查員工是否為集團管理員
 */
export async function isGroupAdmin(employeeId: string): Promise<boolean> {
  return hasGroupPermission(employeeId, 'GROUP_ADMIN')
}

/**
 * 檢查員工是否可以檢視跨公司資料
 */
export async function canViewCrossCompany(employeeId: string): Promise<boolean> {
  // 集團管理員可以跨公司檢視
  if (await isGroupAdmin(employeeId)) return true
  return hasGroupPermission(employeeId, 'CROSS_COMPANY_VIEW')
}

/**
 * 檢查員工是否可以編輯跨公司資料
 */
export async function canEditCrossCompany(employeeId: string): Promise<boolean> {
  // 集團管理員可以跨公司編輯
  if (await isGroupAdmin(employeeId)) return true
  return hasGroupPermission(employeeId, 'CROSS_COMPANY_EDIT')
}

/**
 * 檢查員工是否可以檢視稽核日誌
 */
export async function canViewAuditLog(employeeId: string): Promise<boolean> {
  // 集團管理員可以檢視稽核日誌
  if (await isGroupAdmin(employeeId)) return true
  return hasGroupPermission(employeeId, 'AUDIT_LOG_VIEW')
}

/**
 * 檢查員工是否可以管理公司
 */
export async function canManageCompany(employeeId: string): Promise<boolean> {
  // 集團管理員可以管理公司
  if (await isGroupAdmin(employeeId)) return true
  return hasGroupPermission(employeeId, 'COMPANY_MANAGEMENT')
}

/**
 * 取得員工的所有集團權限
 */
export async function getGroupPermissions(employeeId: string) {
  const permissions = await prisma.groupPermission.findMany({
    where: {
      employeeId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      grantedBy: {
        select: { id: true, name: true, employeeNo: true },
      },
    },
  })

  return permissions
}

/**
 * 預設部門列表
 */
export const DEFAULT_DEPARTMENTS = [
  { code: 'D001', name: '管理部', sortOrder: 1 },
  { code: 'D002', name: '業務部', sortOrder: 2 },
  { code: 'D003', name: '行銷部', sortOrder: 3 },
  { code: 'D004', name: '產品部', sortOrder: 4 },
  { code: 'D005', name: '財會部', sortOrder: 5 },
  { code: 'D006', name: '人資部', sortOrder: 6 },
  { code: 'D007', name: '總務部', sortOrder: 7 },
  { code: 'D008', name: '客服部', sortOrder: 8 },
  { code: 'D009', name: '法務部', sortOrder: 9 },
  { code: 'D010', name: '資訊部', sortOrder: 10 },
]

/**
 * 預設職位列表
 */
export const DEFAULT_POSITIONS = [
  { code: 'P001', name: '董事長', level: 10 },
  { code: 'P002', name: '執行長', level: 9 },
  { code: 'P003', name: '總經理', level: 9 },
  { code: 'P004', name: '營運長', level: 8 },
  { code: 'P005', name: '財務長', level: 8 },
  { code: 'P006', name: '副總經理', level: 7 },
  { code: 'P007', name: '協理', level: 6 },
  { code: 'P008', name: '經理', level: 5 },
  { code: 'P009', name: '副理', level: 4 },
  { code: 'P010', name: '主任', level: 3 },
  { code: 'P011', name: '組長', level: 2 },
  { code: 'P012', name: '專員', level: 1 },
  { code: 'P013', name: '助理', level: 0 },
]
