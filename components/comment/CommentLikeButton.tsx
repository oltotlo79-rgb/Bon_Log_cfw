/**
 * @module components/comment/CommentLikeButton
 */

'use client'

import { useState, useTransition, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { MSG_ERROR_TITLE, MSG_LIKE_FAILED } from '@/lib/constants/messages'
import { Button } from '@/components/ui/button'
import { toggleCommentLike } from '@/lib/actions/like'

type CommentLikeButtonProps = {
  commentId: string
  postId: string
  initialLiked: boolean
  initialCount: number
}

export function CommentLikeButton({
  commentId,
  postId,
  initialLiked,
  initialCount,
}: CommentLikeButtonProps) {

  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- props同期のための必要な処理
    setLiked((prev) => (prev !== initialLiked ? initialLiked : prev))
    setCount((prev) => (prev !== initialCount ? initialCount : prev))
  }, [initialLiked, initialCount])

  async function handleToggle() {
    const newLiked = !liked
    setLiked(newLiked)
    setCount(prev => newLiked ? prev + 1 : prev - 1)

    startTransition(async () => {
      const result = await toggleCommentLike(commentId, postId)

      if (!result.success) {
        setLiked(liked)
        setCount(initialCount)
        toast({
          title: MSG_ERROR_TITLE,
          description: MSG_LIKE_FAILED,
          variant: 'destructive',
        })
      } else {
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 px-2 ${
        liked
          ? 'text-foreground hover:text-foreground/80'
          : 'text-muted-foreground hover:text-foreground'
      }`}
      onClick={handleToggle}
      disabled={isPending}
      aria-label={liked ? 'コメントのいいねを取り消す' : 'コメントにいいねする'}
      aria-pressed={liked}
    >
      <Heart
        className={`w-4 h-4 mr-1 transition-all ${
          liked ? 'fill-current scale-110' : ''
        }`}
        aria-hidden="true"
      />
      <span className="text-xs">{count}</span>
    </Button>
  )
}
