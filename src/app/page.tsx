'use client'

import { trpc } from '@/lib/trpc'

export default function Home() {
  const health = trpc.health.check.useQuery()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">集團 ERP 系統</h1>
      <div className="text-lg">
        {health.isLoading && <p>檢查系統狀態...</p>}
        {health.isError && <p className="text-red-500">系統錯誤</p>}
        {health.data && (
          <p className="text-green-500">
            系統狀態: {health.data.status} ({health.data.timestamp})
          </p>
        )}
      </div>
    </main>
  )
}
