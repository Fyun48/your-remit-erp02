import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import InsuranceGrades from './insurance-grades'

export default async function InsuranceGradesPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return <InsuranceGrades />
}
