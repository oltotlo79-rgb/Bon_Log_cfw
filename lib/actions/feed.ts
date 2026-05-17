/**
 * フィード関連のServer Actions
 *
 * @module lib/actions/feed
 */

'use server'

import { prisma } from '@/lib/db'
import { getExcludedUserIds } from './filter-helper'
import { getPostInteractionSets, getUserRelationSets, getGuestUserId, actionSuccess, actionError } from '@/lib/actions/utils'
import {
  POST_LIST_INCLUDE,
  POST_QUOTE_INCLUDE,
  POST_REPOST_INCLUDE,
  buildPostPollInclude,
  formatPostForClient,
} from '@/lib/actions/post-include'
import { getCachedTrendingGenres } from '@/lib/cache'

import {
  DEFAULT_PAGE_LIMIT,
  RECOMMENDED_USERS_LIMIT,
  TRENDING_GENRES_LIMIT,
  MAX_RELATION_FETCH,
} from '@/lib/constants/limits'
import { GUEST_EMAIL, GUEST_TIMELINE_LIMIT } from '@/lib/constants/guest'
import { requireAuth } from '@/lib/actions/utils'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { ERR_RATE_LIMIT_OPERATION } from '@/lib/constants/errors'
import type { ActionResult } from '@/types/action-result'
import type { Post } from '@/types/post'

type TimelineData = {
  posts: Post[]
  nextCursor: string | undefined
  isGuest: boolean
}

/**
 * タイムライン（フィード）を取得
 *
 * ## 機能概要
 * フォロー中のユーザーと自分自身の投稿を
 * 新しい順で取得します。
 *
 * ## 表示対象
 * - フォロー中のユーザーの投稿
 * - 自分自身の投稿
 *
 * ## 除外対象
 * - ブロックしているユーザーの投稿
 * - ミュートしているユーザーの投稿
 *
 * ## 取得内容
 * - 投稿情報（ID、内容、作成日時など）
 * - 投稿者情報（ID、ニックネーム、アバター）
 * - メディア（画像・動画）
 * - ジャンル
 * - 引用投稿・リポストの情報
 * - いいね数・コメント数
 * - 現在のユーザーのいいね/ブックマーク状態
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns タイムライン投稿一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // フィードページ
 * const { posts, nextCursor } = await getTimeline()
 *
 * // 無限スクロールで追加読み込み
 * const more = await getTimeline(nextCursor)
 * ```
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

  const rl = await checkUserRateLimit(currentUserId, 'get_timeline')
  if (!rl.success) return actionError(ERR_RATE_LIMIT_OPERATION)

  // ゲストは全ユーザーの直近 N 件のみ表示（続きは新規登録を促す）
  if (isGuest) {
    const guestLimit = GUEST_TIMELINE_LIMIT
    const posts = await prisma.post.findMany({
      where: { isHidden: false },
      include: {
        ...POST_LIST_INCLUDE,
        quotePost: { include: POST_QUOTE_INCLUDE },
        repostPost: { include: POST_REPOST_INCLUDE },
        poll: { include: buildPostPollInclude() },
      },
      orderBy: { createdAt: 'desc' },
      take: guestLimit,
    })
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
  const [relationSets, excludeIds] = await Promise.all([
    getUserRelationSets(currentUserId),
    getExcludedUserIds(currentUserId, { blocked: true, muted: true }),
  ])

  const hiddenPostIds = relationSets.hiddenPostIds

  const followingIds = [...relationSets.followingUserIds]
  followingIds.push(currentUserId)

  const posts = await prisma.post.findMany({
    where: {
      isHidden: false,
      userId: {
        in: followingIds,
        notIn: excludeIds.length > 0 ? excludeIds : undefined,
      },
      ...(hiddenPostIds.length > 0 ? { id: { notIn: hiddenPostIds } } : {}),
    },
    include: {
      ...POST_LIST_INCLUDE,
      quotePost: { include: POST_QUOTE_INCLUDE },
      repostPost: { include: POST_REPOST_INCLUDE },
      poll: { include: buildPostPollInclude() },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const { likedSet: likedPostIds, bookmarkedSet: bookmarkedPostIds } = await getPostInteractionSets(
    currentUserId,
    posts.map((p) => p.id),
  )

  const formattedPosts = posts.map((post) => formatPostForClient(post, likedPostIds, bookmarkedPostIds))

  return actionSuccess({
    posts: formattedPosts,
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
    isGuest: false,
  })
}

/**
 * おすすめユーザーを取得する。
 *
 * フォロワー数降順で並べ、自分・既フォロー・双方向ブロック・非公開・ゲストを除外する。
 *
 * @param limit 取得件数（デフォルト: {@link RECOMMENDED_USERS_LIMIT}）
 */
export async function getRecommendedUsers(limit = RECOMMENDED_USERS_LIMIT) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { users: [] }

  const currentUserId = authResult.userId

  const rl = await checkUserRateLimit(currentUserId, 'get_recommended')
  if (!rl.success) return { users: [] }

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
      email: { not: GUEST_EMAIL }, // ゲストは表示しない（二重ガード）
    },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      bio: true,
      _count: {
        select: { followers: true },
      },
    },
    orderBy: {
      followers: { _count: 'desc' },
    },
    take: limit,
  })

  return {
    users: users.map((user) => ({
      ...user,
      followersCount: user._count.followers,
    })),
  }
}

/**
 * トレンドジャンルを取得
 *
 * ## 機能概要
 * 現在人気のあるジャンルを取得します。
 *
 * ## キャッシュ
 * getCachedTrendingGenres() を使用してキャッシュされた結果を返す
 *
 * キャッシュを使用する理由：
 * - トレンド計算は複雑なクエリが必要
 * - 頻繁に変わるものではない
 * - 同じ結果を全ユーザーに表示できる
 *
 * ## キャッシュの更新
 * lib/cache.ts の getCachedTrendingGenres() で設定された
 * 有効期限（revalidate）に従って自動更新
 *
 * @param limit - 取得件数（デフォルト: 5）
 * @returns トレンドジャンル一覧
 *
 * @example
 * ```typescript
 * // サイドバーの「トレンド」セクション
 * const trendingGenres = await getTrendingGenres(5)
 *
 * return (
 *   <div>
 *     <h3>トレンド</h3>
 *     {trendingGenres.map(genre => (
 *       <GenreTag key={genre.id} genre={genre} />
 *     ))}
 *   </div>
 * )
 * ```
 */
export async function getTrendingGenres(limit = TRENDING_GENRES_LIMIT) {
  return getCachedTrendingGenres(limit)
}
