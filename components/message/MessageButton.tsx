/**
 * @module components/message/MessageButton
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateConversation } from '@/lib/actions/message'
import { Button } from '@/components/ui/button'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'
import { buildMessageConversationPath } from '@/lib/constants/path-builders'

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

interface MessageButtonProps {
  userId: string
  isBlocked?: boolean
}

export function MessageButton({ userId, isBlocked = false }: MessageButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    if (isBlocked) return

    setError(null)

    startTransition(async () => {
      const result = await getOrCreateConversation(userId)

      if (!result.success) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
        return
      }

      if (result.data?.conversationId) {
        router.push(buildMessageConversationPath(result.data.conversationId))
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={handleClick}
        disabled={isPending || isBlocked}
        aria-label={isBlocked ? 'メッセージを送れません' : 'メッセージを送る'}
      >
        <MessageSquareIcon className="w-4 h-4" aria-hidden="true" />
      </Button>

      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </>
  )
}
