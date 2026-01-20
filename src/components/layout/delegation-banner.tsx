'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc'
import { useState, useEffect } from 'react'

const permissionLabels: Record<string, string> = {
  APPROVE_LEAVE: '審核請假',
  APPROVE_EXPENSE: '審核費用',
  APPROVE_SEAL: '審核用印',
  APPROVE_CARD: '審核名片',
  APPROVE_STATIONERY: '審核文具',
  APPLY_LEAVE: '申請請假',
  APPLY_EXPENSE: '申請費用',
  VIEW_REPORTS: '查看報表',
}

export function DelegationBanner() {
  const { data: session } = useSession()
  const [dismissed, setDismissed] = useState(false)

  const employeeId = (session?.user as { id?: string })?.id || ''

  const { data: activeDelegations } = trpc.delegation.getActiveDelegations.useQuery(
    { employeeId },
    { enabled: !!employeeId }
  )

  // Reset dismissed state when delegations change
  useEffect(() => {
    if (activeDelegations && activeDelegations.length > 0) {
      setDismissed(false)
    }
  }, [activeDelegations])

  if (!activeDelegations || activeDelegations.length === 0 || dismissed) {
    return null
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200">
      <div className="max-w-screen-2xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-blue-700">
              <UserCheck className="h-4 w-4" />
              <span className="font-medium text-sm">職務代理中</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeDelegations.map((delegation) => (
                <div
                  key={delegation.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 rounded-md text-xs"
                >
                  <span className="font-medium text-blue-800">
                    {delegation.delegator.name}
                  </span>
                  <span className="text-blue-600">
                    ({delegation.permissions.map(p =>
                      permissionLabels[p.permissionType] || p.permissionType
                    ).join('、')})
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/hr/delegation">
              <Button variant="ghost" size="sm" className="text-blue-700 hover:text-blue-800 hover:bg-blue-100 h-7 text-xs">
                管理代理
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
