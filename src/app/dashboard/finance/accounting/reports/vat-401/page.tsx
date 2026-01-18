import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Vat401Report } from './vat-401-report'

export default async function Vat401Page() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return <Vat401Report />
}
