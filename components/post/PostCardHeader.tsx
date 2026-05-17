'use client'

import { memo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontalIcon, EyeOffIcon } from './PostCardIcons'
import { DeletePostButton } from './DeletePostButton'
import { ReportButton } from '@/components/report/ReportButton'
import { hidePost } from '@/lib/actions/hide-post'
import { ROUTE_FEED } from '@/lib/constants/routes'
import type { PostUser } from './PostCard.types'

type PostCardHeaderProps = {
  user: PostUser
  timeAgo: string
  postId: string
  isOwner: boolean
  isRepost: boolean
  currentUserId?: string
  displayPostId: string
  disableNavigation: boolean
  onHidden: () => void
  createdAt?: Date | string
}

function formatAbsoluteDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const PostCardHeader = memo(function PostCardHeader({
  user,
  timeAgo,
  postId,
  isOwner,
  isRepost,
  currentUserId,
  displayPostId,
  disableNavigation,
  onHidden,
  createdAt,
}: PostCardHeaderProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="flex items-center gap-3 mb-2" data-testid="post-header">
      <Link
        href={`/users/${user.id}`}
        className="flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-11 h-11 rounded-full bg-muted overflow-hidden avatar-washi hover:border-primary transition-all duration-300">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.nickname}
              width={44}
              height={44}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium bg-gradient-to-br from-muted to-secondary">
              {user.nickname.charAt(0)}
            </div>
          )}
        </div>
      </Link>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Link
          href={`/users/${user.id}`}
          className="font-medium hover:text-primary transition-colors truncate text-[15px]"
          onClick={(e) => e.stopPropagation()}
          data-testid="post-author"
        >
          {user.nickname}
        </Link>
        <time
          dateTime={createdAt ? new Date(createdAt).toISOString() : undefined}
          title={createdAt ? formatAbsoluteDate(new Date(createdAt)) : undefined}
          className="text-xs text-muted-foreground flex-shrink-0 hover:underline cursor-help"
          data-testid="post-time"
        >
          {timeAgo}
        </time>
      </div>

      <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 hover:bg-muted rounded-lg transition-colors"
          data-testid="post-menu-button"
        >
          <MoreHorizontalIcon className="w-4 h-4 text-muted-foreground" />
        </button>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border/50 rounded-xl shadow-washi-lg py-1.5 min-w-[160px]" data-testid="post-menu-dropdown">
              {isOwner && !isRepost && (
                <DeletePostButton postId={postId} variant="menu" onDeleted={() => setShowMenu(false)} />
              )}
              {currentUserId && !isOwner && (
                <>
                  <button
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowMenu(false)
                      onHidden()
                      await hidePost(displayPostId)
                      if (disableNavigation) {
                        router.push(ROUTE_FEED)
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    data-testid="hide-post-button"
                  >
                    <EyeOffIcon className="w-4 h-4" />
                    <span>この投稿を非表示</span>
                  </button>
                  <ReportButton
                    targetType="post"
                    targetId={displayPostId}
                    variant="menu"
                    onSuccess={() => {
                      router.push(ROUTE_FEED)
                      router.refresh()
                    }}
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
})
