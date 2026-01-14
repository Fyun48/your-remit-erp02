import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'

export default function HRPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">人事管理</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            員工管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">此功能正在開發中...</p>
        </CardContent>
      </Card>
    </div>
  )
}
