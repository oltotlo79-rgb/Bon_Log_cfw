/**
 * @module lib/services/post-write-service
 * 投稿作成・編集・削除のドメインロジック。
 *
 * v1 用。Web の lib/actions/post.ts と同等のドメインロジックを Bearer 経路向けに提供する。
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 *
 * mediaUrls の検証方針（v1 のみ厳格化）:
 * Web は URL 文字列存在チェックのみ。v1 は assertMediaUrlsFromOwnStorage() により
 * 自社ストレージドメイン許可リスト検証を追加する。正規アップロードフローは必ず自社 URL を
 * 返すため、正規クライアントへの影響はない。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { sanitizePostContent } from '@/lib/sanitize'
import { getMembershipLimits } from '@/lib/premium'
import { validateMediaCounts, checkDailyPostLimit } from '@/lib/actions/utils'
import { attachHashtagsToPost, detachHashtagsFromPost, extractHashtags } from '@/lib/services/hashtag-sync'
import { notifyMentionedUsers } from '@/lib/services/mention'
import { deleteMediaFiles } from '@/lib/services/media-cleanup'
import { fetchPostDetail } from '@/lib/services/post-read-service'
import { assertCanViewPost } from '@/lib/services/post-visibility'
import { assertMediaUrlsFromOwnStorage } from '@/lib/services/media-url-validator'
import logger from '@/lib/logger'
import { z } from 'zod'
import { mediaUrlListSchema, mediaTypeListSchema, type MediaType } from '@/lib/actions/schemas/common'
import {
  MAX_GENRES_PER_POST,
  MIN_POLL_OPTIONS,
  MAX_POLL_OPTIONS,
  MAX_POLL_OPTION_LENGTH,
  VALID_POLL_DURATIONS,
  DEFAULT_POLL_DURATION_SECONDS,
  ONE_SECOND_MS,
} from '@/lib/constants/limits'
import {
  ERR_INVALID_INPUT,
  ERR_CONTENT_REQUIRED,
  ERR_POST_CONTENT_TOO_LONG,
  ERR_GENRE_LIMIT,
  ERR_POST_NOT_FOUND,
  ERR_PERMISSION_DENIED,
  ERR_POST_NOT_EDITABLE,
  ERR_POST_CREATE_FAILED,
  ERR_POST_UPDATE_FAILED,
  ERR_POST_DELETE_FAILED,
  ERR_MEDIA_URL_NOT_OWN_STORAGE,
  ERR_QUOTE_REQUIRED,
  ERR_POLL_INVALID_DURATION,
  ERR_POLL_OPTIONS_COUNT,
  ERR_POLL_OPTION_TOO_LONG,
} from '@/lib/constants/errors'
import { createNotification } from '@/lib/services/notification-core'
import { canViewAuthorContent } from '@/lib/services/post-visibility'

// ──────────────────────────────────────────────────
// Input schemas
// ──────────────────────────────────────────────────

const pollOptionSchema = z
  .string()
  .min(1)
  .max(MAX_POLL_OPTION_LENGTH)
  .refine((s) => s.trim().length > 0)

export const createPostV1Schema = z.object({
  content: z.string().optional().default(''),
  genreIds: z.array(z.string()).default([]),
  mediaUrls: mediaUrlListSchema,
  mediaTypes: mediaTypeListSchema,
  /** アンケートを付与する場合のみ指定する。省略するとアンケートなし投稿になる。 */
  poll: z
    .object({
      options: z
        .array(pollOptionSchema)
        .min(MIN_POLL_OPTIONS, ERR_POLL_OPTIONS_COUNT(MIN_POLL_OPTIONS, MAX_POLL_OPTIONS))
        .max(MAX_POLL_OPTIONS, ERR_POLL_OPTIONS_COUNT(MIN_POLL_OPTIONS, MAX_POLL_OPTIONS)),
      durationSeconds: z
        .number()
        .int()
        .refine(
          (v) => (VALID_POLL_DURATIONS as readonly number[]).includes(v),
          ERR_POLL_INVALID_DURATION,
        )
        .optional()
        .default(DEFAULT_POLL_DURATION_SECONDS),
    })
    .optional(),
})
export type CreatePostV1Input = z.infer<typeof createPostV1Schema>

export const updatePostV1Schema = z.object({
  content: z.string().optional().default(''),
  genreIds: z.array(z.string()).default([]),
  mediaUrls: mediaUrlListSchema,
  mediaTypes: mediaTypeListSchema,
})
export type UpdatePostV1Input = z.infer<typeof updatePostV1Schema>

// ──────────────────────────────────────────────────
// Result types
// ──────────────────────────────────────────────────

export type PostWriteError =
  | { ok: false; error: string; status: 400 | 403 | 404 | 429 | 500 }

export type CreatePostResult =
  | { ok: true; postId: string }
  | PostWriteError

export type UpdatePostResult =
  | { ok: true; postId: string }
  | PostWriteError

export type DeletePostResult =
  | { ok: true }
  | PostWriteError

// ──────────────────────────────────────────────────
// Service functions
// ──────────────────────────────────────────────────

/**
 * 投稿を作成する。
 * 入力は Zod でパース済みの値を受け取る（schema.safeParse 後の `.data` を渡す）。
 * 日次制限・メディア枚数・本文長はここで確認する。
 */
export async function createPostV1(
  input: CreatePostV1Input,
  userId: string,
): Promise<CreatePostResult> {
  const content = sanitizePostContent(input.content)
  const { genreIds, mediaUrls, mediaTypes } = input

  const limits = await getMembershipLimits(userId)

  if (!content && mediaUrls.length === 0) {
    return { ok: false, error: ERR_CONTENT_REQUIRED, status: 400 }
  }
  if (content && content.length > limits.maxPostLength) {
    return { ok: false, error: ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength), status: 400 }
  }
  if (genreIds.length > MAX_GENRES_PER_POST) {
    return { ok: false, error: ERR_GENRE_LIMIT(MAX_GENRES_PER_POST), status: 400 }
  }

  const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, limits)
  if (mediaValidation && !mediaValidation.success) {
    return { ok: false, error: mediaValidation.error, status: 400 }
  }

  if (!assertMediaUrlsFromOwnStorage(mediaUrls)) {
    return { ok: false, error: ERR_MEDIA_URL_NOT_OWN_STORAGE, status: 400 }
  }

  const dailyLimitError = await checkDailyPostLimit(userId)
  if (dailyLimitError && !dailyLimitError.success) {
    return { ok: false, error: dailyLimitError.error, status: 429 }
  }

  const pollData = input.poll
  if (pollData) {
    for (const opt of pollData.options) {
      if (opt.trim().length === 0 || opt.length > MAX_POLL_OPTION_LENGTH) {
        return { ok: false, error: ERR_POLL_OPTION_TOO_LONG(MAX_POLL_OPTION_LENGTH), status: 400 }
      }
    }
  }

  try {
    const durationSeconds = pollData?.durationSeconds ?? DEFAULT_POLL_DURATION_SECONDS
    const post = await prisma.post.create({
      data: {
        userId,
        content: content || null,
        media: mediaUrls.length > 0 ? {
          create: mediaUrls.map((url: string, index: number) => ({
            url,
            type: (mediaTypes[index] ?? 'image') as MediaType,
            sortOrder: index,
          })),
        } : undefined,
        genres: genreIds.length > 0 ? {
          create: genreIds.map((genreId: string) => ({ genreId })),
        } : undefined,
        poll: pollData
          ? {
              create: {
                duration: durationSeconds,
                expiresAt: new Date(Date.now() + durationSeconds * ONE_SECOND_MS),
                options: {
                  create: pollData.options.map((text: string, index: number) => ({
                    text: text.trim(),
                    sortOrder: index,
                  })),
                },
              },
            }
          : undefined,
      },
    })

    await Promise.allSettled([
      attachHashtagsToPost(post.id, content).catch((err: unknown) => {
        logger.error('attachHashtagsToPost failed (v1)', {
          postId: post.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }),
      notifyMentionedUsers(post.id, content, userId).catch((err: unknown) => {
        logger.error('notifyMentionedUsers failed (v1)', {
          postId: post.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }),
    ])

    return { ok: true, postId: post.id }
  } catch (error) {
    logger.error('createPostV1 failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_POST_CREATE_FAILED, status: 500 }
  }
}

/**
 * 投稿を編集する（所有者のみ）。
 * 純粋リポストは編集不可。1 日上限は消費しない。
 */
export async function updatePostV1(
  postId: string,
  input: UpdatePostV1Input,
  userId: string,
): Promise<UpdatePostResult> {
  const content = sanitizePostContent(input.content)
  const { genreIds, mediaUrls, mediaTypes } = input

  if (!postId) {
    return { ok: false, error: ERR_INVALID_INPUT, status: 400 }
  }

  const limits = await getMembershipLimits(userId)

  if (!content && mediaUrls.length === 0) {
    return { ok: false, error: ERR_CONTENT_REQUIRED, status: 400 }
  }
  if (content && content.length > limits.maxPostLength) {
    return { ok: false, error: ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength), status: 400 }
  }
  if (genreIds.length > MAX_GENRES_PER_POST) {
    return { ok: false, error: ERR_GENRE_LIMIT(MAX_GENRES_PER_POST), status: 400 }
  }

  const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, limits)
  if (mediaValidation && !mediaValidation.success) {
    return { ok: false, error: mediaValidation.error, status: 400 }
  }

  if (!assertMediaUrlsFromOwnStorage(mediaUrls)) {
    return { ok: false, error: ERR_MEDIA_URL_NOT_OWN_STORAGE, status: 400 }
  }

  try {
    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, repostPostId: true, media: { select: { url: true } } },
    })

    if (!existing) {
      return { ok: false, error: ERR_POST_NOT_FOUND, status: 404 }
    }
    if (existing.userId !== userId) {
      // 他人の投稿は存在を秘匿しない（所有者限定だと分かる情報のみ返す）
      return { ok: false, error: ERR_PERMISSION_DENIED, status: 403 }
    }
    if (existing.repostPostId !== null) {
      return { ok: false, error: ERR_POST_NOT_EDITABLE, status: 400 }
    }

    await prisma.$transaction(async (tx) => {
      await tx.postMedia.deleteMany({ where: { postId } })
      await tx.postGenre.deleteMany({ where: { postId } })
      await tx.post.update({
        where: { id: postId },
        data: {
          content: content || null,
          editedAt: new Date(),
          media: mediaUrls.length > 0 ? {
            create: mediaUrls.map((url: string, index: number) => ({
              url,
              type: (mediaTypes[index] ?? 'image') as MediaType,
              sortOrder: index,
            })),
          } : undefined,
          genres: genreIds.length > 0 ? {
            create: genreIds.map((genreId: string) => ({ genreId })),
          } : undefined,
        },
      })
    })

    const removedUrls = existing.media.map((m) => m.url).filter((url) => !mediaUrls.includes(url))
    if (removedUrls.length > 0) await deleteMediaFiles(removedUrls)

    // 本文変更を反映するためハッシュタグを貼り直す。
    // メンション通知は編集のたびに再送するとスパムになるため、編集時は再通知しない。
    await detachHashtagsFromPost(postId)
    await attachHashtagsToPost(postId, content).catch((err: unknown) => {
      logger.error('attachHashtagsToPost (v1 update) failed', {
        postId,
        error: err instanceof Error ? err.message : String(err),
      })
    })

    return { ok: true, postId }
  } catch (error) {
    logger.error('updatePostV1 failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_POST_UPDATE_FAILED, status: 500 }
  }
}

/**
 * 投稿を削除する（所有者のみ）。R2 メディア削除込み（best-effort）。
 */
export async function deletePostV1(
  postId: string,
  userId: string,
): Promise<DeletePostResult> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, media: { select: { url: true } } },
    })

    if (!post) {
      return { ok: false, error: ERR_POST_NOT_FOUND, status: 404 }
    }
    if (post.userId !== userId) {
      return { ok: false, error: ERR_PERMISSION_DENIED, status: 403 }
    }

    await detachHashtagsFromPost(postId)
    await prisma.post.delete({ where: { id: postId } })

    // DB カスケード後にストレージ実体も回収（オーファン防止、best-effort）
    await deleteMediaFiles(post.media.map((m) => m.url))

    return { ok: true }
  } catch (error) {
    logger.error('deletePostV1 failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_POST_DELETE_FAILED, status: 500 }
  }
}

// ──────────────────────────────────────────────────
// 引用投稿
// ──────────────────────────────────────────────────

export const createQuoteV1Schema = z.object({
  content: z.string().optional().default(''),
  genreIds: z.array(z.string()).max(MAX_GENRES_PER_POST).default([]),
  mediaUrls: mediaUrlListSchema,
  mediaTypes: mediaTypeListSchema,
})
export type CreateQuoteV1Input = z.infer<typeof createQuoteV1Schema>

export type CreateQuoteResult =
  | { ok: true; postId: string }
  | PostWriteError

/**
 * 引用投稿を作成する（v1 API 用）。
 *
 * - content は必須（空文字は 400）
 * - 引用元投稿が存在しない・不可視の場合は 404
 * - 日次投稿上限を消費する
 */
export async function createQuoteV1(
  quotePostId: string,
  input: CreateQuoteV1Input,
  userId: string,
): Promise<CreateQuoteResult> {
  const content = sanitizePostContent(input.content)
  const { genreIds, mediaUrls, mediaTypes } = input

  if (!content) {
    return { ok: false, error: ERR_QUOTE_REQUIRED, status: 400 }
  }

  const limits = await getMembershipLimits(userId)

  if (content.length > limits.maxPostLength) {
    return { ok: false, error: ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength), status: 400 }
  }
  if (genreIds.length > MAX_GENRES_PER_POST) {
    return { ok: false, error: ERR_GENRE_LIMIT(MAX_GENRES_PER_POST), status: 400 }
  }

  const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, limits)
  if (mediaValidation && !mediaValidation.success) {
    return { ok: false, error: mediaValidation.error, status: 400 }
  }

  if (!assertMediaUrlsFromOwnStorage(mediaUrls)) {
    return { ok: false, error: ERR_MEDIA_URL_NOT_OWN_STORAGE, status: 400 }
  }

  // 引用元投稿の存在・閲覧権限確認
  const quotePost = await prisma.post.findUnique({
    where: { id: quotePostId },
    select: {
      userId: true,
      isHidden: true,
      user: { select: { isPublic: true, isSuspended: true } },
    },
  })
  if (
    !quotePost ||
    quotePost.isHidden ||
    !(await canViewAuthorContent(userId, quotePost.userId, quotePost.user))
  ) {
    return { ok: false, error: ERR_POST_NOT_FOUND, status: 404 }
  }

  const dailyLimitError = await checkDailyPostLimit(userId)
  if (dailyLimitError && !dailyLimitError.success) {
    return { ok: false, error: dailyLimitError.error, status: 429 }
  }

  try {
    const post = await prisma.post.create({
      data: {
        userId,
        content,
        quotePostId,
        media: mediaUrls.length > 0 ? {
          create: mediaUrls.map((url: string, index: number) => ({
            url,
            type: (mediaTypes[index] ?? 'image') as MediaType,
            sortOrder: index,
          })),
        } : undefined,
        genres: genreIds.length > 0 ? {
          create: genreIds.map((genreId: string) => ({ genreId })),
        } : undefined,
      },
    })

    await Promise.allSettled([
      attachHashtagsToPost(post.id, content).catch((err: unknown) => {
        logger.error('attachHashtagsToPost failed (v1 quote)', {
          postId: post.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }),
      notifyMentionedUsers(post.id, content, userId).catch((err: unknown) => {
        logger.error('notifyMentionedUsers failed (v1 quote)', {
          postId: post.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }),
    ])

    if (quotePost.userId !== userId) {
      await createNotification({
        userId: quotePost.userId,
        actorId: userId,
        type: 'quote',
        postId: post.id,
      })
    }

    return { ok: true, postId: post.id }
  } catch (error) {
    logger.error('createQuoteV1 failed', {
      userId,
      quotePostId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_POST_CREATE_FAILED, status: 500 }
  }
}

/**
 * 投稿詳細を取得して v1 レスポンス形式で返す。
 * fetchPostDetail を再利用し、mentionedUsers 付加は route 側で行う。
 */
export async function fetchCreatedPost(postId: string, userId: string) {
  return fetchPostDetail(postId, userId)
}

/**
 * 投稿の可視性チェック。コメント作成経路から利用する。
 */
export { assertCanViewPost }

/**
 * ハッシュタグが含まれるか判定（revalidation 判断用）。
 */
export { extractHashtags }
