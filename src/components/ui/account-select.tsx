'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Search, ChevronDown } from 'lucide-react'
import { trpc } from '@/lib/trpc'

// 科目類別中文對應
const categoryLabels: Record<string, string> = {
  ASSET: '資產',
  LIABILITY: '負債',
  EQUITY: '權益',
  REVENUE: '收入',
  EXPENSE: '費用',
}

const categories = ['', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const
type Category = (typeof categories)[number]

interface Account {
  id: string
  code: string
  name: string
  category: string
  isDetail: boolean
  requiresAux: boolean
}

interface AccountSelectProps {
  companyId: string
  value: string // accountId
  displayValue?: string // 顯示文字 (如 "1102 銀行存款")
  onChange: (accountId: string, accountCode: string, accountName: string, requiresAux: boolean) => void
  placeholder?: string
  className?: string
}

export function AccountSelect({
  companyId,
  value,
  displayValue,
  onChange,
  placeholder = '輸入代碼或名稱搜尋...',
  className,
}: AccountSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchText, setSearchText] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState<Category>('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 查詢所有明細科目
  const { data: accounts = [], isLoading } = trpc.accountChart.list.useQuery(
    { companyId, isDetail: true },
    { enabled: !!companyId }
  )

  // 過濾科目
  const filteredAccounts = React.useMemo(() => {
    return accounts.filter((acc: Account) => {
      // 類別過濾
      if (selectedCategory && acc.category !== selectedCategory) return false

      // 搜尋過濾 (代碼開頭匹配 或 名稱包含)
      if (searchText) {
        const lowerSearch = searchText.toLowerCase()
        const matchCode = acc.code.toLowerCase().startsWith(lowerSearch)
        const matchName = acc.name.toLowerCase().includes(lowerSearch)
        return matchCode || matchName
      }

      return true
    })
  }, [accounts, selectedCategory, searchText])

  // 點擊外部關閉
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchText('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 選擇科目
  const handleSelect = (account: Account) => {
    onChange(account.id, account.code, account.name, account.requiresAux)
    setIsOpen(false)
    setSearchText('')
  }

  // 處理輸入
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  // 處理 focus
  const handleFocus = () => {
    setIsOpen(true)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* 輸入框 */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-8 py-1 text-sm shadow-sm transition-colors',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          placeholder={placeholder}
          value={isOpen ? searchText : displayValue || ''}
          onChange={handleInputChange}
          onFocus={handleFocus}
        />
        <ChevronDown
          className={cn(
            'absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </div>

      {/* 下拉選單 */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {/* 類別過濾標籤 */}
          <div className="flex flex-wrap gap-1 p-2 border-b">
            {categories.map((cat) => (
              <button
                key={cat || 'all'}
                type="button"
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat ? categoryLabels[cat] : '全部'}
              </button>
            ))}
          </div>

          {/* 科目列表 */}
          <div className="max-h-60 overflow-auto p-1">
            {isLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                載入中...
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {searchText ? '找不到符合的科目' : '沒有可用的科目'}
              </div>
            ) : (
              filteredAccounts.map((account: Account) => (
                <div
                  key={account.id}
                  className={cn(
                    'flex items-center justify-between px-2 py-1.5 text-sm rounded-sm cursor-pointer',
                    'hover:bg-accent hover:text-accent-foreground',
                    value === account.id && 'bg-accent'
                  )}
                  onClick={() => handleSelect(account)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground w-12">
                      {account.code}
                    </span>
                    <span>{account.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {categoryLabels[account.category]}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
