import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CashFlowReport } from './cash-flow-report'

export default async function CashFlowPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return <CashFlowReport />
}
