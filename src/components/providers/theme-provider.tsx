'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc'
import { defaultTheme, isValidTheme } from '@/lib/themes'

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { data: session, status } = useSession()
  const employeeId = (session?.user as { id?: string })?.id || ''

  // Fetch user preferences
  const { data: preference } = trpc.userPreference.get.useQuery(
    { employeeId },
    {
      enabled: status === 'authenticated' && !!employeeId,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  )

  // Apply theme when preference loads
  useEffect(() => {
    const theme = preference?.themeConfig?.theme

    if (theme && isValidTheme(theme)) {
      document.documentElement.setAttribute('data-theme', theme)
    } else {
      // Set default theme if not authenticated or no preference
      document.documentElement.setAttribute('data-theme', defaultTheme)
    }
  }, [preference])

  // Set default theme initially (before auth check)
  useEffect(() => {
    if (status === 'unauthenticated') {
      document.documentElement.setAttribute('data-theme', defaultTheme)
    }
  }, [status])

  return <>{children}</>
}
