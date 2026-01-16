'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, User, Lock, ChevronDown } from 'lucide-react'
import { CompanySwitcher } from './company-switcher'

interface HeaderProps {
  companyId?: string
  companyName?: string
  isGroupAdmin?: boolean
}

export function Header({ companyId, companyName, isGroupAdmin = false }: HeaderProps) {
  const { data: session } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatarUrl = (session?.user as any)?.avatarUrl
  const userName = session?.user?.name || '使用者'

  const getInitials = (name: string) => {
    return name.slice(0, 2)
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
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center space-x-4">
        <h2 className="text-lg font-semibold">歡迎使用 ERP 系統</h2>
        {companyId && companyName && (
          <CompanySwitcher
            currentCompanyId={companyId}
            currentCompanyName={companyName}
            isGroupAdmin={isGroupAdmin}
          />
        )}
      </div>
      <div className="flex items-center space-x-4">
        {/* 用戶下拉選單 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors rounded-md px-2 py-1 hover:bg-gray-100"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl || undefined} alt={userName} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <span>{userName}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* 下拉選單 */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border py-1 z-50">
              <Link
                href="/dashboard/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <User className="mr-2 h-4 w-4" />
                個人資料
              </Link>
              <Link
                href="/dashboard/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Lock className="mr-2 h-4 w-4" />
                變更密碼
              </Link>
              <div className="border-t my-1" />
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                <LogOut className="mr-2 h-4 w-4" />
                登出
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
