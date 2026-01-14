'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface ShiftFormProps {
  companyId: string
  onSuccess?: () => void
}

export function ShiftForm({ companyId, onSuccess }: ShiftFormProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [workStartTime, setWorkStartTime] = useState('09:00')
  const [workEndTime, setWorkEndTime] = useState('18:00')
  const [lateGraceMinutes, setLateGraceMinutes] = useState(0)
  const [earlyLeaveGraceMinutes, setEarlyLeaveGraceMinutes] = useState(0)

  const createMutation = trpc.workShift.create.useMutation({
    onSuccess: () => {
      // 清空表單
      setName('')
      setCode('')
      setWorkStartTime('09:00')
      setWorkEndTime('18:00')
      setLateGraceMinutes(0)
      setEarlyLeaveGraceMinutes(0)
      // 呼叫 onSuccess callback
      onSuccess?.()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      companyId,
      name,
      code,
      workStartTime,
      workEndTime,
      lateGraceMinutes,
      earlyLeaveGraceMinutes,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          新增班別
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">班別名稱</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：日班"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">班別代碼</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例如：DAY"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workStartTime">上班時間</Label>
              <Input
                id="workStartTime"
                type="time"
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workEndTime">下班時間</Label>
              <Input
                id="workEndTime"
                type="time"
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lateGraceMinutes">遲到寬限（分鐘）</Label>
              <Input
                id="lateGraceMinutes"
                type="number"
                min="0"
                value={lateGraceMinutes}
                onChange={(e) => setLateGraceMinutes(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="earlyLeaveGraceMinutes">早退寬限（分鐘）</Label>
              <Input
                id="earlyLeaveGraceMinutes"
                type="number"
                min="0"
                value={earlyLeaveGraceMinutes}
                onChange={(e) => setEarlyLeaveGraceMinutes(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {createMutation.error && (
            <p className="text-sm text-red-600">
              {createMutation.error.message}
            </p>
          )}

          <Button type="submit" disabled={createMutation.isPending} className="w-full">
            {createMutation.isPending ? '建立中...' : '建立班別'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
