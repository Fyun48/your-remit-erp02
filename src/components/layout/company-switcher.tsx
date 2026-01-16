'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Building, ChevronDown, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc'

interface Company {
  id: string
  name: string
  code: string
}

interface CompanySwitcherProps {
  currentCompanyId: string
  currentCompanyName: string
  isGroupAdmin: boolean
}

export function CompanySwitcher({
  currentCompanyId,
  currentCompanyName,
  isGroupAdmin,
}: CompanySwitcherProps) {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const userId = session?.user?.id || ''

  // 如果是集團管理員，載入所有公司
  const { data: companies = [] } = trpc.company.listAll.useQuery(
    { userId },
    { enabled: isGroupAdmin && !!userId }
  )

  const handleSelectCompany = async (company: Company) => {
    if (company.id === currentCompanyId) {
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      console.log('Switching to company:', company.id, company.name)

      const response = await fetch('/api/company/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id }),
        credentials: 'include', // 確保 cookie 被傳送和接收
      })

      const result = await response.json()
      console.log('API response:', response.status, result)

      if (response.ok) {
        setIsOpen(false)
        // 使用完整頁面重載以確保 cookie 生效
        window.location.href = window.location.pathname
      } else {
        alert(result.error || '切換公司失敗')
      }
    } catch (error) {
      console.error('Switch company error:', error)
      alert('切換公司失敗')
    } finally {
      setIsLoading(false)
    }
  }

  // 非集團管理員只顯示當前公司
  if (!isGroupAdmin) {
    return (
      <div className="flex items-center gap-2 text-gray-700">
        <Building className="h-5 w-5" />
        <span className="text-base font-semibold">{currentCompanyName}</span>
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-10 px-4"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Building className="h-5 w-5" />
        )}
        <span className="max-w-[180px] truncate text-base font-semibold">{currentCompanyName}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border bg-white p-1 shadow-lg">
            <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
              切換公司
            </div>
            <div className="max-h-60 overflow-auto">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className={`flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 ${
                    currentCompanyId === company.id ? 'bg-gray-50' : ''
                  }`}
                  onClick={() => handleSelectCompany(company)}
                >
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="font-medium">{company.name}</div>
                      <div className="text-xs text-gray-500">{company.code}</div>
                    </div>
                  </div>
                  {currentCompanyId === company.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
