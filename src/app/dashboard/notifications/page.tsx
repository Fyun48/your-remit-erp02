import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NotificationList } from './notification-list'

export default async function NotificationsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">通知中心</h1>
      </div>

      <NotificationList userId={session.user.id} />
    </div>
  )
}
