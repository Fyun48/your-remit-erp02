'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Bell, Save, User, Loader2, Check, X, Search } from 'lucide-react'
import Link from 'next/link'

interface NotificationSettingsProps {
  employees: {
    id: string
    name: string
    employeeNo: string
  }[]
  currentCCEmployeeIds: string[]
}

export function NotificationSettings({ employees, currentCCEmployeeIds }: NotificationSettingsProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(currentCCEmployeeIds)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const setSettingMutation = trpc.systemSetting.set.useMutation({
    onSuccess: () => {
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    },
    onError: () => {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
    },
    onSettled: () => {
      setIsSaving(false)
    },
  })

  const handleSave = () => {
    setIsSaving(true)
    setSettingMutation.mutate({
      key: 'FLOW_CC_EMPLOYEE_IDS',
      value: JSON.stringify(selectedIds),
    })
  }

  const toggleEmployee = (employeeId: string) => {
    setSelectedIds(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const filteredEmployees = employees.filter(emp =>
    emp.name.includes(searchTerm) || emp.employeeNo.includes(searchTerm)
  )

  const selectedEmployees = employees.filter(emp => selectedIds.includes(emp.id))

  const hasChanges = JSON.stringify(selectedIds.sort()) !== JSON.stringify(currentCCEmployeeIds.sort())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">通知設定</h1>
          <p className="text-muted-foreground">設定審核流程相關通知</p>
        </div>
        <Link href="/dashboard/system">
          <Button variant="outline">返回系統管理</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            審核核准抄送通知
          </CardTitle>
          <CardDescription>
            設定審核流程最終核准時，自動抄送通知給指定員工。
            這些員工將收到所有審核核准的通知，用於留存查閱紀錄。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 已選擇的員工 */}
          {selectedEmployees.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">已選擇的抄送人員 ({selectedEmployees.length})</label>
              <div className="flex flex-wrap gap-2">
                {selectedEmployees.map(emp => (
                  <Badge
                    key={emp.id}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => toggleEmployee(emp.id)}
                  >
                    <User className="h-3 w-3 mr-1" />
                    {emp.name}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 搜尋框 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">選擇抄送員工（可複選）</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋員工姓名或工號..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* 員工列表 */}
          <div className="border rounded-lg max-h-[300px] overflow-y-auto">
            {filteredEmployees.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                找不到符合的員工
              </div>
            ) : (
              filteredEmployees.map(employee => (
                <label
                  key={employee.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                >
                  <Checkbox
                    checked={selectedIds.includes(employee.id)}
                    onCheckedChange={() => toggleEmployee(employee.id)}
                  />
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{employee.name}</span>
                  <span className="text-sm text-muted-foreground">{employee.employeeNo}</span>
                </label>
              ))
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            選擇後，任何審核流程最終核准時都會自動通知這些員工
          </p>

          <div className="flex items-center gap-4 pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : saveStatus === 'success' ? (
                <Check className="h-4 w-4 mr-2 text-green-500" />
              ) : saveStatus === 'error' ? (
                <X className="h-4 w-4 mr-2 text-red-500" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving ? '儲存中...' : saveStatus === 'success' ? '已儲存' : '儲存設定'}
            </Button>

            {hasChanges && (
              <span className="text-sm text-muted-foreground">
                有未儲存的變更
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">功能說明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>抄送通知</strong>會在以下情況觸發：
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>任何審核流程完成且<strong>最終核准</strong>時</li>
          </ul>
          <p className="mt-4">
            抄送員工會在通知中心收到通知，可用於：
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>主管掌握所有審核狀況</li>
            <li>行政人員留存審核紀錄</li>
            <li>稽核人員監控流程合規性</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
