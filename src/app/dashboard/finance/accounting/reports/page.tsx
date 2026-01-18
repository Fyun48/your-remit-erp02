import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, FileText, Scale, Wallet, Receipt } from 'lucide-react'
import Link from 'next/link'

export default async function AccountingReportsPage() {
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

  const reportItems = [
    {
      title: '試算表',
      description: '各科目借貸餘額，確認借貸平衡',
      href: '/dashboard/finance/accounting/reports/trial-balance',
      icon: Scale,
    },
    {
      title: '資產負債表',
      description: '資產、負債、權益彙總報表',
      href: '/dashboard/finance/accounting/reports/balance-sheet',
      icon: BarChart3,
    },
    {
      title: '損益表',
      description: '收入、費用、淨利報表',
      href: '/dashboard/finance/accounting/reports/income-statement',
      icon: FileText,
    },
    {
      title: '現金流量表',
      description: '營業、投資、籌資活動現金流',
      href: '/dashboard/finance/accounting/reports/cash-flow',
      icon: Wallet,
    },
    {
      title: '401 營業稅申報書',
      description: '營業人銷售額與稅額申報',
      href: '/dashboard/finance/accounting/reports/vat-401',
      icon: Receipt,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">財務報表</h1>
        <p className="text-muted-foreground">{employee.assignments[0].company.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <span className="text-sm text-primary mt-4 block">查看報表 &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
