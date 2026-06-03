/**
 * 予約投稿のCRUD操作（ユーザー向け）のServer Actions
 *
 * 予約投稿の公開バッチ処理は scheduled-post-publish.ts を参照。
 *
 * @module lib/actions/scheduled-post-crud
 */

'use server'

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { deleteMediaFiles } from '@/lib/services/media-cleanup'
import {
  requireActiveNonGuestUser,
  actionSuccess,
  actionError,
  validateMediaCounts,
  enforceUserRateLimit,
} from '@/lib/actions/utils'
import { actionZodError } from '@/lib/actions/schemas/common'
import { POST_GENRE_RELATION } from '@/lib/prisma/shared-includes'
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  MAX_GENRES_PER_POST,
  MAX_SCHEDULED_DAYS_AHEAD,
  MAX_PENDING_SCHEDULED_POSTS,
  MAX_POST_CONTENT_PREMIUM,
} from '@/lib/constants/limits'
import {
  ERR_CONTENT_REQUIRED,
  ERR_CANCEL_DENIED,
  ERR_ONLY_SCHEDULED_CANCEL,
  ERR_SCHEDULED_POST_PREMIUM_ONLY,
  ERR_SCHEDULED_POST_DATE_REQUIRED,
  ERR_SCHEDULED_POST_FUTURE_REQUIRED,
  ERR_SCHEDULED_POST_NOT_FOUND,
  ERR_SCHEDULED_POST_ACCESS_DENIED,
  ERR_SCHEDULED_POST_UPDATE_DENIED,
  ERR_SCHEDULED_POST_NOT_EDITABLE,
  ERR_SCHEDULED_POST_PUBLISHED_DELETE,
  ERR_PERMISSION_DENIED,
  ERR_POST_CONTENT_TOO_LONG,
  ERR_GENRE_LIMIT,
  ERR_SCHEDULED_DATE_TOO_FAR,
  ERR_SCHEDULED_POST_LIMIT,
} from '@/lib/constants/errors'
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'
import { ROUTE_SCHEDULED_POSTS } from '@/lib/constants/routes'
import { mediaUrlListSchema, mediaTypeListSchema } from '@/lib/actions/schemas/common'

type TransactionClient = Prisma.TransactionClient

const createScheduledPostSchema = z.object({
  content: z.string().max(MAX_POST_CONTENT_PREMIUM).optional().default(''),
  scheduledAt: z.string().min(1, ERR_SCHEDULED_POST_DATE_REQUIRED),
  genreIds: z.array(z.string()).max(MAX_GENRES_PER_POST, ERR_GENRE_LIMIT(MAX_GENRES_PER_POST)).default([]),
  mediaUrls: mediaUrlListSchema,
  mediaTypes: mediaTypeListSchema,
})

const updateScheduledPostSchema = createScheduledPostSchema

/**
 * 予約投稿を新規作成する（プレミアム会員のみ）。
 * 予約日時は未来かつ MAX_SCHEDULED_DAYS_AHEAD 日以内、
 * pending 件数は MAX_PENDING_SCHEDULED_POSTS を超えないこと。
 */
export async function createScheduledPost(formData: FormData) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const isPremium = await isPremiumUser(userId)
  if (!isPremium) return actionError(ERR_SCHEDULED_POST_PREMIUM_ONLY)

  const parsed = createScheduledPostSchema.safeParse({
    content: formData.get('content') || '',
    scheduledAt: formData.get('scheduledAt') || '',
    genreIds: formData.getAll('genreIds'),
    mediaUrls: formData.getAll('mediaUrls'),
    mediaTypes: formData.getAll('mediaTypes'),
  })
  if (!parsed.success) {
    return actionZodError(parsed.error)
  }

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  const { content, scheduledAt: scheduledAtStr, genreIds, mediaUrls, mediaTypes } = parsed.data
  const scheduledAt = new Date(scheduledAtStr)

  if (scheduledAt <= new Date()) return actionError(ERR_SCHEDULED_POST_FUTURE_REQUIRED)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + MAX_SCHEDULED_DAYS_AHEAD)
  if (scheduledAt > maxDate) return actionError(ERR_SCHEDULED_DATE_TOO_FAR(MAX_SCHEDULED_DAYS_AHEAD))

  if (!content && mediaUrls.length === 0) return actionError(ERR_CONTENT_REQUIRED)

  const limits = await getMembershipLimits(userId)
  if (content && content.length > limits.maxPostLength) {
    return actionError(ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength))
  }
  if (genreIds.length > MAX_GENRES_PER_POST) {
    return actionError(ERR_GENRE_LIMIT(MAX_GENRES_PER_POST))
  }

  const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, limits)
  if (mediaValidation) return mediaValidation

  const pendingCount = await prisma.scheduledPost.count({
    where: { userId, status: SCHEDULED_POST_STATUS.PENDING },
  })
  if (pendingCount >= MAX_PENDING_SCHEDULED_POSTS) {
    return actionError(ERR_SCHEDULED_POST_LIMIT(MAX_PENDING_SCHEDULED_POSTS))
  }

  const scheduledPost = await prisma.scheduledPost.create({
    data: {
      userId,
      content: content || null,
      scheduledAt,
      media: mediaUrls.length > 0 ? {
        create: mediaUrls.map((url: string, index: number) => ({
          url,
          type: mediaTypes[index] || 'image',
          sortOrder: index,
        })),
      } : undefined,
      genres: genreIds.length > 0 ? {
        create: genreIds.map((genreId: string) => ({ genreId })),
      } : undefined,
    },
  })

  revalidatePath(ROUTE_SCHEDULED_POSTS)
  return actionSuccess({ scheduledPostId: scheduledPost.id })
}

/**
 * 自分の予約投稿一覧を予約日時の早い順で取得する（プレミアム会員のみ）。
 */
export async function getScheduledPosts() {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const isPremium = await isPremiumUser(userId)
  if (!isPremium) return actionError(ERR_SCHEDULED_POST_PREMIUM_ONLY)

  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: { userId },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      genres: POST_GENRE_RELATION,
    },
    orderBy: { scheduledAt: 'asc' },
  })

  return actionSuccess({
    scheduledPosts: scheduledPosts.map((sp: typeof scheduledPosts[number]) => ({
      ...sp,
      genres: sp.genres.map((g: { genre: typeof sp.genres[number]['genre'] }) => g.genre),
    })),
  })
}

/**
 * 単一の予約投稿を取得する（所有者のみ）。
 */
export async function getScheduledPost(id: string) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      genres: POST_GENRE_RELATION,
    },
  })

  if (!scheduledPost) return actionError(ERR_SCHEDULED_POST_NOT_FOUND)
  if (scheduledPost.userId !== userId) return actionError(ERR_SCHEDULED_POST_ACCESS_DENIED)

  return actionSuccess({
    scheduledPost: {
      ...scheduledPost,
      genres: scheduledPost.genres.map((g: { genre: typeof scheduledPost.genres[number]['genre'] }) => g.genre),
    },
  })
}

/**
 * 予約中（pending）の予約投稿の内容を更新する。
 */
export async function updateScheduledPost(id: string, formData: FormData) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  // mediaTypes は enum に合わない値を 'image' にフォールバックしてから Zod に渡す
  const validMediaTypes = new Set<string>(['image', 'video'])
  const normalizedMediaTypes = formData
    .getAll('mediaTypes')
    .map((t) => (typeof t === 'string' && validMediaTypes.has(t) ? t : 'image'))

  const parsed = updateScheduledPostSchema.safeParse({
    content: formData.get('content') || '',
    scheduledAt: formData.get('scheduledAt') || '',
    genreIds: formData.getAll('genreIds'),
    mediaUrls: formData.getAll('mediaUrls'),
    mediaTypes: normalizedMediaTypes,
  })
  if (!parsed.success) {
    return actionZodError(parsed.error)
  }
  const { content, scheduledAt: scheduledAtStr, genreIds, mediaUrls, mediaTypes } = parsed.data

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  // DB lookup は Zod 検証 + rate limit の後に実施 (不正入力で DB 一往復させない / 任意 id 探索を防ぐ)。
  const existing = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })
  if (!existing) return actionError(ERR_SCHEDULED_POST_NOT_FOUND)
  if (existing.userId !== userId) return actionError(ERR_SCHEDULED_POST_UPDATE_DENIED)
  if (existing.status !== SCHEDULED_POST_STATUS.PENDING) {
    return actionError(ERR_SCHEDULED_POST_NOT_EDITABLE)
  }

  const scheduledAt = new Date(scheduledAtStr)
  if (scheduledAt <= new Date()) return actionError(ERR_SCHEDULED_POST_FUTURE_REQUIRED)

  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + MAX_SCHEDULED_DAYS_AHEAD)
  if (scheduledAt > maxDate) return actionError(ERR_SCHEDULED_DATE_TOO_FAR(MAX_SCHEDULED_DAYS_AHEAD))

  if (!content && mediaUrls.length === 0) return actionError(ERR_CONTENT_REQUIRED)

  const limits = await getMembershipLimits(userId)
  if (content && content.length > limits.maxPostLength) {
    return actionError(ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength))
  }
  const mediaValidationUpdate = await validateMediaCounts(mediaUrls, mediaTypes, limits)
  if (mediaValidationUpdate) return mediaValidationUpdate

  // トランザクションで既存メディア・ジャンルを削除し、新しい内容で差し替える
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
            type: mediaTypes[index] || 'image',
            sortOrder: index,
          })),
        } : undefined,
        genres: genreIds.length > 0 ? {
          create: genreIds.map((genreId: string) => ({ genreId })),
        } : undefined,
      },
    })
  })

  revalidatePath(ROUTE_SCHEDULED_POSTS)
  return actionSuccess()
}

/**
 * 予約投稿を削除する。公開済みのものは削除不可。
 */
export async function deleteScheduledPost(id: string) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  // id のみの操作のため Zod は無いが、任意 id 探索を消費させないよう DB lookup の前に実施する。
  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true, media: { select: { url: true } } },
  })
  if (!scheduledPost) return actionError(ERR_SCHEDULED_POST_NOT_FOUND)
  if (scheduledPost.userId !== userId) return actionError(ERR_PERMISSION_DENIED)
  if (scheduledPost.status === SCHEDULED_POST_STATUS.PUBLISHED) {
    return actionError(ERR_SCHEDULED_POST_PUBLISHED_DELETE)
  }

  await prisma.scheduledPost.delete({ where: { id } })

  // DB カスケード後にストレージ実体も回収（オーファン防止、best-effort）
  await deleteMediaFiles(scheduledPost.media.map((m) => m.url))

  revalidatePath(ROUTE_SCHEDULED_POSTS)
  return actionSuccess()
}

/**
 * 予約投稿をキャンセルする（status を cancelled に変更。履歴として残る）。
 * pending 状態のもののみキャンセル可能。
 */
export async function cancelScheduledPost(id: string) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  // id のみの操作のため Zod は無いが、任意 id 探索を消費させないよう DB lookup の前に実施する。
  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })
  if (!scheduledPost) return actionError(ERR_SCHEDULED_POST_NOT_FOUND)
  if (scheduledPost.userId !== userId) return actionError(ERR_CANCEL_DENIED)
  if (scheduledPost.status !== SCHEDULED_POST_STATUS.PENDING) {
    return actionError(ERR_ONLY_SCHEDULED_CANCEL)
  }

  await prisma.scheduledPost.update({
    where: { id },
    data: { status: SCHEDULED_POST_STATUS.CANCELLED },
  })

  revalidatePath(ROUTE_SCHEDULED_POSTS)
  return actionSuccess()
}
