import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系統設定</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            設定選項
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">此功能正在開發中...</p>
        </CardContent>
      </Card>
    </div>
  )
}
