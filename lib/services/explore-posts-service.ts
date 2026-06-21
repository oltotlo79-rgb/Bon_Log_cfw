/**
 * @module lib/services/explore-posts-service
 * モバイル API v1 向け explore/posts（ハッシュタグ / ジャンル別投稿一覧）サービス層。
 *
 * explore-service.ts は既存のテストが vi.mock のモックセットを固定しているため、
 * post-include / shared-includes（USER_MINIMAL_RELATION 等）を新たに import すると
 * 既存テストが壊れる。このファイルを分離することでモック境界を維持する。
 *
 * Web の getPostsByHashtag（lib/actions/hashtag.ts）と fetchSearchPosts の
 * genreIds フィルタ（lib/services/search-service.ts）に相当するロジックを提供する。
 * Web Server Actions は無編集。
 *
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { POST_LIST_INCLUDE, formatPostForClient } from '@/lib/actions/post-include'
import { visibleAuthorFilter } from '@/lib/services/post-visibility'
import { getExcludedUserIds } from '@/lib/actions/filter-helper'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { getPostInteractionSets } from '@/lib/actions/utils'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import type { Post } from '@/types/post'

export type ExplorePostsResult = {
  posts: Post[]
  nextCursor: string | undefined
}

/**
 * 指定ハッシュタグを含む投稿をカーソルページネーションで返す。
 *
 * Web の getPostsByHashtag（lib/actions/hashtag.ts）と同等のフィルタを適用する。
 * ブロック/ミュート/可視性フィルタ・N+1 防止はこのサービスで処理し、
 * isBlocked/isMuted/mentionedUsers の付与は呼び出し元（route handler）が担う。
 *
 * @param hashtagName  `#` なしのタグ名（例: "松"）
 * @param viewerId     閲覧者のユーザー ID。ゲスト・未認証は undefined
 */
export async function fetchPostsByHashtag(
  hashtagName: string,
  viewerId: string | undefined,
  cursor?: string,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<ExplorePostsResult> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const excludedUserIds = viewerId
    ? await getExcludedUserIds(viewerId, { blocked: true, blockedBy: true, muted: true })
    : []

  const posts = await prisma.post.findMany({
    where: {
      isHidden: false,
      user: visibleAuthorFilter(viewerId),
      content: { contains: `#${hashtagName}`, mode: 'insensitive' },
      ...(excludedUserIds.length > 0 ? { userId: { notIn: excludedUserIds } } : {}),
    },
    include: { ...POST_LIST_INCLUDE },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
  })

  const nextCursor = posts.length === safeLimit ? posts[posts.length - 1]?.id : undefined

  const { likedSet, bookmarkedSet } = viewerId
    ? await getPostInteractionSets(viewerId, posts.map((p) => p.id))
    : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

  return {
    posts: posts.map((post) => formatPostForClient(post, likedSet, bookmarkedSet)),
    nextCursor,
  }
}

/**
 * 指定ジャンル ID に属する投稿をカーソルページネーションで返す。
 *
 * Web の fetchSearchPosts の genreIds フィルタ（lib/services/search-service.ts）相当を
 * 単独ジャンル向けに切り出したもの。ブロック/ミュート/可視性フィルタを含む。
 *
 * @param genreId   ジャンル ID
 * @param viewerId  閲覧者のユーザー ID。ゲスト・未認証は undefined
 */
export async function fetchPostsByGenre(
  genreId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<ExplorePostsResult> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const excludedUserIds = viewerId
    ? await getExcludedUserIds(viewerId, { blocked: true, blockedBy: true, muted: true })
    : []

  const posts = await prisma.post.findMany({
    where: {
      isHidden: false,
      user: visibleAuthorFilter(viewerId),
      genres: { some: { genreId } },
      ...(excludedUserIds.length > 0 ? { userId: { notIn: excludedUserIds } } : {}),
    },
    include: { ...POST_LIST_INCLUDE },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
  })

  const nextCursor = posts.length === safeLimit ? posts[posts.length - 1]?.id : undefined

  const { likedSet, bookmarkedSet } = viewerId
    ? await getPostInteractionSets(viewerId, posts.map((p) => p.id))
    : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

  return {
    posts: posts.map((post) => formatPostForClient(post, likedSet, bookmarkedSet)),
    nextCursor,
  }
}
