/**
 * @module lib/services/search-service
 * 投稿・ユーザー検索のクエリ・整形ロジック。
 *
 * lib/actions/search-posts.ts / search-users.ts と
 * app/api/v1/search/* の双方から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { fulltextSearchPosts, fulltextSearchUsers, getSearchMode } from '@/lib/search/fulltext'
import { getExcludedUserIds } from '@/lib/actions/filter-helper'
import { getPostInteractionSets } from '@/lib/actions/utils'
import { POST_LIST_INCLUDE, formatPostForClient } from '@/lib/actions/post-include'
import { preserveOrder } from '@/lib/utils/preserve-order'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { containsInsensitive } from '@/lib/actions/prisma-filters'
import { visibleAuthorFilter, visibleUserWhere } from '@/lib/services/post-visibility'
import { getEndOfDay } from '@/lib/utils'
import { getGuestUserId } from '@/lib/actions/utils'
import type { Post } from '@/types/post'

export type SearchPostsResult = {
  posts: Post[]
  nextCursor: string | undefined
}

export type SearchUserResult = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  followingCount: number
}

export type SearchUsersResult = {
  users: SearchUserResult[]
  nextCursor: string | undefined
}

export type SearchPostFilters = {
  dateFrom?: string
  dateTo?: string
  minLikes?: number
  mediaType?: 'images' | 'videos' | 'text'
}

/**
 * 投稿をキーワードで検索する。
 * ブロック・ミュート・非公開著者・停止著者は除外する（Web と同一フィルタ）。
 */
export async function fetchSearchPosts(
  query: string,
  viewerId: string | undefined,
  genreIds?: string[],
  cursor?: string,
  limit?: number,
  filters?: SearchPostFilters,
): Promise<SearchPostsResult> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const excludedUserIds = viewerId
    ? await getExcludedUserIds(viewerId, { blocked: true, blockedBy: true, muted: true })
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

  if (query && (searchMode === 'bigm' || searchMode === 'trgm')) {
    const postIds = await fulltextSearchPosts(query, {
      excludedUserIds,
      genreIds,
      cursor: safeCursor,
      limit: safeLimit,
      viewerId,
      filters,
    })

    if (postIds.length === 0) {
      return { posts: [], nextCursor: undefined }
    }

    const fetchedPosts = await prisma.post.findMany({
      where: { id: { in: postIds }, isHidden: false, user: visibleAuthorFilter(viewerId) },
      include: postInclude,
    })

    const posts = preserveOrder(postIds, fetchedPosts)

    const { likedSet, bookmarkedSet } = viewerId
      ? await getPostInteractionSets(viewerId, posts.map((p) => p.id))
      : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

    // trgm は類似度順で keyset pagination が成立しないため cursor を発行しない
    // （発行すると次ページ要求で常に同じ1ページ目が返り無限ループする）。
    return {
      posts: posts.map((post) => formatPostForClient(post, likedSet, bookmarkedSet)),
      nextCursor:
        searchMode === 'trgm'
          ? undefined
          : posts.length === safeLimit
            ? posts[posts.length - 1]?.id
            : undefined,
    }
  }

  // LIKE 検索モード
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

  // Why groupBy: Prisma `where` で `_count` 比較ができないため likes を集計してから
  // post.id を絞る。LIKE 検索モードでのみ通る経路（bigm/trgm は raw SQL で処理）。
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
      user: visibleAuthorFilter(viewerId),
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
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
  })

  const { likedSet, bookmarkedSet } = viewerId
    ? await getPostInteractionSets(viewerId, posts.map((p) => p.id))
    : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

  return {
    posts: posts.map((post) => formatPostForClient(post, likedSet, bookmarkedSet)),
    nextCursor: posts.length === safeLimit ? posts[posts.length - 1]?.id : undefined,
  }
}

/**
 * ユーザーをキーワードで検索する（nickname / bio を対象）。
 * ブロック・ゲスト・自分自身を除外する（ミュートは除外しない）。
 */
export async function fetchSearchUsers(
  query: string,
  viewerId: string | undefined,
  cursor?: string,
  limit?: number,
): Promise<SearchUsersResult> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const excludedUserIds = viewerId
    ? await getExcludedUserIds(viewerId, { blocked: true, blockedBy: true })
    : []

  const guestUserId = await getGuestUserId()
  const excludedUserIdsWithGuest = [...excludedUserIds, ...(guestUserId ? [guestUserId] : [])]

  const searchMode = getSearchMode()

  const userSelect = {
    ...USER_MINIMAL_WITH_BIO_SELECT,
    _count: { select: { followers: true, following: true } },
  } as const

  if (query && (searchMode === 'bigm' || searchMode === 'trgm')) {
    const userIds = await fulltextSearchUsers(query, {
      excludedUserIds: excludedUserIdsWithGuest,
      currentUserId: viewerId,
      cursor: safeCursor,
      limit: safeLimit,
    })

    if (userIds.length === 0) {
      return { users: [], nextCursor: undefined }
    }

    const fetchedUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, ...visibleUserWhere(viewerId) },
      select: userSelect,
    })

    const users = preserveOrder(userIds, fetchedUsers)

    // trgm は類似度順で keyset pagination が成立しないため cursor を発行しない
    // （発行すると次ページ要求で常に同じ1ページ目が返り無限ループする）。
    return {
      users: users.map((user) => ({
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        followersCount: user._count.followers,
        followingCount: user._count.following,
      })),
      nextCursor:
        searchMode === 'trgm'
          ? undefined
          : users.length === safeLimit
            ? users[users.length - 1]?.id
            : undefined,
    }
  }

  const users = await prisma.user.findMany({
    where: {
      ...visibleUserWhere(viewerId),
      AND: [
        query
          ? {
              OR: [
                { nickname: containsInsensitive(query) },
                { bio: containsInsensitive(query) },
              ],
            }
          : {},
        excludedUserIdsWithGuest.length > 0 ? { id: { notIn: excludedUserIdsWithGuest } } : {},
        viewerId ? { id: { not: viewerId } } : {},
      ],
    },
    select: userSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
  })

  return {
    users: users.map((user) => ({
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followersCount: user._count.followers,
      followingCount: user._count.following,
    })),
    nextCursor: users.length === safeLimit ? users[users.length - 1]?.id : undefined,
  }
}
