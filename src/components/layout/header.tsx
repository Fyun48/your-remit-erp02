'use client'

import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut } from 'lucide-react'

export function Header() {
  const { data: session } = useSession()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatarUrl = (session?.user as any)?.avatarUrl
  const userName = session?.user?.name || '使用者'

  const getInitials = (name: string) => {
    return name.slice(0, 2)
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center space-x-4">
        <h2 className="text-lg font-semibold">歡迎使用 ERP 系統</h2>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl || undefined} alt={userName} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <span>{userName}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          登出
        </Button>
      </div>
    </header>
  )
}
