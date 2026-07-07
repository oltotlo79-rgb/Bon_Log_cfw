/**
 * コメント関連のServer Actions
 * コメントの作成・削除・取得・メディアアップロードを提供する。
 * 2階層のコメント構造（親コメント + 返信）をサポート。
 * @module lib/actions/comment
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { sanitizePostContent } from '@/lib/sanitize'
import logger from '@/lib/logger'
import { requireActiveNonGuestUser, requireAuth, actionSuccess, actionError, validateMediaCounts, enforceUserRateLimit } from '@/lib/actions/utils'
import { checkUserRateLimit, checkDailyLimit } from '@/lib/rate-limit'
import {
  MAX_COMMENT_LENGTH,
  MAX_COMMENT_IMAGES,
  MAX_COMMENT_VIDEOS_FREE,
  MAX_COMMENT_VIDEOS_PREMIUM,
  DAILY_COMMENT_LIMIT,
  DEFAULT_PAGE_LIMIT,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  REPLIES_PAGE_LIMIT,
} from '@/lib/constants/limits'
import { isPremiumUser } from '@/lib/premium'
import {
  ERR_RATE_LIMIT_UPLOAD,
  ERR_COMMENT_CONTENT_REQUIRED,
  ERR_COMMENT_CREATE_FAILED,
  ERR_COMMENT_DELETE_FAILED,
  ERR_COMMENT_UPDATE_FAILED,
  ERR_COMMENT_NOT_FOUND,
  ERR_PERMISSION_DENIED,
  ERR_INVALID_INPUT,
  ERR_MEDIA_UPLOAD_FAILED,
  ERR_FILE_NOT_SELECTED,
  ERR_IMAGE_SIZE_EXCEEDED,
  ERR_VIDEO_SIZE_EXCEEDED,
  ERR_IMAGE_VIDEO_SELECT,
  ERR_COMMENT_CONTENT_TOO_LONG,
  ERR_DAILY_COMMENT_LIMIT,
  ERR_DAILY_UPLOAD_LIMIT,
  ERR_POST_NOT_FOUND,
} from '@/lib/constants/errors'
import { buildPostPath } from '@/lib/constants/path-builders'
import {
  STORAGE_FOLDER_COMMENT_IMAGES,
  STORAGE_FOLDER_COMMENT_VIDEOS,
} from '@/lib/constants/storage'
import { getStartOfToday } from '@/lib/utils'
import { validateImageFile, generateSafeFileName } from '@/lib/file-validation'
import { notifyCommentParticipants } from '@/lib/services/comment-notifications'
import { mediaUrlListSchema, mediaTypeListSchema } from '@/lib/actions/schemas/common'
import { assertCanViewPost } from '@/lib/services/post-visibility'
import { fetchComments, fetchReplies } from '@/lib/services/comment-read-service'

const commentIdSchema = z.string().min(1)

const createCommentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().min(1).nullable().optional(),
  content: z.string().optional(),
  mediaUrls: mediaUrlListSchema,
  mediaTypes: mediaTypeListSchema,
})

/**
 * @param formData - コメントのフォームデータ
 * @returns 成功時は { success, comment }、失敗時は { error }
 */
export async function createComment(formData: FormData) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = createCommentSchema.safeParse({
    postId: formData.get('postId'),
    parentId: formData.get('parentId') || null,
    content: formData.get('content') || '',
    mediaUrls: formData.getAll('mediaUrls'),
    mediaTypes: formData.getAll('mediaTypes'),
  })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // The per-minute rate limit prevents bursts; DAILY_COMMENT_LIMIT below is the absolute daily ceiling.
  const rl = await enforceUserRateLimit(userId, 'comment')
  if (rl) return actionError(rl.error)

  const { postId, parentId, mediaUrls, mediaTypes } = parsed.data
  const content = sanitizePostContent(parsed.data.content || '').trim()

  if (!content && mediaUrls.length === 0) {
    return actionError(ERR_COMMENT_CONTENT_REQUIRED)
  }

  if (content && content.length > MAX_COMMENT_LENGTH) {
    return actionError(ERR_COMMENT_CONTENT_TOO_LONG(MAX_COMMENT_LENGTH))
  }

  // 対象リソース認可: 見えない投稿（非表示/非公開/停止著者）にはコメントできない
  if (!(await assertCanViewPost(userId, postId))) {
    return actionError(ERR_POST_NOT_FOUND)
  }

  // 返信時は parent コメントが同一投稿に属し有効（非表示/削除でない）であることを確認する
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { postId: true, isHidden: true, deletedAt: true },
    })
    if (!parent || parent.postId !== postId || parent.isHidden || parent.deletedAt) {
      return actionError(ERR_COMMENT_NOT_FOUND)
    }
  }

  try {
    // メディアバリデーション（トランザクション外で可）
    const maxVideos = (await isPremiumUser(userId)) ? MAX_COMMENT_VIDEOS_PREMIUM : MAX_COMMENT_VIDEOS_FREE
    const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, { maxImages: MAX_COMMENT_IMAGES, maxVideos })
    if (mediaValidation) return mediaValidation

    // $transaction はロールバック単位をまとめるが、READ COMMITTED では count→create の
    // write skew を完全には防げない（TOCTOU 的な超過が僅かに起こりうる）。実害は日次上限の
    // わずかな超過に限定され、レート制限で有界。厳密な原子性が要る場合は Redis INCR 方式
    // （checkDailyPostLimit 参照）を使う。
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
          parentId: parentId || null,
          content: content?.trim() || '',
          media: mediaUrls.length > 0 ? {
            create: mediaUrls.map((url: string, index: number) => ({
              url,
              type: mediaTypes[index] || 'image',
              sortOrder: index,
            })),
          } : undefined,
        },
      })

      return { limitExceeded: false, comment } as const
    })

    if (txResult.limitExceeded) {
      return actionError(ERR_DAILY_COMMENT_LIMIT(DAILY_COMMENT_LIMIT))
    }

    // discriminated union により、limitExceeded === false の枝で comment は確実に存在
    const { comment } = txResult

    // 通知送信（失敗してもコメント作成は成功させる）
    void notifyCommentParticipants(postId, comment.id, userId, parentId).catch((err: unknown) => {
      logger.error('Failed to send comment notifications', {
        commentId: comment.id,
        postId,
        actorId: userId,
        error: err instanceof Error ? err.message : String(err),
      })
    })

    revalidatePath(buildPostPath(postId))

    return actionSuccess({ comment })
  } catch (error) {
    logger.error('Create comment failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_COMMENT_CREATE_FAILED)
  }
}

/**
 * @param commentId - 削除するコメントのID
 * @returns 成功時は { success }、失敗時は { error }
 */
export async function deleteComment(commentId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!commentIdSchema.safeParse(commentId).success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'delete_comment')
  if (rl) return actionError(rl.error)

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, postId: true, post: { select: { userId: true } } },
    })

    if (!comment) {
      return actionError(ERR_COMMENT_NOT_FOUND)
    }

    if (comment.userId !== userId && comment.post.userId !== userId) {
      return actionError(ERR_PERMISSION_DENIED)
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    })

    revalidatePath(buildPostPath(comment.postId))

    return actionSuccess()
  } catch (error) {
    logger.error('Delete comment failed', {
      userId,
      commentId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_COMMENT_DELETE_FAILED)
  }
}

/**
 * コメント本文を編集する（投稿者本人のみ）。メディアは変更しない。
 * @param commentId - 編集対象のコメントID
 * @param content - 新しい本文
 * @returns 成功時は { success, data: { content, editedAt } }、失敗時は { error }
 */
export async function updateComment(commentId: string, content: string) {
  // 1. 認証 (非ゲスト)
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  // 2. Zod 形状検証
  if (!commentIdSchema.safeParse(commentId).success) return actionError(ERR_INVALID_INPUT)
  if (typeof content !== 'string') return actionError(ERR_INVALID_INPUT)

  // 3. レート制限 (Zod 通過後)
  const rl = await enforceUserRateLimit(userId, 'update_comment')
  if (rl) return actionError(rl.error)

  const sanitized = sanitizePostContent(content)

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        userId: true,
        postId: true,
        deletedAt: true,
        _count: { select: { media: true } },
      },
    })

    if (!comment || comment.deletedAt) {
      return actionError(ERR_COMMENT_NOT_FOUND)
    }

    // 編集は投稿者本人のみ（他人の発言は編集不可。削除と異なり投稿主でも編集はできない）
    if (comment.userId !== userId) {
      return actionError(ERR_PERMISSION_DENIED)
    }

    // 本文が空の場合、メディアが無ければ不可
    if (sanitized.length === 0 && comment._count.media === 0) {
      return actionError(ERR_COMMENT_CONTENT_REQUIRED)
    }

    if (sanitized.length > MAX_COMMENT_LENGTH) {
      return actionError(ERR_COMMENT_CONTENT_TOO_LONG(MAX_COMMENT_LENGTH))
    }

    const editedAt = new Date()
    await prisma.comment.update({
      where: { id: commentId },
      data: { content: sanitized, editedAt },
    })

    revalidatePath(buildPostPath(comment.postId))

    return actionSuccess({ content: sanitized, editedAt })
  } catch (error) {
    logger.error('Update comment failed', {
      userId,
      commentId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_COMMENT_UPDATE_FAILED)
  }
}

/**
 * @param postId - 投稿ID
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数
 * @returns コメント一覧と次のカーソル
 */
export async function getComments(postId: string, cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const session = await auth()
  const currentUserId = session?.user?.id

  try {
    return await fetchComments(postId, currentUserId, cursor, limit)
  } catch (error) {
    logger.error('Get comments error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { comments: [], nextCursor: undefined }
  }
}

/**
 * @param commentId - 親コメントのID
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数
 * @returns 返信一覧と次のカーソル
 */
export async function getReplies(commentId: string, cursor?: string, limit = REPLIES_PAGE_LIMIT) {
  const session = await auth()
  const currentUserId = session?.user?.id

  try {
    const result = await fetchReplies(commentId, currentUserId, cursor, limit)
    return { replies: result.comments, nextCursor: result.nextCursor }
  } catch (error) {
    logger.error('Get replies error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { replies: [], nextCursor: undefined }
  }
}

/**
 * @param postId - 投稿ID
 * @returns コメント数
 */
export async function getCommentCount(postId: string) {
  const session = await auth()
  try {
    if (!(await assertCanViewPost(session?.user?.id, postId))) {
      return { count: 0 }
    }

    const count = await prisma.comment.count({
      where: { postId, isHidden: false, deletedAt: null },
    })

    return { count }
  } catch (error) {
    logger.error('Get comment count error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { count: 0 }
  }
}

/**
 * @param formData - ファイルを含むFormData
 * @returns 成功時は { success, url, type }、失敗時は { error }
 */
export async function uploadCommentMedia(formData: FormData) {
  // 1. 認証
  const authResult = await requireAuth()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  // 2. 入力検証 (未検証入力で rate / daily limit を消費しないため順序を守る)
  const rawFile = formData.get('file')
  if (!(rawFile instanceof File)) {
    return actionError(ERR_FILE_NOT_SELECTED)
  }
  const file = rawFile

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    return actionError(ERR_IMAGE_VIDEO_SELECT)
  }

  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
  if (file.size > maxSize) {
    return actionError(isVideo ? ERR_VIDEO_SIZE_EXCEEDED : ERR_IMAGE_SIZE_EXCEEDED)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  if (isImage) {
    const validation = validateImageFile(buffer, file.type)
    if (!validation.valid) {
      return actionError(validation.error || ERR_IMAGE_VIDEO_SELECT)
    }
  }

  // 3. レート制限 / 日次上限
  const rateLimitResult = await checkUserRateLimit(userId, 'upload')
  if (!rateLimitResult.success) {
    return actionError(ERR_RATE_LIMIT_UPLOAD)
  }

  // R2 課金保護のため Redis 障害時も fail-closed
  const dailyLimitResult = await checkDailyLimit(userId, 'upload', { failOpen: false })
  if (!dailyLimitResult.allowed) {
    return actionError(ERR_DAILY_UPLOAD_LIMIT(dailyLimitResult.limit))
  }

  // 4. アップロード本処理
  try {
    const { uploadFile } = await import('@/lib/storage')
    const folder = isVideo ? STORAGE_FOLDER_COMMENT_VIDEOS : STORAGE_FOLDER_COMMENT_IMAGES
    const safeName = generateSafeFileName(file.name, file.type)
    const result = await uploadFile(buffer, safeName, file.type, folder)

    if (!result.success || !result.url) {
      if (result.error) logger.error('Comment media upload failed:', result.error)
      return actionError(ERR_MEDIA_UPLOAD_FAILED)
    }

    return actionSuccess({
      url: result.url,
      type: isVideo ? ('video' as const) : ('image' as const),
    })
  } catch (error) {
    logger.error('Upload comment media error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_MEDIA_UPLOAD_FAILED)
  }
}
