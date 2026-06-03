'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { buildPostPath } from '@/lib/constants/path-builders'
import { LikeButton } from './LikeButton'
import { BookmarkButton } from './BookmarkButton'
import { RepostButton } from './RepostButton'
import { HeartIcon, MessageCircleIcon, RepeatIcon, BookmarkIcon } from './PostCardIcons'

type PostCardActionsProps = {
  postId: string
  currentUserId?: string
  isLiked: boolean
  isBookmarked: boolean
  likesCount: number
  commentsCount: number
  isReposted: boolean
  repostCount: number
  quoteTarget: { id: string; content: string | null; user: { nickname: string } }
}

export const PostCardActions = memo(function PostCardActions({
  postId,
  currentUserId,
  isLiked,
  isBookmarked,
  likesCount,
  commentsCount,
  isReposted,
  repostCount,
  quoteTarget,
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
        <Link href={buildPostPath(postId)} data-testid="comment-link">
          <MessageCircleIcon className="w-4 h-4" />
          <span className="text-xs">{commentsCount > 0 && commentsCount}</span>
        </Link>
      </Button>

      {currentUserId ? (
        <RepostButton
          postId={postId}
          quoteTarget={quoteTarget}
          initialReposted={isReposted}
          initialCount={repostCount}
        />
      ) : (
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" aria-label="リポスト" asChild>
          <Link href={ROUTE_LOGIN}>
            <RepeatIcon className="w-4 h-4" />
            {repostCount > 0 && <span className="text-xs">{repostCount}</span>}
          </Link>
        </Button>
      )}

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
