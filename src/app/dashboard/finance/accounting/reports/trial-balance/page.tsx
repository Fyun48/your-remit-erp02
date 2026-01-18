import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TrialBalanceReport } from './trial-balance-report'

export default async function TrialBalancePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return <TrialBalanceReport />
}
