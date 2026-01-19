import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { ProjectForm } from './project-form'

export default async function NewProjectPage() {
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
    <ProjectForm
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      currentUserId={employeeId}
    />
  )
}
