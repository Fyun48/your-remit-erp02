import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen } from 'lucide-react'

export default async function AccountChartPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: { company: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  const companyId = employee.assignments[0].companyId

  // 取得科目表
  const accounts = await prisma.accountChart.findMany({
    where: { companyId, isActive: true },
    orderBy: { code: 'asc' },
  })

  // 按類別分組
  const categories = {
    ASSET: accounts.filter(a => a.category === 'ASSET'),
    LIABILITY: accounts.filter(a => a.category === 'LIABILITY'),
    EQUITY: accounts.filter(a => a.category === 'EQUITY'),
    REVENUE: accounts.filter(a => a.category === 'REVENUE'),
    EXPENSE: accounts.filter(a => a.category === 'EXPENSE'),
  }

  const categoryNames = {
    ASSET: '資產',
    LIABILITY: '負債',
    EQUITY: '權益',
    REVENUE: '收入',
    EXPENSE: '費用',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">會計科目表</h1>
          <p className="text-muted-foreground">{employee.assignments[0].company.name}</p>
        </div>
        {accounts.length === 0 && (
          <form action="/api/accounting/init-chart" method="POST">
            <input type="hidden" name="companyId" value={companyId} />
            <Button type="submit">
              <Plus className="h-4 w-4 mr-2" />
              初始化預設科目
            </Button>
          </form>
        )}
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立會計科目表</p>
              <p className="text-sm text-muted-foreground mt-2">
                點擊「初始化預設科目」建立符合 IFRS 的標準科目表
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {(Object.keys(categories) as Array<keyof typeof categories>).map((cat) => (
            <Card key={cat}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {categoryNames[cat]} ({categories[cat].length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 w-24">代碼</th>
                        <th className="text-left py-2 px-2">名稱</th>
                        <th className="text-center py-2 px-2 w-20">層級</th>
                        <th className="text-center py-2 px-2 w-24">性質</th>
                        <th className="text-center py-2 px-2 w-24">明細</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories[cat].map((account) => (
                        <tr key={account.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-mono">{account.code}</td>
                          <td className="py-2 px-2" style={{ paddingLeft: `${(account.level - 1) * 20 + 8}px` }}>
                            {account.name}
                          </td>
                          <td className="py-2 px-2 text-center">{account.level}</td>
                          <td className="py-2 px-2 text-center">
                            {account.accountType === 'DEBIT' ? '借' : '貸'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {account.isDetail ? '✓' : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
