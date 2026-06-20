/**
 * @module lib/services/bookmark-service
 * モバイル API v1 向けブックマーク操作のプリミティブ。
 *
 * Web の toggleBookmark（lib/actions/bookmark.ts）は 'use server' 内で完結しているため
 * 直接再利用できない。本サービスは同等のロジックを v1 route handler から呼び出す形で
 * 新設し、Web Action は無編集で維持する。
 *
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { assertCanViewPost, visiblePostWhere } from '@/lib/services/post-visibility'
import {
  POST_LIST_INCLUDE,
  formatPostForClient,
} from '@/lib/actions/post-include'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import logger from '@/lib/logger'
import type { Post } from '@/types/post'

export type BookmarkMutationResult =
  | { found: false }
  | { found: true; bookmarked: boolean }

/**
 * 投稿にブックマークを付与する（冪等）。
 * 不存在・不可視の投稿は found:false を返す。
 * 既ブックマーク済みは no-op として found:true, bookmarked:true を返す。
 */
export async function addBookmark(
  postId: string,
  userId: string,
): Promise<BookmarkMutationResult> {
  const canView = await assertCanViewPost(userId, postId)
  if (!canView) return { found: false }

  try {
    await prisma.bookmark.upsert({
      where: { userId_postId: { userId, postId } },
      create: { postId, userId },
      update: {},
    })
    return { found: true, bookmarked: true }
  } catch (error) {
    logger.error('addBookmark error', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * 投稿のブックマークを解除する（冪等）。
 * 不存在・不可視の投稿は found:false を返す。
 * 未ブックマークは no-op として found:true, bookmarked:false を返す。
 */
export async function removeBookmark(
  postId: string,
  userId: string,
): Promise<BookmarkMutationResult> {
  const canView = await assertCanViewPost(userId, postId)
  if (!canView) return { found: false }

  try {
    await prisma.bookmark.deleteMany({
      where: { userId, postId },
    })
    return { found: true, bookmarked: false }
  } catch (error) {
    logger.error('removeBookmark error', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export type BookmarksListResult = {
  items: Post[]
  nextCursor: string | null
}

/**
 * ユーザーのブックマーク投稿一覧をカーソルベースで返す。
 *
 * 可視性フィルタ（visiblePostWhere）でブロック/非公開著者/停止著者の投稿を除外する。
 * N+1 防止: likedPostIds を postIds の一括 findMany で解決する。
 * カーソルキー: Bookmark.id（bookmark テーブルの主キー、ブックマーク順降順）。
 *
 * 実装戦略: 先に bookmark を id/postId のみで取得してカーソルを確定させ、
 * その postId で post を一括 findMany する。こうすることで post のフィールドが
 * Prisma 直の型として得られ、formatPostForClient に問題なく渡せる。
 */
export async function fetchBookmarkedPosts(
  userId: string,
  cursor?: string,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<BookmarksListResult> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  // ステップ1: bookmark の id と postId のみ取得してカーソルを確定する
  const bookmarkRows = await prisma.bookmark.findMany({
    where: { userId, post: visiblePostWhere(userId) },
    select: { id: true, postId: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
  })

  const hasMore = bookmarkRows.length === safeLimit
  const nextCursor = hasMore ? (bookmarkRows[bookmarkRows.length - 1]?.id ?? null) : null

  if (bookmarkRows.length === 0) {
    return { items: [], nextCursor: null }
  }

  const postIds = bookmarkRows.map((b) => b.postId)

  // ステップ2: postId を一括取得（N+1 なし）
  const posts = await prisma.post.findMany({
    where: { id: { in: postIds }, ...visiblePostWhere(userId) },
    include: POST_LIST_INCLUDE,
  })

  // bookmark 順（ブックマーク日時降順）を保持する
  const postMap = new Map(posts.map((p) => [p.id, p]))
  const orderedPosts = bookmarkRows
    .map((b) => postMap.get(b.postId))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)

  // ステップ3: いいね状態を一括取得
  let likedSet: Set<string> = new Set()
  if (orderedPosts.length > 0) {
    const userLikes = await prisma.like.findMany({
      where: { userId, postId: { in: postIds }, commentId: null },
      select: { postId: true },
    })
    likedSet = new Set(
      userLikes
        .map((l: { postId: string | null }) => l.postId)
        .filter((id: string | null): id is string => id !== null),
    )
  }

  // ブックマーク済み一覧なので全件 bookmarkedSet に含める
  const bookmarkedSet = new Set(postIds)

  const items = orderedPosts.map((post) =>
    formatPostForClient(post, likedSet, bookmarkedSet),
  )

  return { items, nextCursor }
}
