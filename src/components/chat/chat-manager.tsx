'use client'

import { useState, useCallback } from 'react'
import { FloatingChatWindow, MinimizedChatBubble } from './floating-chat-window'

interface ChatWindow {
  id: string
  conversationId: string
  conversationName: string
  isMinimized: boolean
  position: { x: number; y: number }
  unreadCount: number
}

interface ChatManagerProps {
  userId: string
}

export function ChatManager({ userId }: ChatManagerProps) {
  const [chatWindows, setChatWindows] = useState<ChatWindow[]>([])

  // Open a new chat window or restore minimized one
  const openChat = useCallback((conversationId: string, conversationName: string) => {
    setChatWindows(prev => {
      const existing = prev.find(w => w.conversationId === conversationId)
      if (existing) {
        // Restore if minimized
        return prev.map(w =>
          w.conversationId === conversationId
            ? { ...w, isMinimized: false }
            : w
        )
      }
      // Create new window
      const offset = prev.filter(w => !w.isMinimized).length * 30
      return [
        ...prev,
        {
          id: `chat-${Date.now()}`,
          conversationId,
          conversationName,
          isMinimized: false,
          position: { x: 100 + offset, y: 100 + offset },
          unreadCount: 0,
        },
      ]
    })
  }, [])

  // Close a chat window
  const closeChat = useCallback((conversationId: string) => {
    setChatWindows(prev => prev.filter(w => w.conversationId !== conversationId))
  }, [])

  // Minimize a chat window
  const minimizeChat = useCallback((conversationId: string) => {
    setChatWindows(prev =>
      prev.map(w =>
        w.conversationId === conversationId
          ? { ...w, isMinimized: true }
          : w
      )
    )
  }, [])

  // Pop out to new browser window
  const popoutChat = useCallback((conversationId: string) => {
    const width = 400
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    window.open(
      `/dashboard/messages/popup/${conversationId}`,
      `chat-${conversationId}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
    )

    // Close the floating window
    closeChat(conversationId)
  }, [closeChat])

  // Get minimized windows
  const minimizedWindows = chatWindows.filter(w => w.isMinimized)
  const openWindows = chatWindows.filter(w => !w.isMinimized)

  return (
    <>
      {/* Floating windows */}
      {openWindows.map(window => (
        <FloatingChatWindow
          key={window.id}
          userId={userId}
          conversationId={window.conversationId}
          conversationName={window.conversationName}
          initialPosition={window.position}
          onClose={() => closeChat(window.conversationId)}
          onMinimize={() => minimizeChat(window.conversationId)}
          onPopout={() => popoutChat(window.conversationId)}
        />
      ))}

      {/* Minimized bubbles */}
      {minimizedWindows.map((window, index) => (
        <MinimizedChatBubble
          key={window.id}
          conversationName={window.conversationName}
          unreadCount={window.unreadCount}
          position={index}
          onClick={() => openChat(window.conversationId, window.conversationName)}
          onClose={() => closeChat(window.conversationId)}
        />
      ))}
    </>
  )
}

// Export hook for opening chats from anywhere
import { createContext, useContext, ReactNode } from 'react'

interface ChatContextType {
  openChat: (conversationId: string, conversationName: string) => void
}

const ChatContext = createContext<ChatContextType | null>(null)

export function ChatProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [chatWindows, setChatWindows] = useState<ChatWindow[]>([])

  const openChat = useCallback((conversationId: string, conversationName: string) => {
    setChatWindows(prev => {
      const existing = prev.find(w => w.conversationId === conversationId)
      if (existing) {
        return prev.map(w =>
          w.conversationId === conversationId
            ? { ...w, isMinimized: false }
            : w
        )
      }
      const offset = prev.filter(w => !w.isMinimized).length * 30
      return [
        ...prev,
        {
          id: `chat-${Date.now()}`,
          conversationId,
          conversationName,
          isMinimized: false,
          position: { x: 100 + offset, y: 100 + offset },
          unreadCount: 0,
        },
      ]
    })
  }, [])

  const closeChat = useCallback((conversationId: string) => {
    setChatWindows(prev => prev.filter(w => w.conversationId !== conversationId))
  }, [])

  const minimizeChat = useCallback((conversationId: string) => {
    setChatWindows(prev =>
      prev.map(w =>
        w.conversationId === conversationId
          ? { ...w, isMinimized: true }
          : w
      )
    )
  }, [])

  const popoutChat = useCallback((conversationId: string) => {
    const width = 400
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    window.open(
      `/dashboard/messages/popup/${conversationId}`,
      `chat-${conversationId}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
    )

    closeChat(conversationId)
  }, [closeChat])

  const minimizedWindows = chatWindows.filter(w => w.isMinimized)
  const openWindows = chatWindows.filter(w => !w.isMinimized)

  return (
    <ChatContext.Provider value={{ openChat }}>
      {children}

      {/* Floating windows */}
      {openWindows.map(window => (
        <FloatingChatWindow
          key={window.id}
          userId={userId}
          conversationId={window.conversationId}
          conversationName={window.conversationName}
          initialPosition={window.position}
          onClose={() => closeChat(window.conversationId)}
          onMinimize={() => minimizeChat(window.conversationId)}
          onPopout={() => popoutChat(window.conversationId)}
        />
      ))}

      {/* Minimized bubbles */}
      {minimizedWindows.map((window, index) => (
        <MinimizedChatBubble
          key={window.id}
          conversationName={window.conversationName}
          unreadCount={window.unreadCount}
          position={index}
          onClick={() => openChat(window.conversationId, window.conversationName)}
          onClose={() => closeChat(window.conversationId)}
        />
      ))}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
