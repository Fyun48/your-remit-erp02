import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
import { getCompanyContext } from '@/lib/use-current-company'
import { TRPCProvider } from '@/components/providers/trpc-provider'
import { DashboardShell } from '@/components/layout/dashboard-shell'

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
        <DashboardShell
          groupName={companyContext.groupName}
          companyId={companyContext.currentCompany?.id}
          companyName={companyContext.currentCompany?.name}
          isGroupAdmin={companyContext.isGroupAdmin}
        >
          {children}
        </DashboardShell>
      </TRPCProvider>
    </SessionProvider>
  )
}
