/**
 * ブックマーク機能のServer Actions
 *
 * ブックマークの追加・解除（トグル）、状態取得、一覧取得を提供する。
 * いいねと異なり、ブックマークは非公開で通知は送信しない。
 *
 * @module lib/actions/bookmark
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireActiveNonGuestUser, requireAuth, actionError, actionSuccess, enforceUserRateLimit } from '@/lib/actions/utils'
import logger from '@/lib/logger'
import { ERR_BOOKMARK_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { ROUTE_BOOKMARKS } from '@/lib/constants/routes'
import { buildPostPath } from '@/lib/constants/path-builders'
import { POST_LIST_INCLUDE, formatPostForClient } from './post-include'

const postIdSchema = z.string().min(1)

/**
 * ブックマークをトグル（追加/解除）
 * @param postId - ブックマーク対象の投稿ID
 * @returns 成功時は { success: true, bookmarked: boolean }、失敗時は { error: string }
 */
export async function toggleBookmark(postId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = postIdSchema.safeParse(postId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    // ブックマーク済みチェック + 作成/削除をトランザクションで原子的に実行
    const bookmarked = await prisma.$transaction(async (tx) => {
      const existingBookmark = await tx.bookmark.findUnique({
        where: { userId_postId: { userId, postId } },
      })

      if (existingBookmark) {
        await tx.bookmark.delete({
          where: { id: existingBookmark.id },
        })
        return false
      } else {
        await tx.bookmark.create({
          data: { postId, userId },
        })
        return true
      }
    })

    revalidatePath(ROUTE_BOOKMARKS)
    revalidatePath(buildPostPath(postId))

    return actionSuccess({ bookmarked })
  } catch (error) {
    logger.error('Toggle bookmark error:', error)
    return actionError(ERR_BOOKMARK_FAILED)
  }
}

/**
 * 投稿のブックマーク状態を取得
 * @param postId - 確認対象の投稿ID
 * @returns { bookmarked: boolean }
 */
export async function getBookmarkStatus(postId: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { bookmarked: false }
  const userId = authResult.userId

  try {
    const existingBookmark = await prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
    })

    return { bookmarked: !!existingBookmark }
  } catch (error) {
    logger.error('Get bookmark status error', { error: error instanceof Error ? error.message : String(error) })
    return { bookmarked: false }
  }
}

/**
 * ブックマークした投稿一覧を取得（カーソルベースページネーション）
 * @param cursor - ページネーション用カーソル（BookmarkテーブルのID）
 * @param limit - 取得件数
 * @returns ブックマークした投稿一覧と次のカーソル
 */
export async function getBookmarkedPosts(cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { posts: [], nextCursor: undefined }
  const userId = authResult.userId

  const currentUserId = userId

  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: currentUserId },
      include: {
        post: {
          include: POST_LIST_INCLUDE,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    })

    type BookmarkType = typeof bookmarks[number]
    type ValidBookmarkType = BookmarkType & { post: NonNullable<BookmarkType['post']> }

    const validBookmarks = bookmarks.filter((bookmark: BookmarkType): bookmark is ValidBookmarkType => Boolean(bookmark.post))
    const postIds = validBookmarks.map((b: ValidBookmarkType) => b.post.id)

    let likedPostIds: Set<string> = new Set()

    if (postIds.length > 0) {
      const userLikes = await prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null,
        },
        select: { postId: true },
      })
      likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    }

    const bookmarkedSet = new Set(postIds)
    const posts = validBookmarks.map((bookmark: ValidBookmarkType) =>
      formatPostForClient(bookmark.post, likedPostIds, bookmarkedSet),
    )

    const hasMore = bookmarks.length === limit

    return {
      posts,
      nextCursor: hasMore ? bookmarks[bookmarks.length - 1]?.id : undefined,
    }
  } catch (error) {
    logger.error('Get bookmarked posts error:', error)
    return { posts: [], nextCursor: undefined }
  }
}
