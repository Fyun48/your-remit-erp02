import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Phone, Mail, MapPin, CreditCard } from 'lucide-react'

export default async function VendorsPage() {
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

  // 取得所有供應商
  const vendors = await prisma.vendor.findMany({
    where: { companyId, isActive: true },
    orderBy: { code: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">供應商管理</h1>
          <p className="text-muted-foreground">{employee.assignments[0].company.name}</p>
        </div>
      </div>

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立供應商資料</p>
              <p className="text-sm text-muted-foreground mt-2">
                供應商資料用於應付帳款管理
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <Card key={vendor.id} className="hover:bg-accent/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-sm font-mono text-muted-foreground">{vendor.code}</span>
                  {vendor.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {vendor.taxId && (
                  <p className="text-muted-foreground">統編: {vendor.taxId}</p>
                )}
                {vendor.contactName && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{vendor.contactName}</span>
                  </div>
                )}
                {vendor.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{vendor.contactPhone}</span>
                  </div>
                )}
                {vendor.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{vendor.contactEmail}</span>
                  </div>
                )}
                {vendor.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{vendor.address}</span>
                  </div>
                )}
                <div className="pt-2 border-t space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>付款條件: {vendor.paymentTerms} 天</span>
                  </div>
                  {vendor.bankName && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span>{vendor.bankName} {vendor.bankAccount}</span>
                    </div>
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
