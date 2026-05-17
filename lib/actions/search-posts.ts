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
import { fulltextSearchPosts, getSearchMode } from '@/lib/search/fulltext'
import { getExcludedUserIds } from './filter-helper'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getClientIp, getPostInteractionSets, actionSuccess, actionError } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'
import { DEFAULT_PAGE_LIMIT, MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants/limits'
import { ERR_SEARCH_QUERY_TOO_LONG, ERR_SEARCH_RATE_LIMIT, ERR_OPERATION_FAILED } from '@/lib/constants/errors'
import { getEndOfDay } from '@/lib/utils'
import { POST_LIST_INCLUDE, formatPostForClient } from './post-include'
import { preserveOrder } from '@/lib/utils/preserve-order'
import type { Post } from '@/types/post'
import { containsInsensitive } from '@/lib/actions/prisma-filters'

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

    const excludedUserIds = currentUserId
      ? await getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true, muted: true })
      : []

    const searchMode = getSearchMode()

    const postInclude = {
      ...POST_LIST_INCLUDE,
      poll: {
        include: {
          options: {
            orderBy: { sortOrder: 'asc' as const },
            include: { _count: { select: { votes: true } } },
          },
          _count: { select: { votes: true } },
        },
      },
    } as const

    // 全文検索モード（bigm/trgm）: IDを取得してから詳細取得
    if (query && (searchMode === 'bigm' || searchMode === 'trgm')) {
      const postIds = await fulltextSearchPosts(query, {
        excludedUserIds,
        genreIds,
        cursor,
        limit,
        filters,
      })

      if (postIds.length === 0) {
        return actionSuccess({ posts: [], nextCursor: undefined })
      }

      const fetchedPosts = await prisma.post.findMany({
        where: { id: { in: postIds } },
        include: postInclude,
      })

      const posts = preserveOrder(postIds, fetchedPosts)

      const { likedSet, bookmarkedSet } = currentUserId
        ? await getPostInteractionSets(currentUserId, posts.map((p: typeof posts[number]) => p.id))
        : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

      const formattedPosts = posts.map((post: typeof posts[number]) =>
        formatPostForClient(post, likedSet, bookmarkedSet),
      )

      return actionSuccess({
        posts: formattedPosts,
        nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
      })
    }

    // LIKE検索モード
    const filterConditions: Record<string, unknown>[] = []
    if (filters?.dateFrom) {
      filterConditions.push({ createdAt: { gte: new Date(filters.dateFrom) } })
    }
    if (filters?.dateTo) {
      const dateTo = getEndOfDay(new Date(filters.dateTo))
      filterConditions.push({ createdAt: { lte: dateTo } })
    }
    if (filters?.mediaType === 'images') {
      filterConditions.push({ media: { some: { type: 'image' } } })
    } else if (filters?.mediaType === 'videos') {
      filterConditions.push({ media: { some: { type: 'video' } } })
    } else if (filters?.mediaType === 'text') {
      filterConditions.push({ media: { none: {} } })
    }

    let minLikesPostIds: string[] | undefined
    if (filters?.minLikes && filters.minLikes > 0) {
      const likesResult = await prisma.like.groupBy({
        by: ['postId'],
        where: { commentId: null },
        _count: { postId: true },
        having: { postId: { _count: { gte: filters.minLikes } } },
      })
      minLikesPostIds = likesResult
        .map((r) => r.postId)
        .filter((id): id is string => id !== null)
    }

    const posts = await prisma.post.findMany({
      where: {
        isHidden: false,
        ...(minLikesPostIds ? { id: { in: minLikesPostIds } } : {}),
        AND: [
          query ? { content: containsInsensitive(query) } : {},
          genreIds && genreIds.length > 0
            ? { genres: { some: { genreId: { in: genreIds } } } }
            : {},
          excludedUserIds.length > 0 ? { userId: { notIn: excludedUserIds } } : {},
          ...filterConditions,
        ],
      },
      include: postInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    })

    const { likedSet, bookmarkedSet } = currentUserId
      ? await getPostInteractionSets(currentUserId, posts.map((p: typeof posts[number]) => p.id))
      : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

    const formattedPosts = posts.map((post: typeof posts[number]) =>
      formatPostForClient(post, likedSet, bookmarkedSet),
    )

    return actionSuccess({
      posts: formattedPosts,
      nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
    })
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

    const excludedUserIds = currentUserId
      ? await getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true, muted: true })
      : []

    const posts = await prisma.post.findMany({
      where: {
        isHidden: false,
        AND: [
          { content: { contains: `#${tag}` } },
          excludedUserIds.length > 0 ? { userId: { notIn: excludedUserIds } } : {},
        ],
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
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
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
      nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
    })
  } catch (error) {
    logger.error('searchByTag failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
