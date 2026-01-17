import { prisma } from './prisma'

export type NotificationType =
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'REVISION_REQUIRED'
  | 'APPROVAL_NEEDED'

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  refType: string  // 'LeaveRequest' | 'ExpenseRequest' | 'SealRequest'
  refId: string
}

/**
 * 建立單一通知
 * @param params 通知參數
 * @returns 新建立的通知
 */
export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      refType: params.refType,
      refId: params.refId,
    }
  })
}

/**
 * 批次建立多個通知
 * @param notifications 通知參數陣列
 * @returns 建立的通知數量
 */
export async function createNotifications(notifications: CreateNotificationParams[]) {
  return prisma.notification.createMany({
    data: notifications.map(n => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      refType: n.refType,
      refId: n.refId,
    }))
  })
}

/**
 * 刪除指定參考類型和 ID 的所有通知
 * 當申請單被刪除時可使用此函數清除相關通知
 * @param refType 參考類型
 * @param refId 參考 ID
 * @returns 刪除的通知數量
 */
export async function deleteNotificationsByRef(refType: string, refId: string) {
  return prisma.notification.deleteMany({
    where: {
      refType,
      refId,
    }
  })
}
