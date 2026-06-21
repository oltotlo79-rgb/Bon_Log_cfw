/**
 * @module lib/services/scheduled-post-service
 * 予約投稿のドメインロジック（モバイル API v1 用）。
 *
 * 認証・レート制限は呼び出し元 route handler が担う前提。
 * Web の lib/actions/scheduled-post-crud.ts と同等ロジックを移植し、
 * Web 側コードは一切変更しない。
 *
 * Returns custom shape instead of ActionResult because route handlers
 * return NextResponse directly and need status codes for HTTP mapping.
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'
import { validateMediaCounts } from '@/lib/actions/utils'
import { deleteMediaFiles } from '@/lib/services/media-cleanup'
import { assertMediaUrlsFromOwnStorage } from '@/lib/services/media-url-validator'
import { POST_GENRE_RELATION } from '@/lib/prisma/shared-includes'
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'
import {
  MAX_GENRES_PER_POST,
  MAX_PENDING_SCHEDULED_POSTS,
  MAX_POST_CONTENT_PREMIUM,
  MAX_SCHEDULED_DAYS_AHEAD,
} from '@/lib/constants/limits'
import {
  ERR_SCHEDULED_POST_PREMIUM_ONLY,
  ERR_SCHEDULED_POST_DATE_REQUIRED,
  ERR_SCHEDULED_POST_FUTURE_REQUIRED,
  ERR_SCHEDULED_POST_NOT_FOUND,
  ERR_SCHEDULED_POST_ACCESS_DENIED,
  ERR_SCHEDULED_POST_UPDATE_DENIED,
  ERR_SCHEDULED_POST_NOT_EDITABLE,
  ERR_SCHEDULED_POST_PUBLISHED_DELETE,
  ERR_CANCEL_DENIED,
  ERR_ONLY_SCHEDULED_CANCEL,
  ERR_SCHEDULED_DATE_TOO_FAR,
  ERR_SCHEDULED_POST_LIMIT,
  ERR_CONTENT_REQUIRED,
  ERR_POST_CONTENT_TOO_LONG,
  ERR_GENRE_LIMIT,
  ERR_PERMISSION_DENIED,
  ERR_MEDIA_URL_NOT_OWN_STORAGE,
} from '@/lib/constants/errors'
import { z } from 'zod'
import { mediaUrlListSchema, mediaTypeListSchema } from '@/lib/actions/schemas/common'
import { Prisma, type ScheduledPostStatus } from '@prisma/client'
import type { ScheduledPostStatusType } from '@/lib/constants/status'

type TransactionClient = Prisma.TransactionClient

// ──────────────────────────────────────────────────
// Input schemas（v1 は JSON body。FormData は使わない）
// ──────────────────────────────────────────────────

export const scheduledPostCreateV1Schema = z.object({
  content: z.string().max(MAX_POST_CONTENT_PREMIUM).optional().default(''),
  scheduledAt: z.string().min(1, ERR_SCHEDULED_POST_DATE_REQUIRED),
  genreIds: z.array(z.string()).max(MAX_GENRES_PER_POST, ERR_GENRE_LIMIT(MAX_GENRES_PER_POST)).default([]),
  mediaUrls: mediaUrlListSchema,
  mediaTypes: mediaTypeListSchema,
})
export type ScheduledPostCreateV1Input = z.infer<typeof scheduledPostCreateV1Schema>

export const scheduledPostUpdateV1Schema = scheduledPostCreateV1Schema
export type ScheduledPostUpdateV1Input = ScheduledPostCreateV1Input

// ──────────────────────────────────────────────────
// Result types（HTTP ステータスコードを含む判別 union）
// ──────────────────────────────────────────────────

export type ServiceError = { ok: false; error: string; status: 400 | 403 | 404 | 409 | 500 }

export type ListScheduledPostsResult =
  | { ok: true; items: ScheduledPostItem[]; nextCursor: string | null }
  | ServiceError

export type GetScheduledPostResult =
  | { ok: true; item: ScheduledPostItem }
  | ServiceError

export type CreateScheduledPostResult =
  | { ok: true; id: string }
  | ServiceError

export type UpdateScheduledPostResult =
  | { ok: true }
  | ServiceError

export type CancelScheduledPostResult =
  | { ok: true }
  | ServiceError

export type DeleteScheduledPostResult =
  | { ok: true }
  | ServiceError

// ──────────────────────────────────────────────────
// レスポンス型（クライアントに返す形状）
// ──────────────────────────────────────────────────

export interface ScheduledPostMediaItem {
  url: string
  type: string
  sortOrder: number
}

export interface ScheduledPostGenreItem {
  id: string
  name: string
}

export interface ScheduledPostItem {
  id: string
  content: string | null
  scheduledAt: string
  status: ScheduledPostStatusType
  media: ScheduledPostMediaItem[]
  genres: ScheduledPostGenreItem[]
  publishedPostId: string | null
  createdAt: string
}

// ──────────────────────────────────────────────────
// Prisma クエリの共通 include
// ──────────────────────────────────────────────────

const SCHEDULED_POST_INCLUDE = {
  media: { orderBy: { sortOrder: 'asc' } as const },
  genres: POST_GENRE_RELATION,
} as const

// ──────────────────────────────────────────────────
// Formatter
// ──────────────────────────────────────────────────

type RawScheduledPost = {
  id: string
  content: string | null
  scheduledAt: Date
  status: ScheduledPostStatus
  publishedPostId: string | null
  createdAt: Date
  media: Array<{ url: string; type: string; sortOrder: number }>
  genres: Array<{ genre: { id: string; name: string } }>
}

/**
 * Prisma の ScheduledPostStatus enum 値は SCHEDULED_POST_STATUS 定数と 1:1 対応するため
 * 型変換ではなく型ガードで ScheduledPostStatusType に絞り込む。
 */
function isScheduledPostStatusType(v: string): v is ScheduledPostStatusType {
  return Object.values(SCHEDULED_POST_STATUS).includes(v as ScheduledPostStatusType)
}

function formatScheduledPost(sp: RawScheduledPost): ScheduledPostItem {
  const status = isScheduledPostStatusType(sp.status)
    ? sp.status
    : SCHEDULED_POST_STATUS.PENDING
  return {
    id: sp.id,
    content: sp.content,
    scheduledAt: sp.scheduledAt.toISOString(),
    status,
    media: sp.media.map((m) => ({ url: m.url, type: m.type, sortOrder: m.sortOrder })),
    genres: sp.genres.map((g) => ({ id: g.genre.id, name: g.genre.name })),
    publishedPostId: sp.publishedPostId,
    createdAt: sp.createdAt.toISOString(),
  }
}

// ──────────────────────────────────────────────────
// 予約日時バリデーション（Web action と同等ロジック）
// ──────────────────────────────────────────────────

function validateScheduledAt(scheduledAtStr: string): { date: Date } | { error: string } {
  const scheduledAt = new Date(scheduledAtStr)
  if (isNaN(scheduledAt.getTime())) return { error: ERR_SCHEDULED_POST_FUTURE_REQUIRED }
  if (scheduledAt <= new Date()) return { error: ERR_SCHEDULED_POST_FUTURE_REQUIRED }
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + MAX_SCHEDULED_DAYS_AHEAD)
  if (scheduledAt > maxDate) return { error: ERR_SCHEDULED_DATE_TOO_FAR(MAX_SCHEDULED_DAYS_AHEAD) }
  return { date: scheduledAt }
}

// ──────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────

/**
 * 予約投稿一覧をカーソルページネーションで取得する（プレミアム必須）。
 */
export async function listScheduledPostsV1(
  userId: string,
  cursor: string | undefined,
  limit: number,
): Promise<ListScheduledPostsResult> {
  const isPremium = await isPremiumUser(userId)
  if (!isPremium) return { ok: false, error: ERR_SCHEDULED_POST_PREMIUM_ONLY, status: 403 }

  const items = await prisma.scheduledPost.findMany({
    where: { userId },
    include: SCHEDULED_POST_INCLUDE,
    orderBy: { scheduledAt: 'asc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const nextCursor = items.length === limit ? (items[items.length - 1]?.id ?? null) : null

  return {
    ok: true,
    items: items.map(formatScheduledPost),
    nextCursor,
  }
}

/**
 * 単一の予約投稿を取得する（所有者かつプレミアム必須）。
 * 他人や不存在は 404 で統一する（アクセス有無を秘匿）。
 */
export async function getScheduledPostV1(
  userId: string,
  id: string,
): Promise<GetScheduledPostResult> {
  const isPremium = await isPremiumUser(userId)
  if (!isPremium) return { ok: false, error: ERR_SCHEDULED_POST_PREMIUM_ONLY, status: 403 }

  const sp = await prisma.scheduledPost.findUnique({
    where: { id },
    include: SCHEDULED_POST_INCLUDE,
  })

  if (!sp) return { ok: false, error: ERR_SCHEDULED_POST_NOT_FOUND, status: 404 }
  if (sp.userId !== userId) return { ok: false, error: ERR_SCHEDULED_POST_ACCESS_DENIED, status: 404 }

  return { ok: true, item: formatScheduledPost(sp) }
}

/**
 * 予約投稿を新規作成する（プレミアム必須）。
 */
export async function createScheduledPostV1(
  userId: string,
  input: ScheduledPostCreateV1Input,
): Promise<CreateScheduledPostResult> {
  const isPremium = await isPremiumUser(userId)
  if (!isPremium) return { ok: false, error: ERR_SCHEDULED_POST_PREMIUM_ONLY, status: 403 }

  const { content, scheduledAt: scheduledAtStr, genreIds, mediaUrls, mediaTypes } = input

  const dateResult = validateScheduledAt(scheduledAtStr)
  if ('error' in dateResult) return { ok: false, error: dateResult.error, status: 400 }
  const { date: scheduledAt } = dateResult

  if (!content && mediaUrls.length === 0) return { ok: false, error: ERR_CONTENT_REQUIRED, status: 400 }

  const limits = await getMembershipLimits(userId)
  if (content && content.length > limits.maxPostLength) {
    return { ok: false, error: ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength), status: 400 }
  }
  if (genreIds.length > MAX_GENRES_PER_POST) {
    return { ok: false, error: ERR_GENRE_LIMIT(MAX_GENRES_PER_POST), status: 400 }
  }

  const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, limits)
  if (mediaValidation !== null) {
    const msg = !mediaValidation.success ? mediaValidation.error : ERR_CONTENT_REQUIRED
    return { ok: false, error: msg, status: 400 }
  }

  if (!assertMediaUrlsFromOwnStorage(mediaUrls)) {
    return { ok: false, error: ERR_MEDIA_URL_NOT_OWN_STORAGE, status: 400 }
  }

  const pendingCount = await prisma.scheduledPost.count({
    where: { userId, status: SCHEDULED_POST_STATUS.PENDING },
  })
  if (pendingCount >= MAX_PENDING_SCHEDULED_POSTS) {
    return { ok: false, error: ERR_SCHEDULED_POST_LIMIT(MAX_PENDING_SCHEDULED_POSTS), status: 400 }
  }

  const sp = await prisma.scheduledPost.create({
    data: {
      userId,
      content: content || null,
      scheduledAt,
      media: mediaUrls.length > 0 ? {
        create: mediaUrls.map((url: string, index: number) => ({
          url,
          type: mediaTypes[index] ?? 'image',
          sortOrder: index,
        })),
      } : undefined,
      genres: genreIds.length > 0 ? {
        create: genreIds.map((genreId: string) => ({ genreId })),
      } : undefined,
    },
  })

  return { ok: true, id: sp.id }
}

/**
 * 予約中（pending）の予約投稿を更新する（プレミアム必須）。
 */
export async function updateScheduledPostV1(
  userId: string,
  id: string,
  input: ScheduledPostUpdateV1Input,
): Promise<UpdateScheduledPostResult> {
  const isPremium = await isPremiumUser(userId)
  if (!isPremium) return { ok: false, error: ERR_SCHEDULED_POST_PREMIUM_ONLY, status: 403 }

  const existing = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })
  if (!existing) return { ok: false, error: ERR_SCHEDULED_POST_NOT_FOUND, status: 404 }
  if (existing.userId !== userId) return { ok: false, error: ERR_SCHEDULED_POST_UPDATE_DENIED, status: 404 }
  if (existing.status !== SCHEDULED_POST_STATUS.PENDING) {
    return { ok: false, error: ERR_SCHEDULED_POST_NOT_EDITABLE, status: 400 }
  }

  const { content, scheduledAt: scheduledAtStr, genreIds, mediaUrls, mediaTypes } = input

  const dateResult = validateScheduledAt(scheduledAtStr)
  if ('error' in dateResult) return { ok: false, error: dateResult.error, status: 400 }
  const { date: scheduledAt } = dateResult

  if (!content && mediaUrls.length === 0) return { ok: false, error: ERR_CONTENT_REQUIRED, status: 400 }

  const limits = await getMembershipLimits(userId)
  if (content && content.length > limits.maxPostLength) {
    return { ok: false, error: ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength), status: 400 }
  }
  if (genreIds.length > MAX_GENRES_PER_POST) {
    return { ok: false, error: ERR_GENRE_LIMIT(MAX_GENRES_PER_POST), status: 400 }
  }

  const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, limits)
  if (mediaValidation !== null) {
    const msg = !mediaValidation.success ? mediaValidation.error : ERR_CONTENT_REQUIRED
    return { ok: false, error: msg, status: 400 }
  }

  if (!assertMediaUrlsFromOwnStorage(mediaUrls)) {
    return { ok: false, error: ERR_MEDIA_URL_NOT_OWN_STORAGE, status: 400 }
  }

  await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.scheduledPostMedia.deleteMany({ where: { scheduledPostId: id } })
    await tx.scheduledPostGenre.deleteMany({ where: { scheduledPostId: id } })

    await tx.scheduledPost.update({
      where: { id },
      data: {
        content: content || null,
        scheduledAt,
        media: mediaUrls.length > 0 ? {
          create: mediaUrls.map((url: string, index: number) => ({
            url,
            type: mediaTypes[index] ?? 'image',
            sortOrder: index,
          })),
        } : undefined,
        genres: genreIds.length > 0 ? {
          create: genreIds.map((genreId: string) => ({ genreId })),
        } : undefined,
      },
    })
  })

  return { ok: true }
}

/**
 * 予約投稿をソフトキャンセルする（status を cancelled に変更。履歴として DB に残す）。
 * pending 状態のみキャンセル可能。
 */
export async function cancelScheduledPostV1(
  userId: string,
  id: string,
): Promise<CancelScheduledPostResult> {
  const sp = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })
  if (!sp) return { ok: false, error: ERR_SCHEDULED_POST_NOT_FOUND, status: 404 }
  if (sp.userId !== userId) return { ok: false, error: ERR_CANCEL_DENIED, status: 404 }
  if (sp.status !== SCHEDULED_POST_STATUS.PENDING) {
    return { ok: false, error: ERR_ONLY_SCHEDULED_CANCEL, status: 400 }
  }

  await prisma.scheduledPost.update({
    where: { id },
    data: { status: SCHEDULED_POST_STATUS.CANCELLED },
  })

  return { ok: true }
}

/**
 * 予約投稿をハード削除する（scheduled + media の実体も削除）。
 * 公開済み（published）のものは削除不可。
 */
export async function deleteScheduledPostV1(
  userId: string,
  id: string,
): Promise<DeleteScheduledPostResult> {
  const sp = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true, media: { select: { url: true } } },
  })
  if (!sp) return { ok: false, error: ERR_SCHEDULED_POST_NOT_FOUND, status: 404 }
  if (sp.userId !== userId) return { ok: false, error: ERR_PERMISSION_DENIED, status: 404 }
  if (sp.status === SCHEDULED_POST_STATUS.PUBLISHED) {
    return { ok: false, error: ERR_SCHEDULED_POST_PUBLISHED_DELETE, status: 400 }
  }

  await prisma.scheduledPost.delete({ where: { id } })

  // DB カスケード後にストレージ実体も回収（オーファン防止、best-effort）
  await deleteMediaFiles(sp.media.map((m) => m.url))

  return { ok: true }
}
