/**
 * @module lib/services/bonsai-record-service
 * モバイル API v1 向け盆栽成長記録 CRUD サービス層。
 *
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 * Web の lib/actions/bonsai-record.ts と同等のロジックを Bearer 経路向けに提供する。
 * Web 側 Server Actions は無編集。
 *
 * mediaUrls の検証方針（v1 のみ厳格化）:
 * Web は URL 文字列存在チェックのみ。v1 は assertMediaUrlsFromOwnStorage() により
 * 自社ストレージドメイン許可リスト検証を追加する。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { deleteMediaFiles } from '@/lib/services/media-cleanup'
import { assertMediaUrlsFromOwnStorage } from '@/lib/services/media-url-validator'
import logger from '@/lib/logger'
import {
  MAX_BONSAI_DESCRIPTION_LENGTH,
  MAX_BONSAI_RECORD_IMAGES,
  MAX_PAGE_LIMIT,
  DEFAULT_PAGE_LIMIT,
} from '@/lib/constants/limits'
import {
  ERR_BONSAI_NOT_FOUND,
  ERR_BONSAI_RECORD_NOT_FOUND,
  ERR_BONSAI_RECORD_LIST_FAILED,
  ERR_BONSAI_RECORD_CREATE_FAILED,
  ERR_BONSAI_RECORD_UPDATE_FAILED,
  ERR_BONSAI_RECORD_DELETE_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import { ERR_MEDIA_URL_NOT_OWN_STORAGE } from '@/lib/constants/errors'
import { z } from 'zod'

// ──────────────────────────────────────────────────
// Zod スキーマ（route handler と OpenAPI で共用）
// ──────────────────────────────────────────────────

export const createBonsaiRecordV1Schema = z.object({
  content: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
  recordAt: z.string().datetime(),
  mediaUrls: z.array(z.string().url()).max(MAX_BONSAI_RECORD_IMAGES).default([]),
})
export type CreateBonsaiRecordV1Input = z.infer<typeof createBonsaiRecordV1Schema>

export const updateBonsaiRecordV1Schema = z.object({
  content: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
  recordAt: z.string().datetime().optional(),
  mediaUrls: z.array(z.string().url()).max(MAX_BONSAI_RECORD_IMAGES).optional(),
})
export type UpdateBonsaiRecordV1Input = z.infer<typeof updateBonsaiRecordV1Schema>

// ──────────────────────────────────────────────────
// 戻り値型
// ──────────────────────────────────────────────────

export type BonsaiRecordImage = {
  url: string
  sortOrder: number
}

export type BonsaiRecordItem = {
  id: string
  content: string | null
  recordAt: Date
  images: BonsaiRecordImage[]
}

export interface BonsaiRecordListResult {
  ok: true
  items: BonsaiRecordItem[]
  nextCursor: string | null
}
export interface BonsaiRecordListError {
  ok: false
  status: number
  error: string
}

export interface BonsaiRecordCreateResult {
  ok: true
  record: BonsaiRecordItem
}
export interface BonsaiRecordCreateError {
  ok: false
  status: number
  error: string
}

export interface BonsaiRecordMutateResult {
  ok: true
  record: BonsaiRecordItem
}
export interface BonsaiRecordMutateError {
  ok: false
  status: number
  error: string
}

export interface BonsaiRecordDeleteResult {
  ok: true
}
export interface BonsaiRecordDeleteError {
  ok: false
  status: number
  error: string
}

// ──────────────────────────────────────────────────
// Service 関数
// ──────────────────────────────────────────────────

/**
 * 特定盆栽の成長記録一覧を取得する（カーソルページネーション）。
 * 所有者確認を行い、他人の盆栽・不存在は 404。
 */
export async function listBonsaiRecordsV1(
  userId: string,
  bonsaiId: string,
  cursor?: string,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<BonsaiRecordListResult | BonsaiRecordListError> {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_PAGE_LIMIT)

  try {
    const bonsai = await prisma.bonsai.findUnique({
      where: { id: bonsaiId },
      select: { userId: true },
    })

    if (!bonsai || bonsai.userId !== userId) {
      return { ok: false, status: 404, error: ERR_BONSAI_NOT_FOUND }
    }

    const records = await prisma.bonsaiRecord.findMany({
      where: { bonsaiId },
      take: safeLimit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ recordAt: 'desc' }, { id: 'desc' }],
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    const nextCursor =
      records.length === safeLimit ? (records[records.length - 1]?.id ?? null) : null

    const items: BonsaiRecordItem[] = records.map((r) => ({
      id: r.id,
      content: r.content,
      recordAt: r.recordAt,
      images: r.images.map((img) => ({ url: img.url, sortOrder: img.sortOrder })),
    }))

    return { ok: true, items, nextCursor }
  } catch (error) {
    logger.error({ err: error, userId, bonsaiId }, 'listBonsaiRecordsV1 failed')
    return { ok: false, status: 500, error: ERR_BONSAI_RECORD_LIST_FAILED }
  }
}

/**
 * 成長記録を作成する。所有者確認あり。
 * mediaUrls は自社ストレージドメイン許可リスト検証を行う。
 */
export async function createBonsaiRecordV1(
  userId: string,
  bonsaiId: string,
  input: CreateBonsaiRecordV1Input,
): Promise<BonsaiRecordCreateResult | BonsaiRecordCreateError> {
  const parsed = createBonsaiRecordV1Schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: ERR_INVALID_INPUT }
  }

  if (parsed.data.mediaUrls.length > 0 && !assertMediaUrlsFromOwnStorage(parsed.data.mediaUrls)) {
    return { ok: false, status: 400, error: ERR_MEDIA_URL_NOT_OWN_STORAGE }
  }

  try {
    const bonsai = await prisma.bonsai.findFirst({
      where: { id: bonsaiId, userId },
    })
    if (!bonsai) {
      return { ok: false, status: 404, error: ERR_BONSAI_NOT_FOUND }
    }

    const record = await prisma.bonsaiRecord.create({
      data: {
        bonsaiId,
        content: parsed.data.content,
        recordAt: new Date(parsed.data.recordAt),
        images: parsed.data.mediaUrls.length
          ? {
              create: parsed.data.mediaUrls.map((url, index) => ({
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

    return {
      ok: true,
      record: {
        id: record.id,
        content: record.content,
        recordAt: record.recordAt,
        images: record.images.map((img) => ({ url: img.url, sortOrder: img.sortOrder })),
      },
    }
  } catch (error) {
    logger.error({ err: error, userId, bonsaiId }, 'createBonsaiRecordV1 failed')
    return { ok: false, status: 500, error: ERR_BONSAI_RECORD_CREATE_FAILED }
  }
}

/**
 * 成長記録を更新する。所有者確認あり（bonsai 経由で確認）。
 * mediaUrls 指定時は既存画像を全削除して再作成する（Web と同等の挙動）。
 */
export async function updateBonsaiRecordV1(
  userId: string,
  bonsaiId: string,
  recordId: string,
  input: UpdateBonsaiRecordV1Input,
): Promise<BonsaiRecordMutateResult | BonsaiRecordMutateError> {
  const parsed = updateBonsaiRecordV1Schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: ERR_INVALID_INPUT }
  }

  if (
    parsed.data.mediaUrls !== undefined &&
    parsed.data.mediaUrls.length > 0 &&
    !assertMediaUrlsFromOwnStorage(parsed.data.mediaUrls)
  ) {
    return { ok: false, status: 400, error: ERR_MEDIA_URL_NOT_OWN_STORAGE }
  }

  try {
    const existing = await prisma.bonsaiRecord.findFirst({
      where: { id: recordId },
      select: {
        id: true,
        bonsaiId: true,
        bonsai: { select: { userId: true } },
      },
    })

    // bonsai 経由で所有者確認。bonsaiId 一致も確認してパス改ざん防止
    if (
      !existing ||
      existing.bonsai.userId !== userId ||
      existing.bonsaiId !== bonsaiId
    ) {
      return { ok: false, status: 404, error: ERR_BONSAI_RECORD_NOT_FOUND }
    }

    if (parsed.data.mediaUrls !== undefined) {
      await prisma.bonsaiRecordImage.deleteMany({ where: { recordId } })
    }

    const record = await prisma.bonsaiRecord.update({
      where: { id: recordId },
      data: {
        content: parsed.data.content,
        recordAt: parsed.data.recordAt ? new Date(parsed.data.recordAt) : undefined,
        images:
          parsed.data.mediaUrls?.length
            ? {
                create: parsed.data.mediaUrls.map((url, index) => ({
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

    return {
      ok: true,
      record: {
        id: record.id,
        content: record.content,
        recordAt: record.recordAt,
        images: record.images.map((img) => ({ url: img.url, sortOrder: img.sortOrder })),
      },
    }
  } catch (error) {
    logger.error({ err: error, userId, bonsaiId, recordId }, 'updateBonsaiRecordV1 failed')
    return { ok: false, status: 500, error: ERR_BONSAI_RECORD_UPDATE_FAILED }
  }
}

/**
 * 成長記録を削除する。所有者確認あり（bonsai 経由で確認）。
 * 関連画像はカスケード削除。ストレージ実体は best-effort で回収。
 */
export async function deleteBonsaiRecordV1(
  userId: string,
  bonsaiId: string,
  recordId: string,
): Promise<BonsaiRecordDeleteResult | BonsaiRecordDeleteError> {
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

    if (
      !existing ||
      existing.bonsai.userId !== userId ||
      existing.bonsaiId !== bonsaiId
    ) {
      return { ok: false, status: 404, error: ERR_BONSAI_RECORD_NOT_FOUND }
    }

    await prisma.bonsaiRecord.delete({ where: { id: recordId } })

    // DB カスケード後にストレージ実体を回収（best-effort）
    await deleteMediaFiles(existing.images.map((i) => i.url))

    return { ok: true }
  } catch (error) {
    logger.error({ err: error, userId, bonsaiId, recordId }, 'deleteBonsaiRecordV1 failed')
    return { ok: false, status: 500, error: ERR_BONSAI_RECORD_DELETE_FAILED }
  }
}
