import { SessionProvider } from 'next-auth/react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { auth } from '@/lib/auth'
import { getCompanyContext } from '@/lib/use-current-company'
import { TRPCProvider } from '@/components/providers/trpc-provider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  let companyContext = {
    isGroupAdmin: false,
    currentCompany: null as { id: string; name: string; code: string } | null,
    groupName: '集團',
  }

  if (session?.user?.id) {
    companyContext = await getCompanyContext(session.user.id)
  }

  return (
    <SessionProvider>
      <TRPCProvider>
        <div className="flex h-screen">
          <Sidebar groupName={companyContext.groupName} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header
              companyId={companyContext.currentCompany?.id}
              companyName={companyContext.currentCompany?.name}
              isGroupAdmin={companyContext.isGroupAdmin}
            />
            <main className="flex-1 overflow-y-auto bg-gray-100 p-6">
              {children}
            </main>
          </div>
        </div>
      </TRPCProvider>
    </SessionProvider>
  )
}
