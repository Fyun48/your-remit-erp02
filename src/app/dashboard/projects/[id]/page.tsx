import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { ProjectDetail } from './project-detail'

interface Props {
  params: { id: string }
}

export default async function ProjectDetailPage({ params }: Props) {
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
    <ProjectDetail
      projectId={params.id}
      companyId={currentCompany.id}
      currentUserId={employeeId}
    />
  )
}
