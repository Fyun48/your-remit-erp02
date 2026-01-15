import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Phone, Mail, MapPin } from 'lucide-react'

export default async function CustomersPage() {
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

  // 取得所有客戶
  const customers = await prisma.customer.findMany({
    where: { companyId, isActive: true },
    orderBy: { code: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">客戶管理</h1>
          <p className="text-muted-foreground">{employee.assignments[0].company.name}</p>
        </div>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立客戶資料</p>
              <p className="text-sm text-muted-foreground mt-2">
                客戶資料用於應收帳款管理
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card key={customer.id} className="hover:bg-accent/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-sm font-mono text-muted-foreground">{customer.code}</span>
                  {customer.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {customer.taxId && (
                  <p className="text-muted-foreground">統編: {customer.taxId}</p>
                )}
                {customer.contactName && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.contactName}</span>
                  </div>
                )}
                {customer.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.contactPhone}</span>
                  </div>
                )}
                {customer.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.contactEmail}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{customer.address}</span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between text-muted-foreground">
                  <span>付款條件: {customer.paymentTerms} 天</span>
                  {customer.creditLimit && (
                    <span>額度: ${customer.creditLimit.toLocaleString()}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
