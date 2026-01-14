'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface ClockCardProps {
  employeeId: string
  companyId: string
}

export function ClockCard({ employeeId, companyId }: ClockCardProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  // 即時更新時間
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 取得今日打卡狀態
  const { data: todayStatus, refetch } = trpc.attendance.getTodayStatus.useQuery({
    employeeId,
    companyId,
  })

  // 上班打卡 mutation
  const clockInMutation = trpc.attendance.clockIn.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  // 下班打卡 mutation
  const clockOutMutation = trpc.attendance.clockOut.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  // 處理上班打卡
  const handleClockIn = () => {
    clockInMutation.mutate({
      employeeId,
      companyId,
      method: 'WEB',
    })
  }

  // 處理下班打卡
  const handleClockOut = () => {
    clockOutMutation.mutate({
      employeeId,
      companyId,
      method: 'WEB',
    })
  }

  // 判斷按鈕狀態
  const hasClockedIn = !!todayStatus?.clockInTime
  const hasClockedOut = !!todayStatus?.clockOutTime

  // 狀態顯示
  const getStatusBadge = () => {
    if (!todayStatus) return null

    const statusConfig: Record<string, { label: string; className: string }> = {
      PENDING: { label: '待確認', className: 'bg-yellow-100 text-yellow-800' },
      NORMAL: { label: '正常', className: 'bg-green-100 text-green-800' },
      LATE: { label: '遲到', className: 'bg-red-100 text-red-800' },
      EARLY_LEAVE: { label: '早退', className: 'bg-orange-100 text-orange-800' },
      ABSENT: { label: '曠職', className: 'bg-red-200 text-red-900' },
      LEAVE: { label: '請假', className: 'bg-blue-100 text-blue-800' },
      EXEMPT: { label: '免打卡', className: 'bg-gray-100 text-gray-800' },
    }

    const config = statusConfig[todayStatus.status] || statusConfig.PENDING

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          打卡
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 現在時間 */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">現在時間</p>
          <p className="text-4xl font-bold tracking-tight">
            {currentTime.toLocaleTimeString('zh-TW', { hour12: false })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {currentTime.toLocaleDateString('zh-TW', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            })}
          </p>
        </div>

        {/* 今日打卡紀錄 */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">上班打卡</p>
            <p className="text-xl font-semibold">
              {todayStatus?.clockInTime
                ? new Date(todayStatus.clockInTime).toLocaleTimeString('zh-TW', { hour12: false })
                : '--:--:--'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">下班打卡</p>
            <p className="text-xl font-semibold">
              {todayStatus?.clockOutTime
                ? new Date(todayStatus.clockOutTime).toLocaleTimeString('zh-TW', { hour12: false })
                : '--:--:--'}
            </p>
          </div>
        </div>

        {/* 打卡狀態 */}
        {todayStatus && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">今日狀態</p>
            {getStatusBadge()}
            {todayStatus.lateMinutes > 0 && (
              <p className="text-xs text-red-600 mt-1">遲到 {todayStatus.lateMinutes} 分鐘</p>
            )}
            {todayStatus.earlyLeaveMinutes > 0 && (
              <p className="text-xs text-orange-600 mt-1">早退 {todayStatus.earlyLeaveMinutes} 分鐘</p>
            )}
          </div>
        )}

        {/* 打卡按鈕 */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            className="h-16 text-lg"
            onClick={handleClockIn}
            disabled={hasClockedIn || clockInMutation.isPending}
          >
            <LogIn className="h-5 w-5 mr-2" />
            {clockInMutation.isPending ? '處理中...' : '上班打卡'}
          </Button>
          <Button
            className="h-16 text-lg"
            variant="secondary"
            onClick={handleClockOut}
            disabled={!hasClockedIn || hasClockedOut || clockOutMutation.isPending}
          >
            <LogOut className="h-5 w-5 mr-2" />
            {clockOutMutation.isPending ? '處理中...' : '下班打卡'}
          </Button>
        </div>

        {/* 錯誤訊息 */}
        {clockInMutation.error && (
          <p className="text-sm text-red-600 text-center">
            {clockInMutation.error.message}
          </p>
        )}
        {clockOutMutation.error && (
          <p className="text-sm text-red-600 text-center">
            {clockOutMutation.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
