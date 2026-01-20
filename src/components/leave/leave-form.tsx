'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trpc } from '@/lib/trpc'

interface LeaveFormProps {
  employeeId: string
  companyId: string
  onSuccess?: () => void
}

type InputMode = 'date' | 'days'

export function LeaveForm({ employeeId, companyId, onSuccess }: LeaveFormProps) {
  const router = useRouter()
  const [inputMode, setInputMode] = useState<InputMode>('date')
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    startPeriod: 'FULL_DAY',
    endDate: '',
    endPeriod: 'FULL_DAY',
    leaveDays: '',
    reason: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const { data: leaveTypes } = trpc.leaveType.list.useQuery({ companyId })

  const createMutation = trpc.leaveRequest.create.useMutation()
  const submitMutation = trpc.leaveRequest.submit.useMutation({
    onSuccess: () => {
      resetForm()
      onSuccess?.()
    },
  })
  const startWorkflow = trpc.workflow.startInstance.useMutation()

  const resetForm = () => {
    setFormData({
      leaveTypeId: '',
      startDate: '',
      startPeriod: 'FULL_DAY',
      endDate: '',
      endPeriod: 'FULL_DAY',
      leaveDays: '',
      reason: '',
    })
  }

  const selectedLeaveType = leaveTypes?.find(lt => lt.id === formData.leaveTypeId)
  const minUnit = selectedLeaveType?.minUnit || 'HOUR'

  // 根據天數計算結束日期
  useEffect(() => {
    if (inputMode === 'days' && formData.startDate && formData.leaveDays) {
      const days = parseFloat(formData.leaveDays)
      if (!isNaN(days) && days > 0) {
        const start = new Date(formData.startDate)
        // 計算結束日期
        if (days === 0.5) {
          // 半天請假，同一天
          setFormData(prev => ({
            ...prev,
            endDate: prev.startDate,
            endPeriod: prev.startPeriod,
          }))
        } else {
          const end = new Date(start)
          end.setDate(end.getDate() + Math.ceil(days) - 1)
          const endDateStr = end.toISOString().split('T')[0]

          // 如果有半天
          let endPeriod = 'FULL_DAY'
          if (days % 1 === 0.5) {
            endPeriod = 'AM'
          }

          setFormData(prev => ({
            ...prev,
            endDate: endDateStr,
            endPeriod,
          }))
        }
      }
    }
  }, [inputMode, formData.startDate, formData.leaveDays, formData.startPeriod])

  // 根據 minUnit 過濾可用的時段選項
  const getPeriodOptions = () => {
    if (minUnit === 'DAY') {
      return [{ value: 'FULL_DAY', label: '全天' }]
    }
    return [
      { value: 'FULL_DAY', label: '全天' },
      { value: 'AM', label: '上午' },
      { value: 'PM', label: '下午' },
    ]
  }

  // 當 minUnit 改變時，重置時段選擇
  useEffect(() => {
    if (minUnit === 'DAY') {
      setFormData(prev => ({
        ...prev,
        startPeriod: 'FULL_DAY',
        endPeriod: 'FULL_DAY',
      }))
    }
  }, [minUnit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const requestData: Parameters<typeof createMutation.mutateAsync>[0] = {
        employeeId,
        companyId,
        leaveTypeId: formData.leaveTypeId,
        startDate: new Date(formData.startDate),
        startPeriod: formData.startPeriod as 'FULL_DAY' | 'AM' | 'PM',
        endPeriod: formData.endPeriod as 'FULL_DAY' | 'AM' | 'PM',
        reason: formData.reason || undefined,
      }

      // 根據輸入模式決定傳送方式
      if (inputMode === 'days' && formData.leaveDays) {
        requestData.leaveDays = parseFloat(formData.leaveDays)
      } else {
        requestData.endDate = new Date(formData.endDate)
      }

      const request = await createMutation.mutateAsync(requestData)

      // 嘗試啟動工作流程
      try {
        await startWorkflow.mutateAsync({
          requestType: 'LEAVE',
          requestId: request.id,
          applicantId: employeeId,
          companyId,
          requestData: {
            leaveTypeId: formData.leaveTypeId,
            totalHours: request.totalHours,
          },
        })
      } catch {
        // 無工作流程定義，使用傳統審批
        console.log('No workflow defined, using traditional approval')
        await submitMutation.mutateAsync({ id: request.id })
      }

      resetForm()
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error('Submit error:', error)
      alert(error instanceof Error ? error.message : '申請失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const periodOptions = getPeriodOptions()

  return (
    <Card>
      <CardHeader>
        <CardTitle>請假申請</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leaveType">假別</Label>
            <select
              id="leaveType"
              className="w-full border rounded-md p-2"
              value={formData.leaveTypeId}
              onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
              required
            >
              <option value="">請選擇假別</option>
              {leaveTypes?.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                  {lt.minUnit === 'DAY' ? ' (以天為單位)' : lt.minUnit === 'HALF_DAY' ? ' (以半天為單位)' : ''}
                </option>
              ))}
            </select>
            {selectedLeaveType && selectedLeaveType.minUnit !== 'HOUR' && (
              <p className="text-sm text-muted-foreground">
                此假別最小請假單位為「{selectedLeaveType.minUnit === 'DAY' ? '天' : '半天'}」
              </p>
            )}
          </div>

          {/* 輸入模式切換 */}
          <div className="space-y-2">
            <Label>請假方式</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="inputMode"
                  checked={inputMode === 'date'}
                  onChange={() => setInputMode('date')}
                  className="w-4 h-4"
                />
                <span>選擇日期範圍</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="inputMode"
                  checked={inputMode === 'days'}
                  onChange={() => setInputMode('days')}
                  className="w-4 h-4"
                />
                <span>輸入請假天數</span>
              </label>
            </div>
          </div>

          {/* 開始日期和時段 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">開始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startPeriod">開始時段</Label>
              <select
                id="startPeriod"
                className="w-full border rounded-md p-2"
                value={formData.startPeriod}
                onChange={(e) => setFormData({ ...formData, startPeriod: e.target.value })}
                disabled={minUnit === 'DAY'}
              >
                {periodOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 天數輸入模式 */}
          {inputMode === 'days' ? (
            <div className="space-y-2">
              <Label htmlFor="leaveDays">請假天數</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="leaveDays"
                  type="number"
                  step={minUnit === 'DAY' ? '1' : '0.5'}
                  min={minUnit === 'DAY' ? '1' : '0.5'}
                  value={formData.leaveDays}
                  onChange={(e) => setFormData({ ...formData, leaveDays: e.target.value })}
                  placeholder={minUnit === 'DAY' ? '1, 2, 3...' : '0.5, 1, 1.5...'}
                  required
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">天</span>
              </div>
              {formData.endDate && (
                <p className="text-sm text-muted-foreground">
                  預計請假至 {formData.endDate} {formData.endPeriod === 'AM' ? '上午' : formData.endPeriod === 'PM' ? '下午' : '全天'}
                </p>
              )}
            </div>
          ) : (
            /* 日期選擇模式 */
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">結束日期</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  min={formData.startDate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endPeriod">結束時段</Label>
                <select
                  id="endPeriod"
                  className="w-full border rounded-md p-2"
                  value={formData.endPeriod}
                  onChange={(e) => setFormData({ ...formData, endPeriod: e.target.value })}
                  disabled={minUnit === 'DAY'}
                >
                  {periodOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {selectedLeaveType?.requiresReason && (
            <div className="space-y-2">
              <Label htmlFor="reason">請假事由 *</Label>
              <textarea
                id="reason"
                className="w-full border rounded-md p-2 min-h-[80px]"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required={selectedLeaveType.requiresReason}
                placeholder="請填寫請假事由"
              />
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? '送出中...' : '送出申請'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
