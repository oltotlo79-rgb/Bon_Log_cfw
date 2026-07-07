/**
 * @module lib/services/comment-write-service
 * コメント作成・削除のドメインロジック。
 *
 * v1 用。Web の lib/actions/comment.ts と同等のドメインロジックを Bearer 経路向けに提供する。
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { sanitizePostContent } from '@/lib/sanitize'
import { isPremiumUser } from '@/lib/premium'
import { validateMediaCounts } from '@/lib/actions/utils'
import { notifyCommentParticipants } from '@/lib/services/comment-notifications'
import { assertCanViewPost } from '@/lib/services/post-visibility'
import { assertMediaUrlsFromOwnStorage } from '@/lib/services/media-url-validator'
import logger from '@/lib/logger'
import { z } from 'zod'
import { mediaUrlListSchema, mediaTypeListSchema, type MediaType } from '@/lib/actions/schemas/common'
import { getStartOfToday } from '@/lib/utils'
import {
  MAX_COMMENT_LENGTH,
  MAX_COMMENT_IMAGES,
  MAX_COMMENT_VIDEOS_FREE,
  MAX_COMMENT_VIDEOS_PREMIUM,
  DAILY_COMMENT_LIMIT,
} from '@/lib/constants/limits'
import {
  ERR_COMMENT_CONTENT_REQUIRED,
  ERR_COMMENT_CONTENT_TOO_LONG,
  ERR_DAILY_COMMENT_LIMIT,
  ERR_COMMENT_CREATE_FAILED,
  ERR_COMMENT_DELETE_FAILED,
  ERR_COMMENT_NOT_FOUND,
  ERR_POST_NOT_FOUND,
  ERR_PERMISSION_DENIED,
  ERR_MEDIA_URL_NOT_OWN_STORAGE,
} from '@/lib/constants/errors'

// ──────────────────────────────────────────────────
// Input schemas
// ──────────────────────────────────────────────────

export const createCommentV1Schema = z.object({
  content: z.string().optional().default(''),
  parentId: z.string().min(1).nullable().optional(),
  mediaUrls: mediaUrlListSchema,
  mediaTypes: mediaTypeListSchema,
})
export type CreateCommentV1Input = z.infer<typeof createCommentV1Schema>

// ──────────────────────────────────────────────────
// Result types
// ──────────────────────────────────────────────────

export type CommentWriteError =
  | { ok: false; error: string; status: 400 | 403 | 404 | 429 | 500 }

export type CreateCommentResult =
  | { ok: true; commentId: string }
  | CommentWriteError

export type DeleteCommentResult =
  | { ok: true }
  | CommentWriteError

// ──────────────────────────────────────────────────
// Service functions
// ──────────────────────────────────────────────────

/**
 * コメントを作成する。
 *
 * 日次制限チェック + 作成を $transaction 内で行うが、READ COMMITTED では
 * count→create の write skew を完全には防げない（詳細は createCommentV1 本体のコメント参照）。
 */
export async function createCommentV1(
  postId: string,
  input: CreateCommentV1Input,
  userId: string,
): Promise<CreateCommentResult> {
  const content = sanitizePostContent(input.content).trim()
  const { parentId, mediaUrls, mediaTypes } = input

  if (!content && mediaUrls.length === 0) {
    return { ok: false, error: ERR_COMMENT_CONTENT_REQUIRED, status: 400 }
  }

  if (content && content.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: ERR_COMMENT_CONTENT_TOO_LONG(MAX_COMMENT_LENGTH), status: 400 }
  }

  // 対象リソース認可: 見えない投稿（非表示/非公開/停止著者）にはコメントできない
  if (!(await assertCanViewPost(userId, postId))) {
    return { ok: false, error: ERR_POST_NOT_FOUND, status: 404 }
  }

  // 返信時は parent コメントが同一投稿に属し有効（非表示/削除でない）であることを確認する
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { postId: true, isHidden: true, deletedAt: true },
    })
    if (!parent || parent.postId !== postId || parent.isHidden || parent.deletedAt) {
      return { ok: false, error: ERR_COMMENT_NOT_FOUND, status: 404 }
    }
  }

  try {
    const maxVideos = (await isPremiumUser(userId)) ? MAX_COMMENT_VIDEOS_PREMIUM : MAX_COMMENT_VIDEOS_FREE
    const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, { maxImages: MAX_COMMENT_IMAGES, maxVideos })
    if (mediaValidation && !mediaValidation.success) {
      return { ok: false, error: mediaValidation.error, status: 400 }
    }

    if (!assertMediaUrlsFromOwnStorage(mediaUrls)) {
      return { ok: false, error: ERR_MEDIA_URL_NOT_OWN_STORAGE, status: 400 }
    }

    // $transaction はロールバック単位をまとめるが、READ COMMITTED では count→create の
    // write skew を完全には防げない。実害は日次上限のわずかな超過に限定され、レート制限で
    // 有界。厳密な原子性が要る場合は Redis INCR 方式（lib/actions/utils.ts の
    // checkDailyPostLimit 参照）を使う。
    const today = getStartOfToday()
    const txResult = await prisma.$transaction(async (tx) => {
      const count = await tx.comment.count({
        where: {
          userId,
          createdAt: { gte: today },
        },
      })

      if (count >= DAILY_COMMENT_LIMIT) {
        return { limitExceeded: true } as const
      }

      const comment = await tx.comment.create({
        data: {
          postId,
          userId,
          parentId: parentId ?? null,
          content: content,
          media: mediaUrls.length > 0 ? {
            create: mediaUrls.map((url: string, index: number) => ({
              url,
              type: (mediaTypes[index] ?? 'image') as MediaType,
              sortOrder: index,
            })),
          } : undefined,
        },
      })

      return { limitExceeded: false, comment } as const
    })

    if (txResult.limitExceeded) {
      return { ok: false, error: ERR_DAILY_COMMENT_LIMIT(DAILY_COMMENT_LIMIT), status: 429 }
    }

    const { comment } = txResult

    // 通知送信（失敗してもコメント作成は成功させる）
    void notifyCommentParticipants(postId, comment.id, userId, parentId ?? null).catch((err: unknown) => {
      logger.error('Failed to send comment notifications (v1)', {
        commentId: comment.id,
        postId,
        actorId: userId,
        error: err instanceof Error ? err.message : String(err),
      })
    })

    return { ok: true, commentId: comment.id }
  } catch (error) {
    logger.error('createCommentV1 failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_COMMENT_CREATE_FAILED, status: 500 }
  }
}

/**
 * コメントを削除する（コメント所有者または投稿所有者）。
 * 物理削除ではなく deletedAt を設定するソフトデリート（Web の挙動と一致）。
 */
export async function deleteCommentV1(
  commentId: string,
  userId: string,
): Promise<DeleteCommentResult> {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, postId: true, post: { select: { userId: true } } },
    })

    if (!comment) {
      return { ok: false, error: ERR_COMMENT_NOT_FOUND, status: 404 }
    }

    if (comment.userId !== userId && comment.post.userId !== userId) {
      return { ok: false, error: ERR_PERMISSION_DENIED, status: 403 }
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    })

    return { ok: true }
  } catch (error) {
    logger.error('deleteCommentV1 failed', {
      userId,
      commentId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_COMMENT_DELETE_FAILED, status: 500 }
  }
}
