import { TRPCProvider } from '@/components/providers/trpc-provider'
import { SessionProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'

export default function PopupChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <TRPCProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </TRPCProvider>
    </SessionProvider>
  )
}
