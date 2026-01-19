import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCurrentCompany } from '@/lib/use-current-company'
import { TemplateList } from './template-list'

export default async function ProjectTemplatesPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id
  const currentCompany = await getCurrentCompany(employeeId)

  if (!currentCompany) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <TemplateList
        companyId={currentCompany.id}
        currentUserId={employeeId}
      />
    </div>
  )
}
