import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { hasPermission as checkUserPermission } from '@/lib/permission'
import { VoucherList } from './voucher-list'

export default async function VouchersPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得當前選擇的公司（集團管理員可切換到任何公司）
  const currentCompany = await getCurrentCompany(session.user.id)

  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">傳票管理</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  // 取得所有可用公司列表
  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: { company: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  // 檢查是否有傳票管理權限
  const hasPermission = await checkUserPermission(
    session.user.id,
    currentCompany.id,
    'finance.voucher'
  )

  // 準備公司列表給前端選擇
  const assignments = employee.assignments.map(a => ({
    companyId: a.companyId,
    company: {
      id: a.company.id,
      name: a.company.name,
    },
  }))

  return (
    <VoucherList
      assignments={assignments}
      initialCompanyId={currentCompany.id}
      hasPermission={hasPermission}
    />
  )
}
