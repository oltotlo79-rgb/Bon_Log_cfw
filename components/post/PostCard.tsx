'use client'

import { memo, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ImageGallery } from './ImageGallery'
import { QuotedPost } from './QuotedPost'
import { PollDisplay } from './PollDisplay'
import { PostCardHeader } from './PostCardHeader'
import { PostCardActions } from './PostCardActions'
import { RepeatIcon } from './PostCardIcons'
import { parseContentSegments, type ContentSegment } from '@/lib/mention-utils'
import { POST_PREVIEW_LENGTH, POST_PREVIEW_MAX_LINES } from '@/lib/constants/limits'
import { buildUserPath, buildPostPath, buildSearchPath, buildSearchByGenrePath } from '@/lib/constants/path-builders'
import type { PostCardProps } from './PostCard.types'

export type { Post, PostMedia, PostGenre, PostUser, QuotePost, MentionUser, PostCardProps } from './PostCard.types'

const CONTENT_TRUNCATE_LENGTH = POST_PREVIEW_LENGTH
const CONTENT_TRUNCATE_LINES = POST_PREVIEW_MAX_LINES
const EMPTY_MENTION_MAP = new Map<string, { id: string; nickname: string; avatarUrl: string | null }>()

export const PostCard = memo(function PostCard({ post, currentUserId, initialLiked, initialBookmarked, disableNavigation = false, mentionUsers = EMPTY_MENTION_MAP }: PostCardProps) {
  const router = useRouter()
  const [isHiddenByUser, setIsHiddenByUser] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const isOwner = currentUserId === post.user.id
  const likesCount = post.likeCount ?? 0
  const commentsCount = post.commentCount ?? 0
  const isLiked = initialLiked ?? post.isLiked ?? false
  const isBookmarked = initialBookmarked ?? post.isBookmarked ?? false
  const displayPost = post.repostPost || post
  const isRepost = !!post.repostPost

  const timeAgo = useMemo(() => formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
    locale: ja,
  }), [post.createdAt])

  const fullContentSegments = useMemo(
    () => displayPost.content ? parseContentSegments(displayPost.content) : [],
    [displayPost.content]
  )

  function renderSegments(segments: ContentSegment[]) {
    return segments.map((segment, i) => {
      switch (segment.type) {
        case 'mention': {
          const user = mentionUsers.get(segment.userId)
          return (
            <Link
              key={i}
              href={buildUserPath(segment.userId)}
              className="text-primary hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              @{user?.nickname || 'unknown'}
            </Link>
          )
        }
        case 'hashtag':
          return (
            <Link
              key={i}
              href={buildSearchPath(segment.tag)}
              className="text-bonsai-green hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {segment.tag}
            </Link>
          )
        default:
          return <span key={i}>{segment.content}</span>
      }
    })
  }

  const contentDisplay = useMemo(() => {
    if (!displayPost.content) return null
    const content = displayPost.content
    const lines = content.split('\n')
    const shouldTruncateByLines = !disableNavigation && lines.length > CONTENT_TRUNCATE_LINES
    const shouldTruncateByLength = !disableNavigation && content.length > CONTENT_TRUNCATE_LENGTH
    const isTruncated = shouldTruncateByLines || shouldTruncateByLength
    const truncatedSegments = isTruncated
      ? parseContentSegments(
          shouldTruncateByLines
            ? lines.slice(0, CONTENT_TRUNCATE_LINES).join('\n') + '...'
            : content.slice(0, CONTENT_TRUNCATE_LENGTH) + '...'
        )
      : null
    return { isTruncated, truncatedSegments }
  }, [displayPost.content, disableNavigation])

  if (isHiddenByUser) return null

  // 展開時はメモ化済みの全文セグメントを再利用し、二重パースを回避
  const displaySegments = contentDisplay && contentDisplay.isTruncated && !isExpanded
    ? contentDisplay.truncatedSegments!
    : fullContentSegments

  return (
    <article
      className={`group/card card-washi p-5 mb-4 shadow-washi hover:shadow-washi-hover transition-all duration-300 ${!disableNavigation ? 'cursor-pointer' : ''}`}
      onClick={!disableNavigation ? () => router.push(buildPostPath(displayPost.id)) : undefined}
      onKeyDown={!disableNavigation ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(buildPostPath(displayPost.id))
        }
      } : undefined}
      role={!disableNavigation ? 'link' : undefined}
      tabIndex={!disableNavigation ? 0 : undefined}
      aria-label={!disableNavigation ? `${displayPost.user.nickname}の投稿を表示` : undefined}
      data-testid="post-card"
    >
      {isRepost && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2" data-testid="repost-indicator">
          <RepeatIcon className="w-3 h-3" />
          <Link
            href={buildUserPath(post.user.id)}
            className="hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {post.user.nickname}
          </Link>
          がリポスト
        </div>
      )}

      <PostCardHeader
        user={displayPost.user}
        timeAgo={timeAgo}
        postId={post.id}
        isOwner={isOwner}
        isRepost={isRepost}
        currentUserId={currentUserId}
        displayPostId={displayPost.id}
        disableNavigation={disableNavigation}
        onHidden={() => setIsHiddenByUser(true)}
        createdAt={post.createdAt}
        editedAt={post.editedAt}
        isPinned={post.isPinned}
      />

      {displayPost.content && contentDisplay && (
        <div className="mb-3" data-testid="post-content">
          <p className="whitespace-pre-wrap break-words">
            {renderSegments(displaySegments)}
          </p>
          {contentDisplay.isTruncated && !isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(true)
              }}
              className="inline-flex items-center gap-0.5 text-sm mt-1 text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
            >
              続きを読む
            </button>
          )}
        </div>
      )}

      {post.poll && (
        <PollDisplay poll={post.poll} currentUserId={currentUserId} />
      )}

      {'media' in displayPost && displayPost.media && displayPost.media.length > 0 && (
        <div className="mb-3 -mx-5 overflow-hidden" data-testid="post-media">
          <ImageGallery
            images={displayPost.media}
            onMediaClick={!disableNavigation ? () => router.push(buildPostPath(displayPost.id)) : undefined}
          />
        </div>
      )}

      {post.quotePost && (
        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          <QuotedPost post={post.quotePost} />
        </div>
      )}

      {post.genres && post.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3" data-testid="post-genres">
          {post.genres.map((genre) => (
            <Link
              key={genre.id}
              href={buildSearchByGenrePath(genre.id)}
              className="tag-washi"
              onClick={(e) => e.stopPropagation()}
            >
              {genre.name}
            </Link>
          ))}
        </div>
      )}

      <PostCardActions
        postId={displayPost.id}
        currentUserId={currentUserId}
        isLiked={isLiked}
        isBookmarked={isBookmarked}
        likesCount={likesCount}
        commentsCount={commentsCount}
        isReposted={post.isReposted ?? false}
        repostCount={post.repostCount ?? 0}
        quoteTarget={{
          id: displayPost.id,
          content: displayPost.content,
          user: { nickname: displayPost.user.nickname },
        }}
      />
    </article>
  )
})
