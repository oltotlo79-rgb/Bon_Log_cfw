/**
 * @module lib/services/feed-service
 * タイムライン取得のクエリ・整形ロジック。
 *
 * lib/actions/feed.ts の getTimeline と app/api/v1/feed の双方から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { getPostInteractionSets, getUserRelationSets, getGuestUserId } from '@/lib/actions/utils'
import {
  POST_LIST_INCLUDE,
  POST_QUOTE_INCLUDE,
  POST_REPOST_INCLUDE,
  buildPostPollInclude,
  formatPostForClient,
} from '@/lib/actions/post-include'
import { visiblePostWhere, redactNonVisibleNestedPosts } from '@/lib/services/post-visibility'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { GUEST_TIMELINE_LIMIT } from '@/lib/constants/guest'
import type { Post } from '@/types/post'

export type TimelineResult = {
  posts: Post[]
  nextCursor: string | undefined
  isGuest: boolean
}

/**
 * 認証済みユーザーのタイムラインを返す。
 * ゲストユーザー（isGuest）は公開投稿の直近 N 件のみ、nextCursor は undefined。
 * ブロック/ミュート/非表示/停止著者は除外する。
 */
export async function fetchTimeline(
  currentUserId: string,
  cursor?: string,
  limit?: number,
): Promise<TimelineResult> {
  const guestUserId = await getGuestUserId()
  const isGuest = currentUserId === guestUserId

  if (isGuest) {
    const rawPosts = await prisma.post.findMany({
      where: visiblePostWhere(),
      include: {
        ...POST_LIST_INCLUDE,
        quotePost: { include: POST_QUOTE_INCLUDE },
        repostPost: { include: POST_REPOST_INCLUDE },
        poll: { include: buildPostPollInclude() },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: GUEST_TIMELINE_LIMIT,
    })
    const posts = await redactNonVisibleNestedPosts(currentUserId, rawPosts)
    const { likedSet, bookmarkedSet } = await getPostInteractionSets(
      currentUserId,
      posts.map((p) => p.id),
    )
    return {
      posts: posts.map((post) => formatPostForClient(post, likedSet, bookmarkedSet)),
      nextCursor: undefined,
      isGuest: true,
    }
  }

  const relationSets = await getUserRelationSets(currentUserId)
  const hiddenPostIds = relationSets.hiddenPostIds
  const followingIds = [...relationSets.followingUserIds, currentUserId]

  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const rawPosts = await prisma.post.findMany({
    where: {
      isHidden: false,
      userId: { in: followingIds },
      user: {
        blockedBy: { none: { blockerId: currentUserId } },
        mutedBy: { none: { muterId: currentUserId } },
      },
      OR: [{ userId: currentUserId }, { user: { isSuspended: false } }],
      ...(hiddenPostIds.length > 0 ? { id: { notIn: hiddenPostIds } } : {}),
    },
    include: {
      ...POST_LIST_INCLUDE,
      quotePost: { include: POST_QUOTE_INCLUDE },
      repostPost: { include: POST_REPOST_INCLUDE },
      poll: { include: buildPostPollInclude() },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
  })

  const nextCursor = rawPosts.length === safeLimit ? rawPosts[rawPosts.length - 1]?.id : undefined

  const posts = await redactNonVisibleNestedPosts(currentUserId, rawPosts)

  const { likedSet, bookmarkedSet } = await getPostInteractionSets(
    currentUserId,
    posts.map((p) => p.id),
  )

  return {
    posts: posts.map((post) => formatPostForClient(post, likedSet, bookmarkedSet)),
    nextCursor,
    isGuest: false,
  }
}
