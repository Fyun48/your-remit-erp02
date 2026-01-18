'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Settings,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

interface AuditSettingsListProps {
  userId: string
}

const actionIcons: Record<string, React.ReactNode> = {
  CREATE: <Plus className="h-3 w-3" />,
  UPDATE: <Pencil className="h-3 w-3" />,
  DELETE: <Trash2 className="h-3 w-3" />,
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-500',
  UPDATE: 'bg-blue-500',
  DELETE: 'bg-red-500',
}

export function AuditSettingsList({ userId }: AuditSettingsListProps) {
  const [updatingKeys, setUpdatingKeys] = useState<Set<string>>(new Set())

  const settingsQuery = trpc.auditSetting.list.useQuery({ userId })
  const utils = trpc.useUtils()

  const updateMutation = trpc.auditSetting.update.useMutation({
    onSuccess: () => {
      utils.auditSetting.list.invalidate()
    },
    onSettled: (_, __, variables) => {
      const key = `${variables.entityType}:${variables.action}`
      setUpdatingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    },
  })

  const updateByEntityTypeMutation = trpc.auditSetting.updateByEntityType.useMutation({
    onSuccess: () => {
      utils.auditSetting.list.invalidate()
    },
    onSettled: (_, __, variables) => {
      setUpdatingKeys((prev) => {
        const next = new Set(prev)
        next.delete(`entity:${variables.entityType}`)
        return next
      })
    },
  })

  const handleToggle = (entityType: string, action: string, currentValue: boolean) => {
    const key = `${entityType}:${action}`
    setUpdatingKeys((prev) => new Set(prev).add(key))
    updateMutation.mutate({
      userId,
      entityType,
      action,
      isEnabled: !currentValue,
    })
  }

  const handleToggleAllForEntity = (entityType: string, enable: boolean) => {
    const key = `entity:${entityType}`
    setUpdatingKeys((prev) => new Set(prev).add(key))
    updateByEntityTypeMutation.mutate({
      userId,
      entityType,
      isEnabled: enable,
    })
  }

  const isEntityAllEnabled = (entityType: string): boolean => {
    if (!settingsQuery.data?.grouped[entityType]) return true
    return settingsQuery.data.grouped[entityType].every((s) => s.isEnabled)
  }

  const isEntityAllDisabled = (entityType: string): boolean => {
    if (!settingsQuery.data?.grouped[entityType]) return false
    return settingsQuery.data.grouped[entityType].every((s) => !s.isEnabled)
  }

  const getEntityStats = (entityType: string): { enabled: number; total: number } => {
    if (!settingsQuery.data?.grouped[entityType]) return { enabled: 0, total: 0 }
    const settings = settingsQuery.data.grouped[entityType]
    return {
      enabled: settings.filter((s) => s.isEnabled).length,
      total: settings.length,
    }
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (settingsQuery.error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/system/audit-logs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">稽核設定</h1>
            <p className="text-muted-foreground">設定哪些操作需要記錄到稽核日誌</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-lg font-medium text-red-600">載入失敗</p>
              <p className="text-sm text-muted-foreground mt-2">{settingsQuery.error.message}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => settingsQuery.refetch()}
              >
                重試
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/system/audit-logs">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">稽核設定</h1>
          <p className="text-muted-foreground">設定哪些操作需要記錄到稽核日誌</p>
        </div>
      </div>

      {/* 說明卡片 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            設定說明
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• 啟用：系統會記錄該操作的詳細資訊，包含操作者、時間、變更內容</p>
          <p>• 停用：該操作不會被記錄到稽核日誌中</p>
          <p>• 預設情況下，所有操作都會被記錄</p>
        </CardContent>
      </Card>

      {/* 設定列表 */}
      <div className="grid gap-4 md:grid-cols-2">
        {settingsQuery.data?.entityTypes.map((entityType) => {
          const stats = getEntityStats(entityType.value)
          const allEnabled = isEntityAllEnabled(entityType.value)
          const allDisabled = isEntityAllDisabled(entityType.value)
          const entityUpdating = updatingKeys.has(`entity:${entityType.value}`)

          return (
            <Card key={entityType.value}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{entityType.label}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {stats.enabled}/{stats.total} 項已啟用
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {entityUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={allEnabled}
                          onClick={() => handleToggleAllForEntity(entityType.value, true)}
                        >
                          <ToggleRight className="h-3 w-3 mr-1" />
                          全開
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={allDisabled}
                          onClick={() => handleToggleAllForEntity(entityType.value, false)}
                        >
                          <ToggleLeft className="h-3 w-3 mr-1" />
                          全關
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <hr className="border-t" />
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {settingsQuery.data?.grouped[entityType.value]?.map((setting) => {
                    const key = `${setting.entityType}:${setting.action}`
                    const isUpdating = updatingKeys.has(key)

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between py-1"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`${actionColors[setting.action]} text-white text-xs px-2`}
                          >
                            {actionIcons[setting.action]}
                            <span className="ml-1">{setting.actionLabel}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : setting.isEnabled ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Switch
                            checked={setting.isEnabled}
                            disabled={isUpdating || entityUpdating}
                            onCheckedChange={() =>
                              handleToggle(setting.entityType, setting.action, setting.isEnabled)
                            }
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
