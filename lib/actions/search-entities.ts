/**
 * エンティティ検索のServer Actions
 *
 * このファイルは、盆栽園・イベント・盆栽・グローバル検索に関する
 * サーバーサイドの処理を提供します。
 *
 * Note: Returns custom shapes (shops/events/bonsais + nextCursor) instead of ActionResult
 * because callers depend on these specific data fields.
 *
 * @module lib/actions/search-entities
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION, GENRE_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { auth } from '@/lib/auth'
import {
  fulltextSearchShops,
  fulltextSearchEvents,
  fulltextSearchBonsais,
  fulltextSearchGlobal,
  getSearchMode,
} from '@/lib/search/fulltext'
import { getExcludedUserIds } from './filter-helper'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getClientIp, getGuestUserId } from '@/lib/actions/utils'
import { DEFAULT_PAGE_LIMIT, GLOBAL_SEARCH_PER_CATEGORY_LIMIT, MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants/limits'
import { ERR_SEARCH_QUERY_TOO_LONG, ERR_SEARCH_RATE_LIMIT } from '@/lib/constants/errors'
import { preserveOrder } from '@/lib/utils/preserve-order'
import { containsInsensitive } from '@/lib/actions/prisma-filters'

/**
 * 盆栽園を検索
 *
 * ## 機能概要
 * キーワードで盆栽園を検索します。
 *
 * ## 検索対象
 * - 盆栽園名（name）
 * - 住所（address）
 *
 * @param query - 検索キーワード
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @param prefecture - 都道府県フィルタ（オプション）
 * @returns 検索結果の盆栽園一覧と次のカーソル
 */
export async function searchShops(
  query: string,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  prefecture?: string
) {
  if (query && query.length > MAX_SEARCH_QUERY_LENGTH) {
    return { shops: [], nextCursor: undefined, error: ERR_SEARCH_QUERY_TOO_LONG }
  }

  const clientIp = await getClientIp()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) {
    return { shops: [], nextCursor: undefined, error: ERR_SEARCH_RATE_LIMIT }
  }

  const searchMode = getSearchMode()

  // 全文検索モード
  if (query && (searchMode === 'bigm' || searchMode === 'trgm')) {
    const shopIds = await fulltextSearchShops(query, { cursor, limit, prefecture })

    if (shopIds.length === 0) {
      return { shops: [], nextCursor: undefined }
    }

    const fetchedShops = await prisma.bonsaiShop.findMany({
      where: { id: { in: shopIds } },
      include: SEARCH_SHOP_INCLUDE,
    })

    // 元の順序を維持
    const shops = preserveOrder(shopIds, fetchedShops)
    const shopsWithRating = await enrichShopsWithRatings(shops)

    return {
      shops: shopsWithRating,
      nextCursor: shops.length === limit ? shops[shops.length - 1]?.id : undefined,
    }
  }

  // LIKE検索
  const shops = await prisma.bonsaiShop.findMany({
    where: {
      isHidden: false,
      AND: [
        query
          ? {
              OR: [
                { name: containsInsensitive(query) },
                { address: containsInsensitive(query) },
              ],
            }
          : {},
        prefecture ? { address: { contains: prefecture } } : {},
      ],
    },
    include: SEARCH_SHOP_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  })

  const shopsWithRating = await enrichShopsWithRatings(shops)

  return {
    shops: shopsWithRating,
    nextCursor: shops.length === limit ? shops[shops.length - 1]?.id : undefined,
  }
}

/**
 * `searchShops` の全文検索 / LIKE 両パスで共通の include。
 */
const SEARCH_SHOP_INCLUDE = {
  genres: { select: { genre: { select: GENRE_MINIMAL_SELECT } } },
  _count: { select: { reviews: true } },
} as const

/**
 * 盆栽園リストに平均評価とジャンル展開を付与する。
 *
 * `shopReview.groupBy({ _avg: rating })` で N+1 を回避しつつ、
 * `_count.reviews` → `reviewCount`、`genres[i].genre` → 平坦化を一度の map で済ませる。
 * 全文検索パスと LIKE パスで重複していたロジックを一箇所に集約。
 */
async function enrichShopsWithRatings<
  T extends {
    id: string
    _count: { reviews: number }
    genres: { genre: { id: string; name: string; category: string } }[]
  },
>(shops: readonly T[]) {
  if (shops.length === 0) return [] as Array<Omit<T, '_count' | 'genres'> & {
    reviewCount: number
    avgRating: number
    genres: T['genres'][number]['genre'][]
  }>

  const shopIdList = shops.map((s) => s.id)
  const avgRatings = await prisma.shopReview.groupBy({
    by: ['shopId'],
    where: { shopId: { in: shopIdList }, isHidden: false },
    _avg: { rating: true },
  })
  const ratingMap = new Map(avgRatings.map((r) => [r.shopId, r._avg.rating ?? 0]))

  return shops.map((shop) => ({
    ...shop,
    reviewCount: shop._count.reviews,
    avgRating: ratingMap.get(shop.id) ?? 0,
    genres: shop.genres.map((sg) => sg.genre),
  }))
}

/**
 * イベントを検索
 *
 * ## 機能概要
 * キーワードでイベントを検索します。
 *
 * ## 検索対象
 * - タイトル（title）
 * - 説明（description）
 *
 * @param query - 検索キーワード
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @param options - 追加オプション
 * @returns 検索結果のイベント一覧と次のカーソル
 */
export async function searchEvents(
  query: string,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  options?: {
    prefecture?: string
    includeExpired?: boolean
  }
) {
  if (query && query.length > MAX_SEARCH_QUERY_LENGTH) {
    return { events: [], nextCursor: undefined, error: ERR_SEARCH_QUERY_TOO_LONG }
  }

  const clientIp = await getClientIp()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) {
    return { events: [], nextCursor: undefined, error: ERR_SEARCH_RATE_LIMIT }
  }

  const searchMode = getSearchMode()
  const now = new Date()
  const { prefecture, includeExpired = false } = options || {}

  // 全文検索モード
  if (query && (searchMode === 'bigm' || searchMode === 'trgm')) {
    const eventIds = await fulltextSearchEvents(query, { cursor, limit, prefecture, includeExpired })

    if (eventIds.length === 0) {
      return { events: [], nextCursor: undefined }
    }

    const fetchedEvents = await prisma.event.findMany({
      where: { id: { in: eventIds } },
      include: {
        creator: USER_MINIMAL_RELATION,
      },
    })

    // 元の順序を維持
    const events = preserveOrder(eventIds, fetchedEvents)

    return {
      events,
      nextCursor: events.length === limit ? events[events.length - 1]?.id : undefined,
    }
  }

  // LIKE検索
  const events = await prisma.event.findMany({
    where: {
      isHidden: false,
      AND: [
        !includeExpired
          ? {
              OR: [
                { endDate: { gte: now } },
                { AND: [{ endDate: null }, { startDate: { gte: now } }] },
              ],
            }
          : {},
        query
          ? {
              OR: [
                { title: containsInsensitive(query) },
                { description: containsInsensitive(query) },
              ],
            }
          : {},
        prefecture ? { prefecture } : {},
      ],
    },
    include: {
      creator: USER_MINIMAL_RELATION,
    },
    orderBy: { startDate: 'asc' },
    take: limit,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  })

  return {
    events,
    nextCursor: events.length === limit ? events[events.length - 1]?.id : undefined,
  }
}

/**
 * 盆栽を検索
 *
 * ## 機能概要
 * キーワードで盆栽を検索します。
 *
 * ## 検索対象
 * - 名前（name）
 * - 樹種（species）
 * - 説明（description）
 *
 * @param query - 検索キーワード
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @param userId - 特定ユーザーの盆栽のみ検索（オプション）
 * @returns 検索結果の盆栽一覧と次のカーソル
 */
export async function searchBonsais(
  query: string,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  userId?: string
) {
  if (query && query.length > MAX_SEARCH_QUERY_LENGTH) {
    return { bonsais: [], nextCursor: undefined, error: ERR_SEARCH_QUERY_TOO_LONG }
  }

  const clientIp = await getClientIp()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) {
    return { bonsais: [], nextCursor: undefined, error: ERR_SEARCH_RATE_LIMIT }
  }

  const searchMode = getSearchMode()

  // 全文検索モード
  if (query && (searchMode === 'bigm' || searchMode === 'trgm')) {
    const bonsaiIds = await fulltextSearchBonsais(query, { userId, cursor, limit })

    if (bonsaiIds.length === 0) {
      return { bonsais: [], nextCursor: undefined }
    }

    const fetchedBonsais = await prisma.bonsai.findMany({
      where: { id: { in: bonsaiIds } },
      include: {
        user: USER_MINIMAL_RELATION,
        _count: { select: { records: true, posts: true } },
      },
    })

    // 元の順序を維持
    const bonsais = preserveOrder(bonsaiIds, fetchedBonsais)

    return {
      bonsais: bonsais.map((b: typeof bonsais[number]) => ({
        ...b,
        recordCount: b._count.records,
        postCount: b._count.posts,
      })),
      nextCursor: bonsais.length === limit ? bonsais[bonsais.length - 1]?.id : undefined,
    }
  }

  // LIKE検索
  const bonsais = await prisma.bonsai.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                { name: containsInsensitive(query) },
                { species: containsInsensitive(query) },
                { description: containsInsensitive(query) },
              ],
            }
          : {},
        userId ? { userId } : {},
      ],
    },
    include: {
      user: USER_MINIMAL_RELATION,
      _count: { select: { records: true, posts: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  })

  return {
    bonsais: bonsais.map((b: typeof bonsais[number]) => ({
      ...b,
      recordCount: b._count.records,
      postCount: b._count.posts,
    })),
    nextCursor: bonsais.length === limit ? bonsais[bonsais.length - 1]?.id : undefined,
  }
}

/**
 * 複数エンティティを横断して検索
 *
 * ## 機能概要
 * 投稿、ユーザー、盆栽園、イベント、盆栽を一括で検索します。
 * 各カテゴリから上位5件ずつを返します。
 *
 * @param query - 検索キーワード
 * @returns 各カテゴリの検索結果
 */
export async function searchGlobal(query: string) {
  if (query && query.length > MAX_SEARCH_QUERY_LENGTH) {
    return { error: ERR_SEARCH_QUERY_TOO_LONG }
  }

  const clientIp = await getClientIp()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) {
    return { error: ERR_SEARCH_RATE_LIMIT }
  }

  const session = await auth()
  const currentUserId = session?.user?.id

  const excludedUserIds = currentUserId
    ? await getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true, muted: true })
    : []

  // ゲストユーザーはグローバル検索のユーザー結果に表示しない
  // getGuestUserId は unstable_cache（1時間TTL）でキャッシュ済み（P-5）
  const guestUserId = await getGuestUserId()
  const excludedUserIdsWithGuest = [...excludedUserIds, ...(guestUserId ? [guestUserId] : [])]

  const { postIds, userIds, shopIds, eventIds, bonsaiIds } = await fulltextSearchGlobal(query, {
    excludedUserIds: excludedUserIdsWithGuest,
    currentUserId,
    limit: GLOBAL_SEARCH_PER_CATEGORY_LIMIT,
  })

  // 並列で各エンティティを取得
  const [posts, users, shops, events, bonsais] = await Promise.all([
    postIds.length > 0
      ? prisma.post.findMany({
          where: { id: { in: postIds } },
          include: {
            user: USER_MINIMAL_RELATION,
            media: { orderBy: { sortOrder: 'asc' }, take: 1 },
            _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
          },
        })
      : [],
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            bio: true,
            _count: { select: { followers: true } },
          },
        })
      : [],
    shopIds.length > 0
      ? prisma.bonsaiShop.findMany({
          where: { id: { in: shopIds } },
          select: {
            id: true,
            name: true,
            address: true,
            _count: { select: { reviews: true } },
          },
        })
      : [],
    eventIds.length > 0
      ? prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            prefecture: true,
            venue: true,
          },
        })
      : [],
    bonsaiIds.length > 0
      ? prisma.bonsai.findMany({
          where: { id: { in: bonsaiIds } },
          select: {
            id: true,
            name: true,
            species: true,
            user: { select: { id: true, nickname: true } },
          },
        })
      : [],
  ])

  // 元の順序を維持（Map による O(n) ルックアップ）
  const orderedPosts = preserveOrder(postIds, posts)
  const orderedUsers = preserveOrder(userIds, users)
  const orderedShops = preserveOrder(shopIds, shops)
  const orderedEvents = preserveOrder(eventIds, events)
  const orderedBonsais = preserveOrder(bonsaiIds, bonsais)

  return {
    posts: orderedPosts.map((post) => ({
      ...post,
      likeCount: post?._count?.likes ?? 0,
      commentCount: post?._count?.comments ?? 0,
    })),
    users: orderedUsers.map((user) => ({
      ...user,
      followersCount: user?._count?.followers ?? 0,
    })),
    shops: orderedShops.map((shop) => ({
      ...shop,
      reviewCount: shop?._count?.reviews ?? 0,
    })),
    events: orderedEvents,
    bonsais: orderedBonsais,
  }
}
