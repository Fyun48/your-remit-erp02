import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Receipt, Plus } from 'lucide-react'
import Link from 'next/link'

export default async function ExpenseCategoriesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // 取得所有費用類別
  const categories = await prisma.expenseCategory.findMany({
    where: { isActive: true },
    include: {
      company: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">費用類別設定</h1>
        <Link href="/dashboard/settings/expense-categories/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增類別
          </Button>
        </Link>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">尚未設定任何費用類別</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  <span>{category.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ({category.code})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.description && (
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {category.requiresReceipt && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                      需發票
                    </span>
                  )}
                  {category.requiresPreApproval && (
                    <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full">
                      需事前核准
                    </span>
                  )}
                  {category.maxAmountPerItem && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                      單項上限 ${category.maxAmountPerItem.toLocaleString()}
                    </span>
                  )}
                  {category.maxAmountPerMonth && (
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                      月上限 ${category.maxAmountPerMonth.toLocaleString()}
                    </span>
                  )}
                </div>
                {category.company && (
                  <p className="text-xs text-muted-foreground">
                    適用公司：{category.company.name}
                  </p>
                )}
                {!category.company && (
                  <p className="text-xs text-muted-foreground">
                    適用範圍：集團通用
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
