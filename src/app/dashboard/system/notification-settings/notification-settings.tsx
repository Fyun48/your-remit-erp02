'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bell, Save, User, Loader2, Check, X } from 'lucide-react'
import Link from 'next/link'

interface NotificationSettingsProps {
  employees: {
    id: string
    name: string
    employeeNo: string
  }[]
  currentCCEmployeeId: string | null
}

export function NotificationSettings({ employees, currentCCEmployeeId }: NotificationSettingsProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(currentCCEmployeeId || '')
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

  const deleteSettingMutation = trpc.systemSetting.delete.useMutation({
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
    if (selectedEmployeeId) {
      setSettingMutation.mutate({
        key: 'FLOW_CC_EMPLOYEE_ID',
        value: selectedEmployeeId,
      })
    } else {
      deleteSettingMutation.mutate({
        key: 'FLOW_CC_EMPLOYEE_ID',
      })
    }
  }

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

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
            審核完成抄送通知
          </CardTitle>
          <CardDescription>
            設定審核流程完成（核准或駁回）時，自動抄送通知給指定員工。
            此員工將收到所有審核完成的通知，用於留存查閱紀錄。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">抄送員工</label>
            <Select
              value={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
            >
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="選擇員工（不選擇則停用抄送功能）">
                  {selectedEmployee && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {selectedEmployee.name} ({selectedEmployee.employeeNo})
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="text-muted-foreground">不啟用抄送功能</span>
                </SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {employee.name} ({employee.employeeNo})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              選擇後，任何審核流程完成時都會自動通知此員工
            </p>
          </div>

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

            {selectedEmployeeId && selectedEmployeeId !== currentCCEmployeeId && (
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
            <li>任何審核流程完成且被核准時</li>
            <li>任何審核流程完成且被駁回時</li>
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
