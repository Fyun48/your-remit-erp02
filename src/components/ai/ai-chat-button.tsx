'use client'

import { useState } from 'react'
import { Bot, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AIChatWindow } from './ai-chat-window'
import { trpc } from '@/lib/trpc'

export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false)

  // 檢查 AI 是否啟用
  const { data: config } = trpc.ai.getConfig.useQuery()
  const isEnabled = config?.provider !== 'disabled' && config?.hasApiKey

  // 如果 AI 未啟用，不顯示按鈕
  if (!isEnabled) {
    return null
  }

  return (
    <>
      {/* 浮動按鈕 */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40',
          'hover:scale-105 transition-transform',
          isOpen && 'bg-destructive hover:bg-destructive/90'
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Bot className="h-6 w-6" />
        )}
      </Button>

      {/* 聊天視窗 */}
      <AIChatWindow open={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
