/**
 * @module lib/services/explore-service
 * モバイル API v1 向け Explore（発見）セクションのデータ取得ロジック。
 *
 * Web の getTrendingHashtags（lib/actions/hashtag.ts）、getTrendingGenres / getRecommendedUsers
 * （lib/actions/feed.ts）は 'use server' に閉じているため直接 import できない。
 * 本サービスは同等のロジックを忠実に再現し、v1 route handler から呼び出す。
 *
 * キャッシュ:
 * - trending genres は Web と同じ getCachedTrendingGenres（unstable_cache）を再利用する。
 * - trending hashtags は Hashtag テーブルから直接取得（Web Action と同等）。
 * - recommended users は認証ユーザー依存のため都度 DB 取得（キャッシュ不可）。
 *
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { getCachedTrendingGenres } from '@/lib/cache'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { getExcludedUserIds } from '@/lib/actions/filter-helper'
import { clampLimit } from '@/lib/actions/pagination'
import { getGuestUserId } from '@/lib/actions/utils'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import {
  MAX_RELATION_FETCH,
  EXPLORE_TRENDING_HASHTAGS_LIMIT,
  EXPLORE_TRENDING_GENRES_LIMIT,
  EXPLORE_RECOMMENDED_USERS_LIMIT,
} from '@/lib/constants/limits'

/** トレンドハッシュタグの 1 件 */
export type TrendingHashtagItem = {
  id: string
  name: string
  count: number
}

/** トレンドジャンルの 1 件（postCount を含む） */
export type TrendingGenreItem = {
  id: string
  name: string
  category: string
  postCount: number
}

/** おすすめユーザーの 1 件（followersCount のみ、フォロー状態は route 層で付与） */
export type RecommendedUserItem = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  followersCount: number
}

/**
 * トレンドハッシュタグを count 降順で取得する（Hashtag.count フィールドから直接集計）。
 *
 * Web の getTrendingHashtags と同じロジック。shouldSkipBuildTimeDbAccess は
 * route handler 実行時には常に false なので省略してよい。
 */
export async function fetchTrendingHashtags(
  limit: number = EXPLORE_TRENDING_HASHTAGS_LIMIT,
): Promise<TrendingHashtagItem[]> {
  const safeLimit = clampLimit(limit, EXPLORE_TRENDING_HASHTAGS_LIMIT)

  const hashtags = await prisma.hashtag.findMany({
    where: { count: { gt: 0 } },
    orderBy: { count: 'desc' },
    take: safeLimit,
    select: { id: true, name: true, count: true },
  })

  return hashtags
}

/**
 * トレンドジャンルを postCount 降順で取得する。
 *
 * Web の getCachedTrendingGenres を再利用（unstable_cache 済み）。
 * キャッシュ戻り値の genres 配列には postCount が含まれている。
 */
export async function fetchTrendingGenres(
  limit: number = EXPLORE_TRENDING_GENRES_LIMIT,
): Promise<TrendingGenreItem[]> {
  const safeLimit = clampLimit(limit, EXPLORE_TRENDING_GENRES_LIMIT)
  const result = await getCachedTrendingGenres(safeLimit)
  return result.genres
}

/**
 * おすすめユーザーをフォロワー数降順で返す。
 *
 * Web の getRecommendedUsers と同じ除外ロジック:
 * - 自分自身
 * - 既フォロー中
 * - 双方向ブロック
 * - 非公開アカウント
 * - 停止ユーザー
 * - ゲストユーザー
 *
 * フォロー状態（following / requested）は route 層で followStateResolver が付与する。
 *
 * @param userId  閲覧者のユーザー ID。ゲストは null / undefined を渡してよい。
 */
export async function fetchRecommendedUsers(
  userId: string | null | undefined,
  limit: number = EXPLORE_RECOMMENDED_USERS_LIMIT,
): Promise<RecommendedUserItem[]> {
  const safeLimit = clampLimit(limit, EXPLORE_RECOMMENDED_USERS_LIMIT)

  if (!userId) {
    // 未認証・ゲストは空配列（フォロー状態が計算できないため）
    return []
  }

  const [following, blockedIds, guestUserId] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: MAX_RELATION_FETCH,
    }),
    getExcludedUserIds(userId, { blocked: true, blockedBy: true }),
    getGuestUserId(),
  ])

  const followingIds = following.map((f) => f.followingId)
  const excludeIds = [
    userId,
    ...followingIds,
    ...blockedIds,
    ...(guestUserId ? [guestUserId] : []),
  ]

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: excludeIds },
      isPublic: true,
      isSuspended: false,
      email: { not: GUEST_EMAIL },
    },
    select: {
      ...USER_MINIMAL_WITH_BIO_SELECT,
      _count: { select: { followers: true } },
    },
    orderBy: { followers: { _count: 'desc' } },
    take: safeLimit,
  })

  return users.map((u) => ({
    ...u,
    followersCount: u._count.followers,
  }))
}
