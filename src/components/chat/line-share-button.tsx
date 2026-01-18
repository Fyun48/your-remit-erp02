'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { trpc } from '@/lib/trpc'

interface LineShareButtonProps {
  text: string
  url?: string
  variant?: 'icon' | 'button'
  className?: string
}

export function LineShareButton({ text, url, variant = 'icon', className }: LineShareButtonProps) {
  const { data: config } = trpc.line.isConfigured.useQuery()
  const { data: shareData } = trpc.line.getShareUrl.useQuery(
    { text, url },
    { enabled: !!config?.isConfigured }
  )

  const handleShare = () => {
    if (shareData?.shareUrl) {
      window.open(shareData.shareUrl, '_blank', 'width=600,height=600')
    }
  }

  if (!config?.isConfigured) {
    return null
  }

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className={className}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#00B900">
                <path d="M12 2C6.48 2 2 5.82 2 10.5c0 3.58 2.65 6.6 6.35 7.89-.09.35-.22.63-.38.89-.21.35-.35.6-.49.87-.14.27-.27.51-.32.8-.05.29.02.61.24.84.22.23.51.33.8.28.29-.05.57-.15.83-.27.58-.27 1.14-.57 1.69-.89 1.07.22 2.2.34 3.38.34 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/>
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>分享到 LINE</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Button
      variant="outline"
      onClick={handleShare}
      className={className}
    >
      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="#00B900">
        <path d="M12 2C6.48 2 2 5.82 2 10.5c0 3.58 2.65 6.6 6.35 7.89-.09.35-.22.63-.38.89-.21.35-.35.6-.49.87-.14.27-.27.51-.32.8-.05.29.02.61.24.84.22.23.51.33.8.28.29-.05.57-.15.83-.27.58-.27 1.14-.57 1.69-.89 1.07.22 2.2.34 3.38.34 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/>
      </svg>
      分享到 LINE
    </Button>
  )
}

// Message context menu for sharing
interface MessageShareMenuProps {
  messageContent: string
  messageUrl?: string
  children: React.ReactNode
}

export function MessageShareMenu({ messageContent, messageUrl, children }: MessageShareMenuProps) {
  const { data: config } = trpc.line.isConfigured.useQuery()
  const { data: shareData } = trpc.line.getShareUrl.useQuery(
    { text: messageContent, url: messageUrl },
    { enabled: !!config?.isConfigured }
  )

  const handleShareToLine = () => {
    if (shareData?.shareUrl) {
      window.open(shareData.shareUrl, '_blank', 'width=600,height=600')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(messageContent)}>
          複製文字
        </DropdownMenuItem>
        {config?.isConfigured && (
          <DropdownMenuItem onClick={handleShareToLine}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="#00B900">
              <path d="M12 2C6.48 2 2 5.82 2 10.5c0 3.58 2.65 6.6 6.35 7.89-.09.35-.22.63-.38.89-.21.35-.35.6-.49.87-.14.27-.27.51-.32.8-.05.29.02.61.24.84.22.23.51.33.8.28.29-.05.57-.15.83-.27.58-.27 1.14-.57 1.69-.89 1.07.22 2.2.34 3.38.34 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/>
            </svg>
            分享到 LINE
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
