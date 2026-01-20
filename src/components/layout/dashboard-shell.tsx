'use client'

import { ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { MobileSidebarProvider } from './mobile-sidebar-context'
import { AIChatButton } from '@/components/ai'
import { DelegationBanner } from './delegation-banner'

interface DashboardShellProps {
  children: ReactNode
  groupName: string
  companyId?: string
  companyName?: string
  isGroupAdmin: boolean
}

export function DashboardShell({
  children,
  groupName,
  companyId,
  companyName,
  isGroupAdmin,
}: DashboardShellProps) {
  return (
    <MobileSidebarProvider>
      <div className="flex h-screen">
        <Sidebar groupName={groupName} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DelegationBanner />
          <Header
            companyId={companyId}
            companyName={companyName}
            isGroupAdmin={isGroupAdmin}
          />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>

      {/* AI 智慧助理 */}
      <AIChatButton />
    </MobileSidebarProvider>
  )
}
