import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { EmployeePathsList } from './employee-paths-list'

export default async function EmployeePathsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id
  const currentCompany = await getCurrentCompany(employeeId)

  if (!currentCompany) {
    redirect('/dashboard')
  }

  // 取得公司的 groupId
  const companyWithGroup = await prisma.company.findUnique({
    where: { id: currentCompany.id },
    select: { groupId: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">員工特殊路徑</h1>
        <p className="text-muted-foreground">
          為特定員工設定專屬的簽核流程，優先於一般流程
        </p>
      </div>

      <EmployeePathsList
        companyId={currentCompany.id}
        groupId={companyWithGroup?.groupId || undefined}
        currentUserId={employeeId}
      />
    </div>
  )
}
