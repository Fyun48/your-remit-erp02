import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'

export default function ApprovalPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">審核中心</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            待審核項目
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">此功能正在開發中...</p>
        </CardContent>
      </Card>
    </div>
  )
}
