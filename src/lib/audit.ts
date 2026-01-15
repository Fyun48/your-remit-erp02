import { prisma } from './prisma'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

interface AuditLogParams {
  entityType: string
  entityId: string
  action: AuditAction
  path?: string
  oldValue?: unknown
  newValue?: unknown
  operatorId: string
  companyId?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * 記錄稽核日誌
 */
export async function createAuditLog(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        path: params.path,
        oldValue: params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : null,
        newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : null,
        operatorId: params.operatorId,
        companyId: params.companyId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (error) {
    // 稽核日誌記錄失敗不應影響主要操作
    console.error('Failed to create audit log:', error)
  }
}

/**
 * 記錄新增操作
 */
export async function auditCreate(
  entityType: string,
  entityId: string,
  newValue: unknown,
  operatorId: string,
  companyId?: string
) {
  await createAuditLog({
    entityType,
    entityId,
    action: 'CREATE',
    newValue,
    operatorId,
    companyId,
  })
}

/**
 * 記錄更新操作
 */
export async function auditUpdate(
  entityType: string,
  entityId: string,
  oldValue: unknown,
  newValue: unknown,
  operatorId: string,
  companyId?: string
) {
  // 計算變更的路徑
  const changes = getChangedPaths(oldValue, newValue)

  await createAuditLog({
    entityType,
    entityId,
    action: 'UPDATE',
    path: changes.join(', '),
    oldValue,
    newValue,
    operatorId,
    companyId,
  })
}

/**
 * 記錄刪除操作
 */
export async function auditDelete(
  entityType: string,
  entityId: string,
  oldValue: unknown,
  operatorId: string,
  companyId?: string
) {
  await createAuditLog({
    entityType,
    entityId,
    action: 'DELETE',
    oldValue,
    operatorId,
    companyId,
  })
}

/**
 * 比較兩個物件，返回變更的欄位路徑
 */
function getChangedPaths(
  oldValue: unknown,
  newValue: unknown,
  prefix = ''
): string[] {
  const changes: string[] = []

  if (!oldValue || !newValue) return changes
  if (typeof oldValue !== 'object' || typeof newValue !== 'object') return changes

  const oldObj = oldValue as Record<string, unknown>
  const newObj = newValue as Record<string, unknown>

  // 檢查所有新值的鍵
  for (const key of Object.keys(newObj)) {
    const path = prefix ? `${prefix}.${key}` : key
    const oldVal = oldObj[key]
    const newVal = newObj[key]

    // 跳過 Prisma 的關聯物件和系統欄位
    if (key === 'updatedAt' || key === 'createdAt') continue
    if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal)) {
      // 遞迴處理巢狀物件
      if (oldVal && typeof oldVal === 'object') {
        changes.push(...getChangedPaths(oldVal, newVal, path))
      }
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push(path)
    }
  }

  return changes
}

/**
 * 批量記錄稽核日誌
 */
export async function createAuditLogBatch(logs: AuditLogParams[]) {
  try {
    await prisma.auditLog.createMany({
      data: logs.map(log => ({
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        path: log.path,
        oldValue: log.oldValue ? JSON.parse(JSON.stringify(log.oldValue)) : null,
        newValue: log.newValue ? JSON.parse(JSON.stringify(log.newValue)) : null,
        operatorId: log.operatorId,
        companyId: log.companyId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
      })),
    })
  } catch (error) {
    console.error('Failed to create audit logs:', error)
  }
}
