/**
 * 投稿検索・ハッシュタグ検索のServer Actions
 *
 * @module lib/actions/search-posts
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION, GENRE_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { auth } from '@/lib/auth'
import logger from '@/lib/logger'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getClientIp, getPostInteractionSets, actionSuccess, actionError } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'
import { DEFAULT_PAGE_LIMIT, MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants/limits'
import { ERR_SEARCH_QUERY_TOO_LONG, ERR_SEARCH_RATE_LIMIT, ERR_OPERATION_FAILED } from '@/lib/constants/errors'
import { fetchSearchPosts } from '@/lib/services/search-service'
import { getExcludedUserIds } from './filter-helper'
import type { Post } from '@/types/post'
import { visibleAuthorFilter } from '@/lib/services/post-visibility'
import { normalizeCursorPagination } from './pagination'

/**
 * 投稿を検索（キーワード + ジャンル + 追加フィルター）。
 * 検索モード（bigm/trgm/like）は環境によって自動選択される。
 *
 * 戻り値の posts は `formatPostForClient` で整形済みのため、
 * クライアント側の {@link Post} 型にそのまま割り当てられる。
 */
type SearchPostsData = { posts: Post[]; nextCursor: string | undefined }

export async function searchPosts(
  query: string,
  genreIds?: string[],
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  filters?: {
    dateFrom?: string
    dateTo?: string
    minLikes?: number
    mediaType?: 'images' | 'videos' | 'text'
  }
): Promise<ActionResult<SearchPostsData>> {
  if (query && query.length > MAX_SEARCH_QUERY_LENGTH) return actionError(ERR_SEARCH_QUERY_TOO_LONG)

  const clientIp = await getClientIp()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) return actionError(ERR_SEARCH_RATE_LIMIT)

  try {
    const session = await auth()
    const currentUserId = session?.user?.id

    const result = await fetchSearchPosts(query, currentUserId, genreIds, cursor, limit, filters)
    return actionSuccess(result)
  } catch (error) {
    logger.error('searchPosts failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * ハッシュタグで投稿を検索（`#${tag}` を含む投稿）。
 */
export async function searchByTag(
  tag: string,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<ActionResult<SearchPostsData>> {
  if (tag && tag.length > MAX_SEARCH_QUERY_LENGTH) return actionError(ERR_SEARCH_QUERY_TOO_LONG)

  const clientIp = await getClientIp()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) return actionError(ERR_SEARCH_RATE_LIMIT)

  try {
    const session = await auth()
    const currentUserId = session?.user?.id

    // クライアント境界から渡される cursor/limit を MAX_PAGE_LIMIT で clamp し DB 過負荷を防ぐ
    const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

    const excludedUserIds = currentUserId
      ? await getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true, muted: true })
      : []

    // Why Hashtag JOIN: 旧実装は `content: { contains: '#tag' }` の LIKE 全文走査だった。
    // 投稿数が増えるとフルテーブルスキャンになる。`PostHashtag` 中間テーブルと
    // `Hashtag.name @unique` インデックスを使い O(log n) で関連投稿を引く。
    const normalizedTag = tag.toLowerCase()
    const posts = await prisma.post.findMany({
      where: {
        isHidden: false,
        user: visibleAuthorFilter(currentUserId),
        hashtags: { some: { hashtag: { name: normalizedTag } } },
        ...(excludedUserIds.length > 0 ? { userId: { notIn: excludedUserIds } } : {}),
      },
      include: {
        user: USER_MINIMAL_RELATION,
        media: { orderBy: { sortOrder: 'asc' } },
        genres: { select: { genre: { select: GENRE_MINIMAL_SELECT } } },
        _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
        poll: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
              include: { _count: { select: { votes: true } } },
            },
            _count: { select: { votes: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
    })

    const { likedSet, bookmarkedSet } = currentUserId
      ? await getPostInteractionSets(currentUserId, posts.map((p: typeof posts[number]) => p.id))
      : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

    return actionSuccess({
      posts: posts.map((post: typeof posts[number]) => ({
        ...post,
        likeCount: post._count.likes,
        commentCount: post._count.comments,
        genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
        isLiked: likedSet.has(post.id),
        isBookmarked: bookmarkedSet.has(post.id),
      })),
      nextCursor: posts.length === safeLimit ? posts[posts.length - 1]?.id : undefined,
    })
  } catch (error) {
    logger.error('searchByTag failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
