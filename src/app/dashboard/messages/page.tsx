import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MessagingClient } from './messaging-client'

export default async function MessagesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return <MessagingClient userId={session.user.id} />
}
