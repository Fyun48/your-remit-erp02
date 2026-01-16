import { prisma } from './prisma'
import { isGroupAdmin } from './group-permission'
import { cookies } from 'next/headers'

interface CurrentCompany {
  id: string
  name: string
  code: string
}

/**
 * 取得使用者當前工作的公司
 * - 集團管理員：使用 cookie 中選擇的公司，若無則使用主要任職公司
 * - 一般使用者：使用主要任職公司
 */
export async function getCurrentCompany(employeeId: string): Promise<CurrentCompany | null> {
  // 檢查是否為集團管理員
  const hasAdminPermission = await isGroupAdmin(employeeId)

  console.log('getCurrentCompany - hasAdminPermission:', hasAdminPermission)

  if (hasAdminPermission) {
    // 從 cookie 讀取選擇的公司 ID
    const cookieStore = await cookies()
    const selectedCompanyId = cookieStore.get('selectedCompanyId')?.value

    console.log('getCurrentCompany - selectedCompanyId from cookie:', selectedCompanyId)

    if (selectedCompanyId) {
      const company = await prisma.company.findUnique({
        where: { id: selectedCompanyId, isActive: true },
        select: { id: true, name: true, code: true },
      })
      console.log('getCurrentCompany - found company:', company?.name)
      if (company) return company
    }
  }

  // 取得主要任職公司
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: {
      company: {
        select: { id: true, name: true, code: true },
      },
    },
  })

  return assignment?.company || null
}

/**
 * 取得使用者的集團管理員狀態和當前公司
 */
export async function getCompanyContext(employeeId: string) {
  const hasAdminPermission = await isGroupAdmin(employeeId)
  const currentCompany = await getCurrentCompany(employeeId)

  // 取得主要任職公司（用於判斷預設）
  const primaryAssignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: {
      company: {
        select: { id: true, name: true, code: true },
      },
    },
  })

  // 取得集團名稱
  let groupName = '集團'
  if (currentCompany) {
    const companyWithGroup = await prisma.company.findUnique({
      where: { id: currentCompany.id },
      include: {
        group: {
          select: { name: true },
        },
      },
    })
    if (companyWithGroup?.group?.name) {
      groupName = companyWithGroup.group.name
    }
  }

  return {
    isGroupAdmin: hasAdminPermission,
    currentCompany,
    primaryCompany: primaryAssignment?.company || null,
    groupName,
  }
}
