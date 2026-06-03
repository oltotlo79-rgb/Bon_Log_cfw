/**
 * 盆栽成長記録の Server Actions。追加・更新・削除と、タイムライン／盆栽別の一覧取得。
 *
 * @module lib/actions/bonsai-record
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { deleteMediaFiles } from '@/lib/services/media-cleanup'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { requireActiveNonGuestUser, requireAuth, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import logger from '@/lib/logger'
import { MAX_BONSAI_RECORD_IMAGES, MAX_BONSAI_DESCRIPTION_LENGTH } from '@/lib/constants/limits'
import { buildBonsaiPath } from '@/lib/constants/path-builders'
import {
  ERR_BONSAI_NOT_FOUND,
  ERR_BONSAI_RECORD_NOT_FOUND,
  ERR_BONSAI_RECORD_CREATE_FAILED,
  ERR_BONSAI_RECORD_UPDATE_FAILED,
  ERR_BONSAI_RECORD_DELETE_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'

const idSchema = z.string().min(1)

const addRecordSchema = z.object({
  bonsaiId: z.string().min(1),
  content: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
  recordAt: z.coerce.date().optional(),
  imageUrls: z.array(z.string().min(1)).max(MAX_BONSAI_RECORD_IMAGES).optional(),
})

const updateRecordSchema = z.object({
  content: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
  recordAt: z.coerce.date().optional(),
  imageUrls: z.array(z.string().min(1)).max(MAX_BONSAI_RECORD_IMAGES).optional(),
})

/**
 * 盆栽に成長記録を追加する。自分が所有する盆栽にのみ作成可能。
 */
export async function addBonsaiRecord(data: {
  bonsaiId: string
  content?: string
  recordAt?: Date
  imageUrls?: string[]
}) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = addRecordSchema.safeParse(data)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'create_bonsai_record')
  if (rl) return actionError(rl.error)

  try {
    const bonsai = await prisma.bonsai.findFirst({
      where: { id: parsed.data.bonsaiId, userId },
    })
    if (!bonsai) return actionError(ERR_BONSAI_NOT_FOUND)

    const record = await prisma.bonsaiRecord.create({
      data: {
        bonsaiId: parsed.data.bonsaiId,
        content: parsed.data.content,
        recordAt: parsed.data.recordAt || new Date(),
        images: parsed.data.imageUrls?.length
          ? {
              create: parsed.data.imageUrls.map((url: string, index: number) => ({
                url,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    revalidatePath(buildBonsaiPath(data.bonsaiId))
    return actionSuccess({ record })
  } catch (error) {
    logger.error('Add bonsai record error:', error)
    return actionError(ERR_BONSAI_RECORD_CREATE_FAILED)
  }
}

/**
 * 成長記録を更新する。`imageUrls` 指定時は既存画像を全削除してから再作成する。
 */
export async function updateBonsaiRecord(
  recordId: string,
  data: {
    content?: string
    recordAt?: Date
    imageUrls?: string[]
  }
) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!idSchema.safeParse(recordId).success) return actionError(ERR_INVALID_INPUT)
  const parsed = updateRecordSchema.safeParse(data)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'update_bonsai')
  if (rl) return actionError(rl.error)

  try {
    const existing = await prisma.bonsaiRecord.findFirst({
      where: { id: recordId },
      select: { id: true, bonsaiId: true, bonsai: { select: { userId: true } } },
    })
    if (!existing || existing.bonsai.userId !== userId) {
      return actionError(ERR_BONSAI_RECORD_NOT_FOUND)
    }

    if (parsed.data.imageUrls !== undefined) {
      await prisma.bonsaiRecordImage.deleteMany({ where: { recordId } })
    }

    const record = await prisma.bonsaiRecord.update({
      where: { id: recordId },
      data: {
        content: parsed.data.content,
        recordAt: parsed.data.recordAt,
        images: parsed.data.imageUrls?.length
          ? {
              create: parsed.data.imageUrls.map((url: string, index: number) => ({
                url,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    revalidatePath(buildBonsaiPath(existing.bonsaiId))
    return actionSuccess({ record })
  } catch (error) {
    logger.error('Update bonsai record error:', error)
    return actionError(ERR_BONSAI_RECORD_UPDATE_FAILED)
  }
}

/** 成長記録を削除する。関連画像はカスケードで削除される。 */
export async function deleteBonsaiRecord(recordId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!idSchema.safeParse(recordId).success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'delete_bonsai')
  if (rl) return actionError(rl.error)

  try {
    const existing = await prisma.bonsaiRecord.findFirst({
      where: { id: recordId },
      select: {
        id: true,
        bonsaiId: true,
        bonsai: { select: { userId: true } },
        images: { select: { url: true } },
      },
    })
    if (!existing || existing.bonsai.userId !== userId) {
      return actionError(ERR_BONSAI_RECORD_NOT_FOUND)
    }

    await prisma.bonsaiRecord.delete({ where: { id: recordId } })

    // DB カスケード後にストレージ実体も回収（オーファン防止、best-effort）
    await deleteMediaFiles(existing.images.map((i) => i.url))

    revalidatePath(buildBonsaiPath(existing.bonsaiId))
    return actionSuccess()
  } catch (error) {
    logger.error('Delete bonsai record error:', error)
    return actionError(ERR_BONSAI_RECORD_DELETE_FAILED)
  }
}

/**
 * 自分の盆栽の成長記録を最新順で取得する（マイ盆栽タイムライン）。
 * 盆栽は所有者専用リソースのため、対象を本人所有分に限定する。
 * カーソルベースページネーション。
 */
export async function getBonsaiTimeline(options: { cursor?: string; limit?: number } = {}) {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination(options)

  const authResult = await requireAuth()
  if ('error' in authResult) return actionSuccess({ records: [], nextCursor: undefined })
  const userId = authResult.userId

  try {
    const records = await prisma.bonsaiRecord.findMany({
      where: { bonsai: { userId } },
      take: safeLimit,
      ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
      orderBy: [{ recordAt: 'desc' }, { id: 'desc' }],
      include: {
        bonsai: {
          include: {
            user: USER_MINIMAL_RELATION,
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    const nextCursor = records.length === safeLimit ? records[records.length - 1]?.id : undefined
    return actionSuccess({ records, nextCursor })
  } catch (error) {
    logger.error('Get bonsai timeline error:', error)
    return actionSuccess({ records: [], nextCursor: undefined })
  }
}

/**
 * 特定盆栽の成長記録を最新順で取得する。マイ盆栽は所有者専用のため、
 * 本人が所有する盆栽のみ記録を返し、それ以外は空で返す。
 * カーソルベースページネーション。
 */
export async function getBonsaiRecords(
  bonsaiId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination(options)

  if (!idSchema.safeParse(bonsaiId).success) return actionSuccess({ records: [], nextCursor: undefined })

  const authResult = await requireAuth()
  if ('error' in authResult) return actionSuccess({ records: [], nextCursor: undefined })
  const userId = authResult.userId

  try {
    const bonsai = await prisma.bonsai.findUnique({
      where: { id: bonsaiId },
      select: { userId: true },
    })
    if (!bonsai || bonsai.userId !== userId) {
      return actionSuccess({ records: [], nextCursor: undefined })
    }

    const records = await prisma.bonsaiRecord.findMany({
      where: { bonsaiId },
      take: safeLimit,
      ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
      orderBy: [{ recordAt: 'desc' }, { id: 'desc' }],
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    const nextCursor = records.length === safeLimit ? records[records.length - 1]?.id : undefined
    return actionSuccess({ records, nextCursor })
  } catch (error) {
    logger.error('Get bonsai records error:', error)
    return actionSuccess({ records: [], nextCursor: undefined })
  }
}
