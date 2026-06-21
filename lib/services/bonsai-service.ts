/**
 * @module lib/services/bonsai-service
 * モバイル API v1 向け盆栽 CRUD サービス層。
 *
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 * Web の lib/actions/bonsai.ts と同等のロジックを Bearer 経路向けに提供する。
 * Web 側 Server Actions は無編集。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { deleteMediaFiles } from '@/lib/services/media-cleanup'
import logger from '@/lib/logger'
import {
  MAX_BONSAI_NAME_LENGTH,
  MAX_BONSAI_SPECIES_LENGTH,
  MAX_BONSAI_DESCRIPTION_LENGTH,
  MAX_BONSAI_LIST_LIMIT,
  DEFAULT_PAGE_LIMIT,
} from '@/lib/constants/limits'
import {
  ERR_BONSAI_NOT_FOUND,
  ERR_BONSAI_CREATE_FAILED,
  ERR_BONSAI_UPDATE_FAILED,
  ERR_BONSAI_DELETE_FAILED,
  ERR_BONSAI_LIST_FAILED,
  ERR_BONSAI_GET_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import { z } from 'zod'

// ──────────────────────────────────────────────────
// Zod スキーマ（route handler と OpenAPI で共用）
// ──────────────────────────────────────────────────

export const createBonsaiV1Schema = z.object({
  name: z.string().min(1).max(MAX_BONSAI_NAME_LENGTH),
  species: z.string().max(MAX_BONSAI_SPECIES_LENGTH).optional(),
  acquiredAt: z.string().datetime().optional(),
  description: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
})
export type CreateBonsaiV1Input = z.infer<typeof createBonsaiV1Schema>

export const updateBonsaiV1Schema = z.object({
  name: z.string().min(1).max(MAX_BONSAI_NAME_LENGTH).optional(),
  species: z.string().max(MAX_BONSAI_SPECIES_LENGTH).optional(),
  acquiredAt: z.string().datetime().nullable().optional(),
  description: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
})
export type UpdateBonsaiV1Input = z.infer<typeof updateBonsaiV1Schema>

// ──────────────────────────────────────────────────
// 内部 Prisma include
// ──────────────────────────────────────────────────

/**
 * 一覧取得用 include。最新記録 1 件 + サムネイル画像を付ける。
 * Web の BONSAI_INCLUDE_BASE と同等。
 */
const BONSAI_LIST_INCLUDE = {
  records: {
    orderBy: { recordAt: 'desc' as const },
    take: 1,
    include: {
      images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
    },
  },
  _count: { select: { records: true } },
} as const

/** 詳細取得用 include（画像全件付き） */
const BONSAI_DETAIL_INCLUDE = {
  _count: { select: { records: true } },
} as const

// ──────────────────────────────────────────────────
// Service 関数
// ──────────────────────────────────────────────────

export interface BonsaiListResult {
  ok: true
  items: BonsaiListItem[]
  nextCursor: string | null
}
export interface BonsaiListError {
  ok: false
  status: number
  error: string
}

export interface BonsaiDetailResult {
  ok: true
  bonsai: BonsaiDetail
}
export interface BonsaiDetailError {
  ok: false
  status: number
  error: string
}

export interface BonsaiCreateResult {
  ok: true
  bonsai: BonsaiDetail
}
export interface BonsaiCreateError {
  ok: false
  status: number
  error: string
}

export interface BonsaiMutateResult {
  ok: true
  bonsai: BonsaiDetail
}
export interface BonsaiMutateError {
  ok: false
  status: number
  error: string
}

export interface BonsaiDeleteResult {
  ok: true
}
export interface BonsaiDeleteError {
  ok: false
  status: number
  error: string
}

export type BonsaiListItem = {
  id: string
  name: string
  species: string | null
  acquiredAt: Date | null
  description: string | null
  createdAt: Date
  updatedAt: Date
  recordCount: number
  latestRecord: {
    id: string
    content: string | null
    recordAt: Date
    thumbnailUrl: string | null
  } | null
}

export type BonsaiDetail = {
  id: string
  name: string
  species: string | null
  acquiredAt: Date | null
  description: string | null
  createdAt: Date
  updatedAt: Date
  recordCount: number
}

/**
 * 認証済みユーザーの盆栽一覧を取得する（カーソルページネーション）。
 */
export async function listBonsaiV1(
  userId: string,
  cursor?: string,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<BonsaiListResult | BonsaiListError> {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_BONSAI_LIST_LIMIT)

  try {
    const items = await prisma.bonsai.findMany({
      where: { userId },
      include: BONSAI_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const nextCursor = items.length === safeLimit ? (items[items.length - 1]?.id ?? null) : null

    const mapped: BonsaiListItem[] = items.map((b) => {
      const latest = b.records[0]
      return {
        id: b.id,
        name: b.name,
        species: b.species,
        acquiredAt: b.acquiredAt,
        description: b.description,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        recordCount: b._count.records,
        latestRecord: latest
          ? {
              id: latest.id,
              content: latest.content,
              recordAt: latest.recordAt,
              thumbnailUrl: latest.images[0]?.url ?? null,
            }
          : null,
      }
    })

    return { ok: true, items: mapped, nextCursor }
  } catch (error) {
    logger.error({ err: error, userId }, 'listBonsaiV1 failed')
    return { ok: false, status: 500, error: ERR_BONSAI_LIST_FAILED }
  }
}

/**
 * 盆栽詳細を取得する。所有者以外・不存在は 404。
 */
export async function getBonsaiV1(
  userId: string,
  bonsaiId: string,
): Promise<BonsaiDetailResult | BonsaiDetailError> {
  try {
    const bonsai = await prisma.bonsai.findUnique({
      where: { id: bonsaiId },
      include: BONSAI_DETAIL_INCLUDE,
    })

    // 不存在・所有者でない場合は存在を秘匿して 404
    if (!bonsai || bonsai.userId !== userId) {
      return { ok: false, status: 404, error: ERR_BONSAI_NOT_FOUND }
    }

    return {
      ok: true,
      bonsai: {
        id: bonsai.id,
        name: bonsai.name,
        species: bonsai.species,
        acquiredAt: bonsai.acquiredAt,
        description: bonsai.description,
        createdAt: bonsai.createdAt,
        updatedAt: bonsai.updatedAt,
        recordCount: bonsai._count.records,
      },
    }
  } catch (error) {
    logger.error({ err: error, userId, bonsaiId }, 'getBonsaiV1 failed')
    return { ok: false, status: 500, error: ERR_BONSAI_GET_FAILED }
  }
}

/**
 * 盆栽を新規作成する。
 */
export async function createBonsaiV1(
  userId: string,
  input: CreateBonsaiV1Input,
): Promise<BonsaiCreateResult | BonsaiCreateError> {
  const parsed = createBonsaiV1Schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: ERR_INVALID_INPUT }
  }

  try {
    const bonsai = await prisma.bonsai.create({
      data: {
        userId,
        name: parsed.data.name,
        species: parsed.data.species,
        acquiredAt: parsed.data.acquiredAt ? new Date(parsed.data.acquiredAt) : undefined,
        description: parsed.data.description,
      },
      include: BONSAI_DETAIL_INCLUDE,
    })

    return {
      ok: true,
      bonsai: {
        id: bonsai.id,
        name: bonsai.name,
        species: bonsai.species,
        acquiredAt: bonsai.acquiredAt,
        description: bonsai.description,
        createdAt: bonsai.createdAt,
        updatedAt: bonsai.updatedAt,
        recordCount: bonsai._count.records,
      },
    }
  } catch (error) {
    logger.error({ err: error, userId }, 'createBonsaiV1 failed')
    return { ok: false, status: 500, error: ERR_BONSAI_CREATE_FAILED }
  }
}

/**
 * 盆栽を更新する。所有者以外・不存在は 404。
 */
export async function updateBonsaiV1(
  userId: string,
  bonsaiId: string,
  input: UpdateBonsaiV1Input,
): Promise<BonsaiMutateResult | BonsaiMutateError> {
  const parsed = updateBonsaiV1Schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: ERR_INVALID_INPUT }
  }

  try {
    const existing = await prisma.bonsai.findFirst({
      where: { id: bonsaiId, userId },
    })
    if (!existing) {
      return { ok: false, status: 404, error: ERR_BONSAI_NOT_FOUND }
    }

    // acquiredAt: null を明示的に渡すと DB 上の値をクリアする
    const acquiredAt =
      parsed.data.acquiredAt === null
        ? null
        : parsed.data.acquiredAt !== undefined
          ? new Date(parsed.data.acquiredAt)
          : undefined

    const bonsai = await prisma.bonsai.update({
      where: { id: bonsaiId },
      data: {
        name: parsed.data.name,
        species: parsed.data.species,
        acquiredAt,
        description: parsed.data.description,
      },
      include: BONSAI_DETAIL_INCLUDE,
    })

    return {
      ok: true,
      bonsai: {
        id: bonsai.id,
        name: bonsai.name,
        species: bonsai.species,
        acquiredAt: bonsai.acquiredAt,
        description: bonsai.description,
        createdAt: bonsai.createdAt,
        updatedAt: bonsai.updatedAt,
        recordCount: bonsai._count.records,
      },
    }
  } catch (error) {
    logger.error({ err: error, userId, bonsaiId }, 'updateBonsaiV1 failed')
    return { ok: false, status: 500, error: ERR_BONSAI_UPDATE_FAILED }
  }
}

/**
 * 盆栽を削除する。関連記録・画像はカスケード削除。
 * ストレージ実体は best-effort で回収する（Web と同等の挙動）。
 */
export async function deleteBonsaiV1(
  userId: string,
  bonsaiId: string,
): Promise<BonsaiDeleteResult | BonsaiDeleteError> {
  try {
    const existing = await prisma.bonsai.findFirst({
      where: { id: bonsaiId, userId },
      include: { records: { select: { images: { select: { url: true } } } } },
    })
    if (!existing) {
      return { ok: false, status: 404, error: ERR_BONSAI_NOT_FOUND }
    }

    await prisma.bonsai.delete({ where: { id: bonsaiId } })

    // DB カスケード後にストレージ実体を回収（best-effort）
    await deleteMediaFiles(existing.records.flatMap((r) => r.images.map((i) => i.url)))

    return { ok: true }
  } catch (error) {
    logger.error({ err: error, userId, bonsaiId }, 'deleteBonsaiV1 failed')
    return { ok: false, status: 500, error: ERR_BONSAI_DELETE_FAILED }
  }
}
