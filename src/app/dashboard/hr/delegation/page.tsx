import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { DelegationList } from './delegation-list'

export default async function DelegationPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">職務代理</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  return (
    <DelegationList
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      currentUserId={session.user.id}
    />
  )
}
