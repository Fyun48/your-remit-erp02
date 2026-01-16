import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { User, Mail, Phone, Building2, Briefcase } from 'lucide-react'
import { ChangePasswordForm } from './change-password-form'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: {
          company: true,
          department: true,
          position: true,
        },
        orderBy: { isPrimary: 'desc' },
      },
    },
  })

  if (!employee) redirect('/login')

  const primaryAssignment = employee.assignments.find(a => a.isPrimary)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">個人資料</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 基本資料卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本資料
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={employee.avatarUrl || undefined} alt={employee.name} />
                <AvatarFallback className="text-xl">
                  {employee.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{employee.name}</h2>
                <p className="text-muted-foreground font-mono">{employee.employeeNo}</p>
                {primaryAssignment && (
                  <Badge variant="outline" className="mt-1">
                    {primaryAssignment.position.name}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{employee.email}</span>
              </div>
              {employee.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.phone}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 任職資料卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              任職資料
            </CardTitle>
            <CardDescription>
              目前任職的公司與職位
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {employee.assignments.map((assignment) => (
              <div
                key={assignment.id}
                className={`p-3 rounded-lg border ${assignment.isPrimary ? 'bg-primary/5 border-primary/20' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{assignment.company.name}</span>
                  </div>
                  {assignment.isPrimary && (
                    <Badge variant="default" className="text-xs">主要</Badge>
                  )}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {assignment.department.name} / {assignment.position.name}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  到職日期：{new Date(assignment.startDate).toLocaleDateString('zh-TW')}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 變更密碼卡片 */}
        <div className="md:col-span-2">
          <ChangePasswordForm employeeId={employee.id} />
        </div>
      </div>
    </div>
  )
}
