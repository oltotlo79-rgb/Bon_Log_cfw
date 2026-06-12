/**
 * フィード関連のServer Actions
 *
 * @module lib/actions/feed
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { getExcludedUserIds } from './filter-helper'
import { clampLimit } from './pagination'
import { getGuestUserId, actionSuccess, actionError } from '@/lib/actions/utils'
import { getCachedTrendingGenres } from '@/lib/cache'
import { fetchTimeline } from '@/lib/services/feed-service'

import {
  DEFAULT_PAGE_LIMIT,
  RECOMMENDED_USERS_LIMIT,
  TRENDING_GENRES_LIMIT,
  MAX_RELATION_FETCH,
} from '@/lib/constants/limits'
import { GUEST_EMAIL } from '@/lib/constants/guest'
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

  const rl = await enforceUserRateLimit(currentUserId, 'get_timeline')
  if (rl) return actionError(rl.error)

  const result = await fetchTimeline(currentUserId, cursor, limit)
  return actionSuccess(result)
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
