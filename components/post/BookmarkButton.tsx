/**
 * @module components/post/BookmarkButton
 */

'use client'

import { useState, useTransition, useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { MSG_BOOKMARK_ADDED, MSG_BOOKMARK_FAILED, MSG_BOOKMARK_REMOVED, MSG_ERROR_TITLE } from '@/lib/constants/messages'
import { Button } from '@/components/ui/button'
import { toggleBookmark } from '@/lib/actions/bookmark'

type BookmarkButtonProps = {
  postId: string
  initialBookmarked: boolean
}

export function BookmarkButton({
  postId,
  initialBookmarked,
}: BookmarkButtonProps) {

  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    setBookmarked(initialBookmarked)
  }, [initialBookmarked])

  async function handleToggle() {
    const newBookmarked = !bookmarked
    setBookmarked(newBookmarked)

    startTransition(async () => {
      const result = await toggleBookmark(postId)

      if (!result.success) {
        setBookmarked(bookmarked)
        toast({
          title: MSG_ERROR_TITLE,
          description: MSG_BOOKMARK_FAILED,
          variant: 'destructive',
        })
      } else {
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
        toast({
          description: newBookmarked ? MSG_BOOKMARK_ADDED : MSG_BOOKMARK_REMOVED,
        })
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`${
        bookmarked
          ? 'text-foreground hover:text-foreground/80'
          : 'text-muted-foreground hover:text-foreground'
      }`}
      onClick={handleToggle}
      disabled={isPending}
      aria-label={bookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
      aria-pressed={bookmarked}
    >
      <Bookmark
        className={`w-5 h-5 transition-all ${
          bookmarked ? 'fill-current scale-110' : ''
        }`}
        aria-hidden="true"
      />
    </Button>
  )
}
