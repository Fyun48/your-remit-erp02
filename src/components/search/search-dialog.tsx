'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import {
  Search,
  Users,
  Calendar,
  Receipt,
  Loader2,
  LayoutDashboard
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { trpc } from '@/lib/trpc'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

const typeIcons = {
  employee: Users,
  leave: Calendar,
  expense: Receipt,
  page: LayoutDashboard,
}

const typeLabels = {
  employee: '員工',
  leave: '請假',
  expense: '報銷',
  page: '功能',
}

export function SearchDialog({ open, onOpenChange, companyId }: SearchDialogProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Search query
  const { data: results, isLoading } = trpc.search.global.useQuery(
    { query: debouncedQuery, companyId },
    {
      enabled: debouncedQuery.length >= 1,
      staleTime: 1000 * 60, // 1 minute
    }
  )

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  const handleSelect = useCallback((href: string) => {
    onOpenChange(false)
    setQuery('')
    router.push(href)
  }, [onOpenChange, router])

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  // Group results by type
  const groupedResults = results?.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, typeof results>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-lg overflow-hidden">
        <Command className="rounded-lg border-0" shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="搜尋員工、單據或功能..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            {query.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                輸入關鍵字開始搜尋
              </div>
            )}

            {query.length > 0 && !isLoading && (!results || results.length === 0) && (
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                找不到相關結果
              </Command.Empty>
            )}

            {groupedResults && Object.entries(groupedResults).map(([type, items]) => {
              const Icon = typeIcons[type as keyof typeof typeIcons]
              const label = typeLabels[type as keyof typeof typeLabels]

              return (
                <Command.Group key={type} heading={label} className="pb-2">
                  {items?.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelect(item.href)}
                      className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer aria-selected:bg-accent"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 overflow-hidden">
                        <div className="truncate font-medium">{item.title}</div>
                        {item.subtitle && (
                          <div className="truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )
            })}
          </Command.List>

          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>按 Enter 選取</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
              關閉
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
