import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GitBranch } from 'lucide-react'

export default async function ApprovalFlowsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得所有審核流程
  const flows = await prisma.approvalFlow.findMany({
    where: { isActive: true },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
      company: true,
    },
    orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }],
  })

  const moduleNames: Record<string, string> = {
    leave: '請假',
    expense: '費用報銷',
    overtime: '加班',
  }

  const approverTypeNames: Record<string, string> = {
    SUPERVISOR: '直屬主管',
    DEPARTMENT_HEAD: '部門主管',
    POSITION_LEVEL: '指定職級',
    SPECIFIC_POSITION: '指定職位',
    SPECIFIC_EMPLOYEE: '指定員工',
    ROLE: '指定角色',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">審核流程設定</h1>
      </div>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">尚未設定任何審核流程</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    {flow.name}
                    {flow.isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                        預設
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-normal text-muted-foreground">
                    {moduleNames[flow.module] || flow.module}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  {flow.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div className="px-3 py-1.5 bg-muted rounded-lg text-sm">
                        <span className="font-medium">{step.name}</span>
                        <span className="text-muted-foreground ml-1">
                          ({approverTypeNames[step.approverType] || step.approverType})
                        </span>
                      </div>
                      {index < flow.steps.length - 1 && (
                        <span className="mx-2 text-muted-foreground">→</span>
                      )}
                    </div>
                  ))}
                </div>
                {flow.conditions && (
                  <p className="text-sm text-muted-foreground mt-2">
                    條件：{flow.conditions}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
