import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { TRPCProvider } from '@/components/providers/trpc-provider'
import { SessionProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { PWARegister } from '@/components/pwa/pwa-register'
import { Toaster } from 'sonner'
import { defaultTheme, isValidTheme } from '@/lib/themes'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '集團 ERP 系統',
  description: '多公司 ERP 系統 - 人事管理、考勤、請假、報銷、財務會計',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ERP 系統',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 從 cookie 讀取主題，避免頁面閃爍
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get('theme')?.value
  const theme = themeCookie && isValidTheme(themeCookie) ? themeCookie : defaultTheme

  return (
    <html lang="zh-TW" data-theme={theme}>
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <TRPCProvider>
            <ThemeProvider>
              {children}
              <PWARegister />
              <Toaster position="top-right" richColors />
            </ThemeProvider>
          </TRPCProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
