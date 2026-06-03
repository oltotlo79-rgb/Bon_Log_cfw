'use client'

/**
 * @module components/post/QuotePostModal
 * 引用投稿の作成モーダル。コメントを添えて既存投稿を引用する。
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { createQuotePost } from '@/lib/actions/post'
import { buildPostPath } from '@/lib/constants/path-builders'
import { MSG_ERROR_TITLE, MSG_QUOTE_DONE, MSG_QUOTE_FAILED } from '@/lib/constants/messages'

type QuoteTarget = {
  id: string
  content: string | null
  user: { nickname: string }
}

type QuotePostModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteTarget: QuoteTarget
}

export function QuotePostModal({ open, onOpenChange, quoteTarget }: QuotePostModalProps) {
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  function handleSubmit() {
    if (content.trim().length === 0) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append('content', content)
      const result = await createQuotePost(formData, quoteTarget.id)

      if (!result.success) {
        toast({
          title: MSG_ERROR_TITLE,
          description: ('error' in result ? result.error : null) ?? MSG_QUOTE_FAILED,
          variant: 'destructive',
        })
        return
      }

      toast({ description: MSG_QUOTE_DONE })
      setContent('')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
      if (result.data?.postId) {
        router.push(buildPostPath(result.data.postId))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>引用投稿</DialogTitle>
          <DialogDescription className="sr-only">
            コメントを添えてこの投稿を引用します
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="コメントを追加..."
          rows={4}
          autoFocus
          aria-label="引用コメント"
        />

        {/* 引用元プレビュー（モーダル内では遷移させないため非リンク表示） */}
        <div className="border rounded-lg p-3 text-sm">
          <span className="font-medium">{quoteTarget.user.nickname}</span>
          {quoteTarget.content && (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">
              {quoteTarget.content}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            キャンセル
          </Button>
          <Button
            variant="bonsai"
            onClick={handleSubmit}
            disabled={isPending || content.trim().length === 0}
          >
            {isPending ? '投稿中...' : '投稿する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
