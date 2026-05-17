'use client'

/**
 * @module components/post/LikeButton
 * 投稿のいいねトグルボタン。
 * Optimistic UI でクリック直後に状態を反映し、Server Action 失敗時は元の値に戻す。
 */

import { useState, useTransition, useEffect, useRef } from 'react'
import { Heart } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import {
  MSG_ERROR_TITLE,
  MSG_LIKE_ADDED,
  MSG_LIKE_FAILED,
  MSG_LIKE_REMOVED,
} from '@/lib/constants/messages'
import { Button } from '@/components/ui/button'
import { togglePostLike } from '@/lib/actions/like'

type LikeButtonProps = {
  postId: string
  initialLiked: boolean
  initialCount: number
}

/** バウンスアニメーションの再生時間 (ms)。CSS の `animate-like-bounce` と一致させる。 */
const LIKE_BOUNCE_DURATION_MS = 400

export function LikeButton({ postId, initialLiked, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // 親 (Timeline 等) の再取得で props が変わったときに state を同期する。
  // 関数型更新で値が変わったときだけ書き換えてカスケードレンダーを防ぐ。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- props 同期のための必要な処理
    setLiked((prev) => (prev !== initialLiked ? initialLiked : prev))
    setCount((prev) => (prev !== initialCount ? initialCount : prev))
  }, [initialLiked, initialCount])

  async function handleToggle() {
    const newLiked = !liked
    setLiked(newLiked)
    setCount((prev) => (newLiked ? prev + 1 : prev - 1))

    if (newLiked) {
      setIsAnimating(true)
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current)
      }
      animationTimerRef.current = setTimeout(() => {
        setIsAnimating(false)
      }, LIKE_BOUNCE_DURATION_MS)
    }

    startTransition(async () => {
      const result = await togglePostLike(postId)

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
        toast({
          description: newLiked ? MSG_LIKE_ADDED : MSG_LIKE_REMOVED,
        })
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`flex items-center gap-1 ${
        liked
          ? 'text-rose-500 hover:text-rose-400'
          : 'text-muted-foreground hover:text-foreground'
      }`}
      onClick={handleToggle}
      disabled={isPending}
      aria-label={liked ? 'いいねを取り消す' : 'いいねする'}
      aria-pressed={liked}
    >
      <Heart
        className={`w-5 h-5 transition-all ${
          liked ? 'fill-current scale-110' : ''
        } ${isAnimating ? 'animate-like-bounce' : ''}`}
        aria-hidden="true"
      />
      <span className="text-sm">{count}</span>
    </Button>
  )
}
