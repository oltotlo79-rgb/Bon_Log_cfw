'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { LikeButton } from './LikeButton'
import { BookmarkButton } from './BookmarkButton'
import { HeartIcon, MessageCircleIcon, RepeatIcon, BookmarkIcon } from './PostCardIcons'

type PostCardActionsProps = {
  postId: string
  currentUserId?: string
  isLiked: boolean
  isBookmarked: boolean
  likesCount: number
  commentsCount: number
}

export const PostCardActions = memo(function PostCardActions({
  postId,
  currentUserId,
  isLiked,
  isBookmarked,
  likesCount,
  commentsCount,
}: PostCardActionsProps) {
  return (
    <div className="flex items-center gap-4 -ml-2" data-testid="post-actions" onClick={(e) => e.stopPropagation()}>
      {currentUserId ? (
        <LikeButton
          postId={postId}
          initialLiked={isLiked}
          initialCount={likesCount}
        />
      ) : (
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" asChild>
          <Link href={ROUTE_LOGIN}>
            <HeartIcon className="w-4 h-4" />
            <span className="text-xs">{likesCount > 0 && likesCount}</span>
          </Link>
        </Button>
      )}

      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1" aria-label="コメント" asChild>
        <Link href={`/posts/${postId}`} data-testid="comment-link">
          <MessageCircleIcon className="w-4 h-4" />
          <span className="text-xs">{commentsCount > 0 && commentsCount}</span>
        </Link>
      </Button>

      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" aria-label="リポスト">
        <RepeatIcon className="w-4 h-4" />
      </Button>

      {currentUserId ? (
        <BookmarkButton
          postId={postId}
          initialBookmarked={isBookmarked}
        />
      ) : (
        <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
          <Link href={ROUTE_LOGIN}>
            <BookmarkIcon className="w-4 h-4" />
          </Link>
        </Button>
      )}
    </div>
  )
})
