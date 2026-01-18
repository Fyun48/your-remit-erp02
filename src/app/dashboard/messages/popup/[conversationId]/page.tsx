import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PopupChatClient } from './popup-chat-client'

interface PopupChatPageProps {
  params: {
    conversationId: string
  }
}

export default async function PopupChatPage({ params }: PopupChatPageProps) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <PopupChatClient
      userId={session.user.id}
      conversationId={params.conversationId}
    />
  )
}
