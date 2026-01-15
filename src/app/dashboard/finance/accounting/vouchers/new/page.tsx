import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { VoucherForm } from './voucher-form'

export default async function NewVoucherPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id

  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: { company: true },
  })

  if (!assignment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">新增傳票</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">尚未指派任職公司</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <VoucherForm
      companyId={assignment.companyId}
      companyName={assignment.company.name}
      employeeId={employeeId}
    />
  )
}
