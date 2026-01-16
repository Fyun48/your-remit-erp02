import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CardRequestForm } from './card-request-form'

export default async function NewCardRequestPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // 取得員工及其所有任職公司
  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: {
          company: { select: { id: true, name: true, phone: true, address: true } },
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  // 整理公司列表及預設資料
  const companies = employee.assignments.map((a) => ({
    id: a.company.id,
    name: a.company.name,
    defaultData: {
      title: a.position.name,
      department: a.department.name,
      phone: a.company.phone || '',
      address: a.company.address || '',
    },
  }))

  return (
    <CardRequestForm
      applicantId={session.user.id}
      applicantName={employee.name}
      applicantEmail={employee.email}
      applicantPhone={employee.phone || ''}
      companies={companies}
    />
  )
}
