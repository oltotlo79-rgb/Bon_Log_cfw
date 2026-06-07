/**
 * フィード関連のServer Actions
 *
 * @module lib/actions/feed
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { getExcludedUserIds } from './filter-helper'
import { normalizeCursorPagination, clampLimit } from './pagination'
import { getPostInteractionSets, getUserRelationSets, getGuestUserId, actionSuccess, actionError } from '@/lib/actions/utils'
import {
  POST_LIST_INCLUDE,
  POST_QUOTE_INCLUDE,
  POST_REPOST_INCLUDE,
  buildPostPollInclude,
  formatPostForClient,
} from '@/lib/actions/post-include'
import { getCachedTrendingGenres } from '@/lib/cache'
import { visiblePostWhere, redactNonVisibleNestedPosts } from '@/lib/services/post-visibility'

import {
  DEFAULT_PAGE_LIMIT,
  RECOMMENDED_USERS_LIMIT,
  TRENDING_GENRES_LIMIT,
  MAX_RELATION_FETCH,
} from '@/lib/constants/limits'
import { GUEST_EMAIL, GUEST_TIMELINE_LIMIT } from '@/lib/constants/guest'
import { requireAuth, enforceUserRateLimit } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'
import type { Post } from '@/types/post'

type TimelineData = {
  posts: Post[]
  nextCursor: string | undefined
  isGuest: boolean
}

/**
 * フォロー中ユーザー + 自分の投稿をカーソルベースで取得する。
 * ブロック/ミュート/非表示/停止著者は除外。ゲストは公開投稿の直近 N 件のみ。
 */
export async function getTimeline(
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<ActionResult<TimelineData>> {
  const authResult = await requireAuth()
  if ('error' in authResult) return actionError(authResult.error)
  const currentUserId = authResult.userId

  const guestUserId = await getGuestUserId()
  const isGuest = currentUserId === guestUserId

  const rl = await enforceUserRateLimit(currentUserId, 'get_timeline')
  if (rl) return actionError(rl.error)

  // ゲストは全ユーザーの直近 N 件のみ表示（続きは新規登録を促す）。
  // 公開面のため非公開/停止著者・非表示投稿は除外する。
  if (isGuest) {
    const guestLimit = GUEST_TIMELINE_LIMIT
    const rawPosts = await prisma.post.findMany({
      where: visiblePostWhere(),
      include: {
        ...POST_LIST_INCLUDE,
        quotePost: { include: POST_QUOTE_INCLUDE },
        repostPost: { include: POST_REPOST_INCLUDE },
        poll: { include: buildPostPollInclude() },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: guestLimit,
    })
    const posts = await redactNonVisibleNestedPosts(currentUserId, rawPosts)
    const { likedSet: likedPostIds, bookmarkedSet: bookmarkedPostIds } = await getPostInteractionSets(
      currentUserId,
      posts.map((p) => p.id),
    )
    const formattedPosts = posts.map((post) => formatPostForClient(post, likedPostIds, bookmarkedPostIds))
    return actionSuccess({
      posts: formattedPosts,
      nextCursor: undefined,
      isGuest: true,
    })
  }

  // getUserRelationSets はRedisキャッシュ（5分TTL）＋React cache() でメモ化済み。
  const relationSets = await getUserRelationSets(currentUserId)

  const hiddenPostIds = relationSets.hiddenPostIds

  const followingIds = [...relationSets.followingUserIds]
  followingIds.push(currentUserId)

  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const rawPosts = await prisma.post.findMany({
    where: {
      isHidden: false,
      userId: { in: followingIds },
      // ブロック/ミュートは大配列 notIn ではなく relational filter で除外する。
      // 安全性に関わる除外を MAX_RELATION_FETCH 上限による silent truncation から守るため、
      // 取得した ID 配列ではなく DB 側の NOT EXISTS 相当で評価する
      // （Block: blocker_id / Mute: muter_id は索引済み）。自分自身はブロック/ミュート不可のため自投稿は通過する。
      user: {
        blockedBy: { none: { blockerId: currentUserId } },
        mutedBy: { none: { muterId: currentUserId } },
      },
      // フォロー後に停止された著者の投稿は除外する。ただし自分の投稿は停止中でも表示する。
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
    ...(safeCursor && {
      cursor: { id: safeCursor },
      skip: 1,
    }),
  })

  // nextCursor は redact 前の生取得結果（ページ境界）から決める。
  // 不可視ネストの除外で行が減ってもページングは生 id で前進させる。
  const nextCursor = rawPosts.length === safeLimit ? rawPosts[rawPosts.length - 1]?.id : undefined

  const posts = await redactNonVisibleNestedPosts(currentUserId, rawPosts)

  const { likedSet: likedPostIds, bookmarkedSet: bookmarkedPostIds } = await getPostInteractionSets(
    currentUserId,
    posts.map((p) => p.id),
  )

  const formattedPosts = posts.map((post) => formatPostForClient(post, likedPostIds, bookmarkedPostIds))

  return actionSuccess({
    posts: formattedPosts,
    nextCursor,
    isGuest: false,
  })
}

/**
 * おすすめユーザーを取得する。
 *
 * フォロワー数降順で並べ、自分・既フォロー・双方向ブロック・非公開・停止・ゲストを除外する。
 *
 * @param limit 取得件数（デフォルト: {@link RECOMMENDED_USERS_LIMIT}）
 */
export async function getRecommendedUsers(limit = RECOMMENDED_USERS_LIMIT) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { users: [] }

  const currentUserId = authResult.userId

  const rl = await enforceUserRateLimit(currentUserId, 'get_recommended')
  if (rl) return { users: [] }

  const [following, blockedIds] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
      take: MAX_RELATION_FETCH,
    }),
    getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true }),
  ])

  const followingIds = following.map((f) => f.followingId)
  followingIds.push(currentUserId)

  // ゲストユーザーはおすすめに表示しない
  // getGuestUserId は unstable_cache（1時間TTL）でキャッシュ済み（P-5）
  const guestUserId = await getGuestUserId()
  const excludeIds = [...followingIds, ...blockedIds, ...(guestUserId ? [guestUserId] : [])]

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: excludeIds },
      isPublic: true,
      isSuspended: false, // 停止ユーザーは検索/RSS と同様におすすめからも除外する
      email: { not: GUEST_EMAIL }, // ゲストは表示しない（二重ガード）
    },
    select: {
      ...USER_MINIMAL_WITH_BIO_SELECT,
      _count: {
        select: { followers: true },
      },
    },
    orderBy: {
      followers: { _count: 'desc' },
    },
    take: clampLimit(limit),
  })

  return {
    users: users.map((user) => ({
      ...user,
      followersCount: user._count.followers,
    })),
  }
}

/**
 * トレンドジャンルを取得する。全ユーザー共通の結果のため
 * {@link getCachedTrendingGenres} でキャッシュ済みの値を返す。
 */
export async function getTrendingGenres(limit = TRENDING_GENRES_LIMIT) {
  return getCachedTrendingGenres(limit)
}
