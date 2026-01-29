'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { defaultMenuItems } from '@/lib/sidebar-menu'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { trpc } from '@/lib/trpc'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { useEffect } from 'react'

export function PersonalQuickAccess() {
  const { data: session } = useSession()
  const employeeId = (session?.user as { id?: string })?.id || ''
  const { config, isLoaded, setConfig, setLoaded } = useSidebarStore()

  // 載入使用者偏好設定
  const { data: preference } = trpc.userPreference.get.useQuery(
    { employeeId },
    { enabled: !!employeeId }
  )

  useEffect(() => {
    if (preference && !isLoaded) {
      setConfig(preference.sidebarConfig)
      setLoaded(true)
    }
  }, [preference, isLoaded, setConfig, setLoaded])

  const personalMenuItems = config.personalMenuItems || []

  // 根據選擇的子選單 ID 取得詳細資訊
  const selectedItems = personalMenuItems
    .map((id) => {
      // 在所有主選單的 children 中尋找
      for (const menu of defaultMenuItems) {
        const child = menu.children?.find((c) => c.id === id)
        if (child) {
          return {
            ...child,
            parentName: menu.name,
          }
        }
      }
      return null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  // 如果沒有選擇任何項目，顯示提示
  if (selectedItems.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-5 w-5 text-muted-foreground" />
            我的快捷功能
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">
              尚未設定快捷功能
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              點擊側邊欄底部的「個人化設定」來自訂你的快捷功能
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          我的快捷功能
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {selectedItems.length} 個功能
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {selectedItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-center"
              >
                {Icon && (
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.parentName}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
