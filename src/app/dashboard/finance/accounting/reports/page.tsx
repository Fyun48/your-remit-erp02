import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { ReportsDashboard } from './reports-dashboard'

export default async function AccountingReportsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得當前選擇的公司（集團管理員可切換到任何公司）
  const currentCompany = await getCurrentCompany(session.user.id)

  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">財務報表</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  return (
    <ReportsDashboard
      companyId={currentCompany.id}
      companyName={currentCompany.name}
    />
  )
}
