'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { List, Trash2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { ShiftForm } from '@/components/settings/shift-form'
import type { WorkShift, ShiftBreak } from '@prisma/client'

type WorkShiftWithBreaks = WorkShift & { breaks: ShiftBreak[] }

interface ShiftListProps {
  initialShifts: WorkShiftWithBreaks[]
  companyId: string
}

export function ShiftList({ initialShifts, companyId }: ShiftListProps) {
  // 使用 tRPC query 取得班別列表，初始資料從 server 傳入
  const { data: shifts, refetch } = trpc.workShift.list.useQuery(
    { companyId },
    { initialData: initialShifts }
  )

  // 刪除 mutation
  const deleteMutation = trpc.workShift.delete.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  const handleDelete = (id: string, name: string) => {
    if (confirm(`確定要刪除班別「${name}」嗎？`)) {
      deleteMutation.mutate({ id })
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* 新增班別表單 */}
      <ShiftForm companyId={companyId} onSuccess={() => refetch()} />

      {/* 現有班別列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            現有班別
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shifts && shifts.length > 0 ? (
            <div className="space-y-3">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{shift.name}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {shift.code}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {shift.workStartTime} - {shift.workEndTime}
                      {(shift.lateGraceMinutes > 0 || shift.earlyLeaveGraceMinutes > 0) && (
                        <span className="ml-2">
                          （遲到寬限 {shift.lateGraceMinutes} 分 / 早退寬限 {shift.earlyLeaveGraceMinutes} 分）
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(shift.id, shift.name)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              尚無班別，請從左側新增
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
