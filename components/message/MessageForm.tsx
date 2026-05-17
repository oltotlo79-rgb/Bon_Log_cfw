'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Send as SendIcon } from 'lucide-react'
import { sendMessage } from '@/lib/actions/message'
import { MAX_MESSAGE_LENGTH, MESSAGE_TEXTAREA_MAX_HEIGHT_PX } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

interface MessageFormProps {
  conversationId: string
}

export function MessageForm({ conversationId }: MessageFormProps) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Why: textarea を `height: auto` で 1 度リセットしてから scrollHeight を読むと、
  // 削除操作で内容が縮んだ場合にも正しい高さに収束する (リセットなしだと最大値で固着する)。
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, MESSAGE_TEXTAREA_MAX_HEIGHT_PX)}px`
    }
  }, [content])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || isPending) return

    setError(null)

    startTransition(async () => {
      const result = await sendMessage(conversationId, content.trim())

      if (!result.success) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
        return
      }

      setContent('')
      router.refresh()
    })
  }

  // Why: Enter 単独は改行に残し、Ctrl/Cmd + Enter で送信させる (Slack/Discord 等と同じ慣習)。
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="border-t p-4">
      {error && (
        <div className="mb-2 p-2 text-sm text-destructive bg-muted/50 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            className="w-full px-4 py-2 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isPending}
          />
        </div>

        <button
          type="submit"
          aria-label="送信"
          disabled={!content.trim() || isPending}
          className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <SendIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </form>

      <p className="text-xs text-muted-foreground mt-2">
        {content.length}/{MAX_MESSAGE_LENGTH}文字 | Ctrl+Enterで送信
      </p>
    </div>
  )
}
