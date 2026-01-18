import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LineSettings } from '@/components/settings/line-settings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { User } from 'lucide-react'

export default async function AccountSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">帳號設定</h1>
        <p className="text-muted-foreground">管理您的個人帳號與連結設定</p>
      </div>

      <div className="grid gap-6">
        {/* 基本資訊 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本資訊
            </CardTitle>
            <CardDescription>
              您的帳號基本資訊
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">姓名</p>
                <p className="font-medium">{session.user.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{session.user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LINE 連動 */}
        <LineSettings userId={session.user.id} />
      </div>
    </div>
  )
}
