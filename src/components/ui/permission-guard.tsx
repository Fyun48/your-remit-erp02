'use client'

import { ReactNode } from 'react'
import { useHasPermission, usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldX, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface PermissionGuardProps {
  /**
   * 需要的權限代碼
   */
  permission: string
  /**
   * 公司 ID（可選，預設使用主要公司）
   */
  companyId?: string
  /**
   * 有權限時顯示的內容
   */
  children: ReactNode
  /**
   * 無權限時顯示的內容（可選，預設顯示標準提示卡片）
   */
  fallback?: ReactNode
  /**
   * 載入中時顯示的內容
   */
  loadingFallback?: ReactNode
}

/**
 * 權限守衛元件
 * 用於頁面或區塊的權限檢查
 */
export function PermissionGuard({
  permission,
  companyId,
  children,
  fallback,
  loadingFallback,
}: PermissionGuardProps) {
  const { isLoading } = usePermissions(companyId)
  const hasPermission = useHasPermission(permission, companyId)

  if (isLoading) {
    return loadingFallback || (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasPermission) {
    return fallback || <NoPermissionCard />
  }

  return <>{children}</>
}

/**
 * 無權限提示卡片
 */
export function NoPermissionCard() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <ShieldX className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>無法存取此功能</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            您目前沒有權限使用此功能。
            <br />
            如需開通權限，請聯繫您的主管或系統管理員。
          </p>
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首頁
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 權限檢查的 HOC（用於 Server Component）
 */
export function withPermissionCheck(
  permission: string,
  companyId?: string
) {
  return function <P extends object>(WrappedComponent: React.ComponentType<P>) {
    return function PermissionCheckedComponent(props: P) {
      return (
        <PermissionGuard permission={permission} companyId={companyId}>
          <WrappedComponent {...props} />
        </PermissionGuard>
      )
    }
  }
}
