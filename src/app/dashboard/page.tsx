import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, Calendar, FileText } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()

  const stats = [
    { name: '待審核申請', value: '12', icon: FileText, color: 'text-blue-600' },
    { name: '本月出勤天數', value: '18', icon: Clock, color: 'text-green-600' },
    { name: '剩餘特休', value: '7 天', icon: Calendar, color: 'text-orange-600' },
    { name: '部門人數', value: '25', icon: Users, color: 'text-purple-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          歡迎回來，{session?.user?.name}
        </h1>
        <p className="text-gray-500">這是您的儀表板概覽</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {stat.name}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近活動</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">暫無活動記錄</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>待辦事項</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">暫無待辦事項</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
