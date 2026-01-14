import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { PendingList } from '@/components/approval/pending-list'

export default async function ApprovalPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id

  // 檢查是否有下屬（是否為主管）
  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      status: 'ACTIVE',
    },
  })

  const subordinates = assignment
    ? await prisma.employeeAssignment.findMany({
        where: { supervisorId: assignment.id, status: 'ACTIVE' },
        include: { employee: true },
      })
    : []

  const isManager = subordinates.length > 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">審核中心</h1>

      {!isManager ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              您目前沒有待審核的項目
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            您有 {subordinates.length} 位下屬：
            {subordinates.map(s => s.employee.name).join('、')}
          </div>
          <PendingList approverId={assignment!.id} />
        </>
      )}
    </div>
  )
}
