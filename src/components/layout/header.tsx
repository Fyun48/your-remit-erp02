'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, User, Lock, ChevronDown, Menu, Search } from 'lucide-react'
import { CompanySwitcher } from './company-switcher'
import { useMobileSidebar } from './mobile-sidebar-context'
import { SearchDialog } from '@/components/search'
import { MessageBell } from './message-bell'
import { NotificationBell } from './notification-bell'
import { trpc } from '@/lib/trpc'

interface HeaderProps {
  companyId?: string
  companyName?: string
  isGroupAdmin?: boolean
}

export function Header({ companyId, companyName, isGroupAdmin = false }: HeaderProps) {
  const { data: session } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { open: openSidebar } = useMobileSidebar()

  // 從資料庫取得最新的頭像 (避免 JWT 快取問題)
  const { data: profile } = trpc.employee.getProfile.useQuery(
    { employeeId: session?.user?.id || '' },
    { enabled: !!session?.user?.id }
  )

  // 優先使用資料庫的頭像，fallback 到 session 的頭像
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatarUrl = profile?.avatarUrl || (session?.user as any)?.avatarUrl
  const userName = session?.user?.name || '使用者'

  const getInitials = (name: string) => {
    return name.slice(0, 2)
  }

  // 手機版顯示姓名後2字
  const getMobileDisplayName = (name: string) => {
    if (name.length <= 2) return name
    return name.slice(-2)
  }

  // 點擊外部關閉選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b bg-card px-2 md:px-6">
      <div className="flex items-center space-x-1 md:space-x-4">
        {/* 手機版漢堡選單按鈕 */}
        <button
          onClick={openSidebar}
          className="md:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        {companyId && companyName && (
          <CompanySwitcher
            currentCompanyId={companyId}
            currentCompanyName={companyName}
            isGroupAdmin={isGroupAdmin}
          />
        )}
      </div>
      <div className="flex items-center space-x-1 md:space-x-4">
        {/* 搜尋按鈕 */}
        {companyId && (
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            title="搜尋 (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline text-xs text-muted-foreground">Ctrl+K</span>
          </button>
        )}

        {/* 訊息通知 */}
        <MessageBell />

        {/* 通知鈴鐺 */}
        <NotificationBell />

        {/* 用戶下拉選單 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center space-x-1 md:space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md px-1.5 md:px-2 py-1 hover:bg-accent"
          >
            <Avatar className="h-7 w-7 md:h-8 md:w-8">
              <AvatarImage src={avatarUrl || undefined} alt={userName} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline text-foreground">{userName}</span>
            <span className="md:hidden text-xs text-foreground">{getMobileDisplayName(userName)}</span>
            <ChevronDown className={`h-3 w-3 md:h-4 md:w-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* 下拉選單 */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-popover text-popover-foreground rounded-md shadow-lg border py-1 z-50">
              <Link
                href="/dashboard/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center px-4 py-2 text-sm hover:bg-accent"
              >
                <User className="mr-2 h-4 w-4" />
                個人資料
              </Link>
              <Link
                href="/dashboard/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center px-4 py-2 text-sm hover:bg-accent"
              >
                <Lock className="mr-2 h-4 w-4" />
                變更密碼
              </Link>
              <div className="border-t my-1" />
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center w-full px-4 py-2 text-sm text-destructive hover:bg-accent"
              >
                <LogOut className="mr-2 h-4 w-4" />
                登出
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 搜尋對話框 */}
      {companyId && (
        <SearchDialog
          open={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          companyId={companyId}
        />
      )}
    </header>
  )
}
