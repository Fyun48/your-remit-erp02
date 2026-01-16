'use client'

import { useState } from 'react'
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

export function LeaveForm({ employeeId, companyId, onSuccess }: LeaveFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    startPeriod: 'FULL_DAY',
    endDate: '',
    endPeriod: 'FULL_DAY',
    reason: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const { data: leaveTypes } = trpc.leaveType.list.useQuery({ companyId })

  const createMutation = trpc.leaveRequest.create.useMutation()
  const submitMutation = trpc.leaveRequest.submit.useMutation({
    onSuccess: () => {
      setFormData({
        leaveTypeId: '',
        startDate: '',
        startPeriod: 'FULL_DAY',
        endDate: '',
        endPeriod: 'FULL_DAY',
        reason: '',
      })
      onSuccess?.()
    },
  })
  const startWorkflow = trpc.workflow.startInstance.useMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const request = await createMutation.mutateAsync({
        employeeId,
        companyId,
        leaveTypeId: formData.leaveTypeId,
        startDate: new Date(formData.startDate),
        startPeriod: formData.startPeriod as 'FULL_DAY' | 'AM' | 'PM',
        endDate: new Date(formData.endDate),
        endPeriod: formData.endPeriod as 'FULL_DAY' | 'AM' | 'PM',
        reason: formData.reason || undefined,
      })

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

      // 重置表單
      setFormData({
        leaveTypeId: '',
        startDate: '',
        startPeriod: 'FULL_DAY',
        endDate: '',
        endPeriod: 'FULL_DAY',
        reason: '',
      })
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error('Submit error:', error)
      alert(error instanceof Error ? error.message : '申請失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedLeaveType = leaveTypes?.find(lt => lt.id === formData.leaveTypeId)

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
                <option key={lt.id} value={lt.id}>{lt.name}</option>
              ))}
            </select>
          </div>

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
              >
                <option value="FULL_DAY">全天</option>
                <option value="AM">上午</option>
                <option value="PM">下午</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">結束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endPeriod">結束時段</Label>
              <select
                id="endPeriod"
                className="w-full border rounded-md p-2"
                value={formData.endPeriod}
                onChange={(e) => setFormData({ ...formData, endPeriod: e.target.value })}
              >
                <option value="FULL_DAY">全天</option>
                <option value="AM">上午</option>
                <option value="PM">下午</option>
              </select>
            </div>
          </div>

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
