import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">出勤管理</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            出勤紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">此功能正在開發中...</p>
        </CardContent>
      </Card>
    </div>
  )
}
