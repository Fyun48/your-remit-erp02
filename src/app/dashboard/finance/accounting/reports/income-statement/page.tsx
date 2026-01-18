import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { IncomeStatementReport } from './income-statement-report'

export default async function IncomeStatementPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return <IncomeStatementReport />
}
