import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { ProjectList } from './project-list'

export default async function ProjectsPage() {
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
      <ProjectList
        companyId={currentCompany.id}
        companyName={currentCompany.name}
        currentUserId={employeeId}
      />
    </div>
  )
}
