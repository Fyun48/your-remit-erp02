'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trpc } from '@/lib/trpc'
import { Calendar } from 'lucide-react'

interface LeaveBalanceCardProps {
  employeeId: string
  companyId: string
}

export function LeaveBalanceCard({ employeeId, companyId }: LeaveBalanceCardProps) {
  const { data: balances, isLoading } = trpc.leaveBalance.list.useQuery({
    employeeId,
    companyId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            假別餘額
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">載入中...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          假別餘額
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {balances?.map((b) => (
            <div key={b.leaveType.id} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <p className="font-medium">{b.leaveType.name}</p>
                <p className="text-sm text-muted-foreground">
                  已用 {b.usedHours / 8} 天
                  {b.pendingHours > 0 && ` (審核中 ${b.pendingHours / 8} 天)`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">
                  {b.remainingHours === -1 ? '不限' : `${b.remainingHours / 8} 天`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {b.totalAvailable === -1 ? '' : `/ ${b.totalAvailable / 8} 天`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
