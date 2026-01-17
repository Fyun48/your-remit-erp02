import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/components/providers/trpc-provider'
import { SessionProvider } from '@/components/providers/session-provider'
import { PWARegister } from '@/components/pwa/pwa-register'

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <TRPCProvider>
            {children}
            <PWARegister />
          </TRPCProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
