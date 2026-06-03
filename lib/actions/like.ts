/**
 * いいね機能のServer Actions
 *
 * 投稿・コメントへのいいねトグル、状態取得、いいね済み投稿一覧を提供する。
 * いいね追加時は投稿者/コメント者への通知と分析データ記録を行う。
 *
 * @module lib/actions/like
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireActiveNonGuestUser, requireAuth, actionError, actionSuccess, enforceUserRateLimit } from '@/lib/actions/utils'
import { revalidatePath } from 'next/cache'
import { recordLikeReceivedService } from '@/lib/services/analytics-recording'
import { createNotification, deleteNotification } from '@/lib/services/notification-core'
import logger from '@/lib/logger'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { ERR_LIKE_FAILED, ERR_INVALID_INPUT, ERR_POST_NOT_FOUND, ERR_COMMENT_NOT_FOUND } from '@/lib/constants/errors'
import { ROUTE_FEED } from '@/lib/constants/routes'
import { buildPostPath } from '@/lib/constants/path-builders'
import { canViewPostByAuthor, assertCanViewPost, visiblePostWhere } from '@/lib/services/post-visibility'
import { POST_LIST_INCLUDE, formatPostForClient } from './post-include'
import { normalizeCursorPagination } from '@/lib/actions/pagination'

const postIdSchema = z.string().min(1)
const commentIdSchema = z.string().min(1)

/**
 * 投稿へのいいねをトグル（追加/解除）
 * @param postId - いいね対象の投稿ID
 * @returns 成功時は { success: true, liked: boolean }、失敗時は { error: string }
 */
export async function togglePostLike(postId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = postIdSchema.safeParse(postId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'toggle_like')
  if (rl) return actionError(rl.error)

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, isHidden: true },
    })

    // 対象リソース認可: 見えない投稿（非表示/非公開/停止著者）への like は拒否する
    if (!post || post.isHidden || !(await canViewPostByAuthor(userId, post.userId))) {
      return actionError(ERR_POST_NOT_FOUND)
    }

    // いいね済みチェック + 作成/削除をトランザクションで原子的に実行
    const liked = await prisma.$transaction(async (tx) => {
      const existingLike = await tx.like.findFirst({
        where: { postId, userId, commentId: null },
      })

      if (existingLike) {
        await tx.like.delete({
          where: { id: existingLike.id },
        })
        return false
      } else {
        await tx.like.create({
          data: { postId, userId },
        })
        return true
      }
    })

    // 通知はトランザクション外（クリティカルでない）
    if (post && post.userId !== userId) {
      if (liked) {
        void createNotification({
          userId: post.userId,
          actorId: userId,
          type: 'like',
          postId,
        }).catch((err) => {
          logger.error('createNotification (like) failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        })
        void recordLikeReceivedService(post.userId).catch((err) => {
          logger.error('recordLikeReceived failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        })
      } else {
        void deleteNotification({
          userId: post.userId,
          actorId: userId,
          type: 'like',
          postId,
        }).catch((err) => {
          logger.error('deleteNotification (like) failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        })
      }
    }

    revalidatePath(ROUTE_FEED)
    revalidatePath(buildPostPath(postId))

    return actionSuccess({ liked })
  } catch (error) {
    logger.error('Toggle post like error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_LIKE_FAILED)
  }
}

/**
 * コメントへのいいねをトグル（追加/解除）
 * @param commentId - いいね対象のコメントID
 * @param postId - コメントが属する投稿ID（キャッシュ再検証用）
 * @returns 成功時は { success: true, liked: boolean }、失敗時は { error: string }
 */
export async function toggleCommentLike(commentId: string, postId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!commentIdSchema.safeParse(commentId).success || !postIdSchema.safeParse(postId).success) {
    return actionError(ERR_INVALID_INPUT)
  }

  const rl = await enforceUserRateLimit(userId, 'toggle_like')
  if (rl) return actionError(rl.error)

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { postId: true, userId: true, isHidden: true, deletedAt: true },
    })

    // 対象リソース認可: コメントが有効で、属する投稿（client 申告ではなく実 postId）が閲覧可能であること
    if (!comment || comment.isHidden || comment.deletedAt || !(await assertCanViewPost(userId, comment.postId))) {
      return actionError(ERR_COMMENT_NOT_FOUND)
    }

    const liked = await prisma.$transaction(async (tx) => {
      const existingLike = await tx.like.findFirst({
        where: { commentId, userId },
      })

      if (existingLike) {
        await tx.like.delete({
          where: { id: existingLike.id },
        })
        return false
      } else {
        await tx.like.create({
          data: { commentId, userId },
        })
        return true
      }
    })

    if (comment.userId !== userId) {
      if (liked) {
        void createNotification({
          userId: comment.userId,
          actorId: userId,
          type: 'comment_like',
          postId,
          commentId,
        }).catch((err) => {
          logger.error('createNotification (comment_like) failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        })
      } else {
        void deleteNotification({
          userId: comment.userId,
          actorId: userId,
          type: 'comment_like',
          postId,
          commentId,
        }).catch((err) => {
          logger.error('deleteNotification (comment_like) failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        })
      }
    }

    revalidatePath(ROUTE_FEED)
    revalidatePath(buildPostPath(postId))

    return actionSuccess({ liked })
  } catch (error) {
    logger.error('Toggle comment like error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_LIKE_FAILED)
  }
}

/**
 * 投稿のいいね状態を取得
 * @param postId - 確認対象の投稿ID
 * @returns { liked: boolean }
 */
export async function getPostLikeStatus(postId: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { liked: false }
  const userId = authResult.userId

  try {
    const existingLike = await prisma.like.findFirst({
      where: { postId, userId, commentId: null },
    })

    return { liked: !!existingLike }
  } catch (error) {
    logger.error('Get post like status error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { liked: false }
  }
}

/**
 * ユーザーがいいねした投稿一覧を取得（カーソルベースページネーション）
 * @param userId - 対象ユーザーのID
 * @param cursor - ページネーション用カーソル（LikeテーブルのID）
 * @param limit - 取得件数
 * @returns いいねした投稿一覧と次のカーソル
 */
export async function getLikedPosts(userId: string, cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const session = await auth()
  const currentUserId = session?.user?.id
  // limit / cursor を MAX_PAGE_LIMIT で clamp し不正文字を除去する
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  try {
    const likes = await prisma.like.findMany({
      where: {
        userId,
        postId: { not: null },
        commentId: null,
        // いいね先は他ユーザー作のため、閲覧者から見える投稿のみに絞る（非表示/非公開/停止を除外）。
        post: visiblePostWhere(currentUserId),
      },
      include: {
        post: {
          include: POST_LIST_INCLUDE,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      ...(safeCursor && {
        cursor: { id: safeCursor },
        skip: 1,
      }),
    })

    type LikeType = typeof likes[number]
    type ValidLikeType = LikeType & { post: NonNullable<LikeType['post']> }

    const validLikes = likes.filter((like: LikeType): like is ValidLikeType => Boolean(like.post))
    const postIds = validLikes.map((like: ValidLikeType) => like.post.id)

    // isLiked / isBookmarked は「閲覧者(currentUserId)」基準で判定する。
    // likedSet を対象ユーザーの like から作ると他人の一覧で常に true になるため、
    // bookmark と同様に閲覧者の like を引き直す。
    let likedSet = new Set<string>()
    let bookmarkedSet = new Set<string>()
    if (currentUserId && postIds.length > 0) {
      const [userLikes, userBookmarks] = await Promise.all([
        prisma.like.findMany({
          where: { userId: currentUserId, postId: { in: postIds }, commentId: null },
          select: { postId: true },
        }),
        prisma.bookmark.findMany({
          where: { userId: currentUserId, postId: { in: postIds } },
          select: { postId: true },
        }),
      ])
      likedSet = new Set(
        userLikes
          .map((l: { postId: string | null }) => l.postId)
          .filter((id: string | null): id is string => id !== null),
      )
      bookmarkedSet = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
    }

    const posts = validLikes.map((like: ValidLikeType) =>
      formatPostForClient(like.post, likedSet, bookmarkedSet),
    )

    const hasMore = likes.length === safeLimit

    return {
      posts,
      nextCursor: hasMore ? likes[likes.length - 1]?.id : undefined,
    }
  } catch (error) {
    logger.error('Get liked posts error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { posts: [], nextCursor: undefined }
  }
}
