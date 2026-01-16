import { prisma } from './prisma'

/**
 * 取得預設集團名稱（用於登入頁面等未登入狀態）
 * 取第一個有效的集團名稱
 */
export async function getDefaultGroupName(): Promise<string> {
  const group = await prisma.group.findFirst({
    where: { isActive: true },
    select: { name: true },
    orderBy: { createdAt: 'asc' },
  })
  return group?.name || '集團'
}
