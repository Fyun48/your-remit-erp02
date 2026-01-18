import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BalanceSheetReport } from './balance-sheet-report'

export default async function BalanceSheetPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return <BalanceSheetReport />
}
