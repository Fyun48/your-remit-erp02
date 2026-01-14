import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

export default function LeavePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">請假管理</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            請假申請
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">此功能正在開發中...</p>
        </CardContent>
      </Card>
    </div>
  )
}
