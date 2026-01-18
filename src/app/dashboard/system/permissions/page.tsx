import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { isGroupAdmin } from '@/lib/group-permission'
import { isCompanyManager } from '@/lib/permission'
import { PermissionList } from './permission-list'
import { PermissionTemplates } from './permission-templates'
import { BatchAuthorization } from './batch-authorization'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function PermissionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // 取得當前工作公司
  const currentCompany = await getCurrentCompany(userId)
  if (!currentCompany) redirect('/dashboard')

  // 檢查是否有權限管理權
  const groupAdmin = await isGroupAdmin(userId)
  const companyManager = await isCompanyManager(userId, currentCompany.id)
  const canManage = groupAdmin || companyManager

  return (
    <div className="space-y-6">
      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">員工權限</TabsTrigger>
          {groupAdmin && <TabsTrigger value="templates">權限範本</TabsTrigger>}
          {canManage && <TabsTrigger value="batch">批次授權</TabsTrigger>}
        </TabsList>

        <TabsContent value="employees" className="mt-6">
          <PermissionList
            companyId={currentCompany.id}
            companyName={currentCompany.name}
            userId={userId}
            canManage={canManage}
          />
        </TabsContent>

        {groupAdmin && (
          <TabsContent value="templates" className="mt-6">
            <PermissionTemplates userId={userId} />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="batch" className="mt-6">
            <BatchAuthorization userId={userId} companyId={currentCompany.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
