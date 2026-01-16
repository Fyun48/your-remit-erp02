import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isGroupAdmin } from '@/lib/group-permission'
import { GroupList } from './group-list'

export default async function GroupsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // 檢查權限
  const hasPermission = await isGroupAdmin(userId)
  if (!hasPermission) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">集團管理</h1>
        <p className="text-muted-foreground mt-2">您沒有權限管理集團</p>
      </div>
    )
  }

  return <GroupList userId={userId} />
}
