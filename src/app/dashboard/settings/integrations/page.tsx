import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LineIntegrationSettings } from './line-integration-settings'

export default async function IntegrationsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return <LineIntegrationSettings />
}
