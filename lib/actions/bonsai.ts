/**
 * 盆栽管理機能の Server Actions。
 * 盆栽本体（Bonsai）の一覧・詳細・登録・更新・削除・検索を提供する。
 * 成長記録（BonsaiRecord）の操作は `./bonsai-record` に委譲し、
 * 後方互換のためここから再エクスポートする。
 *
 * @module lib/actions/bonsai
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { revalidatePath } from 'next/cache'
import logger from '@/lib/logger'
import { rateLimit, RATE_LIMITS, checkUserRateLimit } from '@/lib/rate-limit'
import { getClientIp, requireAuth, requireActiveNonGuestUser, actionSuccess, actionError } from '@/lib/actions/utils'
import { containsInsensitive } from '@/lib/actions/prisma-filters'
import {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_BONSAI_LIST_LIMIT,
  BONSAI_TIMELINE_LIMIT,
  MAX_BONSAI_NAME_LENGTH,
  MAX_BONSAI_SPECIES_LENGTH,
  MAX_BONSAI_DESCRIPTION_LENGTH,
} from '@/lib/constants/limits'
import { ROUTE_BONSAI } from '@/lib/constants/routes'
import { buildBonsaiPath } from '@/lib/constants/path-builders'
import {
  ERR_RATE_LIMIT_OPERATION,
  ERR_BONSAI_NOT_FOUND,
  ERR_BONSAI_LIST_FAILED,
  ERR_BONSAI_GET_FAILED,
  ERR_BONSAI_CREATE_FAILED,
  ERR_BONSAI_UPDATE_FAILED,
  ERR_BONSAI_DELETE_FAILED,
  ERR_BONSAI_SEARCH_FAILED,
  ERR_SEARCH_RATE_LIMIT,
  ERR_INVALID_BONSAI_ID,
  ERR_INVALID_INPUT,
  ERR_BONSAI_SEARCH_QUERY_TOO_LONG,
} from '@/lib/constants/errors'

const optionalIdSchema = z.string().min(1).optional()
const idSchema = z.string().min(1)

const createBonsaiSchema = z.object({
  name: z.string().min(1).max(MAX_BONSAI_NAME_LENGTH),
  species: z.string().max(MAX_BONSAI_SPECIES_LENGTH).optional(),
  acquiredAt: z.coerce.date().optional(),
  description: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
})

const updateBonsaiSchema = z.object({
  name: z.string().min(1).max(MAX_BONSAI_NAME_LENGTH).optional(),
  species: z.string().max(MAX_BONSAI_SPECIES_LENGTH).optional(),
  acquiredAt: z.coerce.date().nullable().optional(),
  description: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
})

/** `getBonsais` / `searchBonsais` で共用する include。最新記録 1 件とサムネイル画像を付ける。 */
const BONSAI_INCLUDE_BASE = {
  records: {
    orderBy: { recordAt: 'desc' as const },
    take: 1,
    include: {
      images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
    },
  },
  _count: { select: { records: true } },
} as const

/**
 * 盆栽一覧を取得する。`userId` を省略した場合は現在ログイン中のユーザーの盆栽。
 * 各盆栽には最新の成長記録 1 件とサムネイル画像が含まれる。
 */
export async function getBonsais(userId?: string) {
  if (userId !== undefined && !optionalIdSchema.safeParse(userId).success) {
    return actionError(ERR_INVALID_BONSAI_ID)
  }

  let targetUserId = userId
  if (!targetUserId) {
    const authResult = await requireAuth()
    if ('error' in authResult) return actionError(authResult.error)
    targetUserId = authResult.userId
  }

  try {
    const bonsais = await prisma.bonsai.findMany({
      where: { userId: targetUserId },
      include: BONSAI_INCLUDE_BASE,
      orderBy: { createdAt: 'desc' },
      take: MAX_BONSAI_LIST_LIMIT,
    })

    return actionSuccess({ bonsais })
  } catch (error) {
    logger.error('Get bonsais error:', error)
    return actionError(ERR_BONSAI_LIST_FAILED)
  }
}

/**
 * 盆栽詳細を取得する。所有者情報、全成長記録（画像含む）、記録件数を返す。
 */
export async function getBonsai(bonsaiId: string) {
  if (!idSchema.safeParse(bonsaiId).success) return actionError(ERR_INVALID_BONSAI_ID)

  try {
    const bonsai = await prisma.bonsai.findUnique({
      where: { id: bonsaiId },
      include: {
        user: USER_MINIMAL_RELATION,
        records: {
          orderBy: { recordAt: 'desc' },
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
          },
        },
        _count: { select: { records: true } },
      },
    })

    if (!bonsai) return actionError(ERR_BONSAI_NOT_FOUND)
    return actionSuccess({ bonsai })
  } catch (error) {
    logger.error('Get bonsai error:', error)
    return actionError(ERR_BONSAI_GET_FAILED)
  }
}

/** 盆栽を新規登録する。 */
export async function createBonsai(data: {
  name: string
  species?: string
  acquiredAt?: Date
  description?: string
}) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = createBonsaiSchema.safeParse(data)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await checkUserRateLimit(userId, 'create_bonsai')
  if (!rl.success) return actionError(ERR_RATE_LIMIT_OPERATION)

  try {
    const bonsai = await prisma.bonsai.create({
      data: {
        userId,
        name: parsed.data.name,
        species: parsed.data.species,
        acquiredAt: parsed.data.acquiredAt,
        description: parsed.data.description,
      },
    })

    revalidatePath(ROUTE_BONSAI)
    return actionSuccess({ bonsai })
  } catch (error) {
    logger.error('Create bonsai error:', error)
    return actionError(ERR_BONSAI_CREATE_FAILED)
  }
}

/** 盆栽情報を更新する。自分が所有する盆栽のみ更新可能。 */
export async function updateBonsai(
  bonsaiId: string,
  data: {
    name?: string
    species?: string
    acquiredAt?: Date | null
    description?: string
  }
) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!idSchema.safeParse(bonsaiId).success) return actionError(ERR_INVALID_BONSAI_ID)
  const parsed = updateBonsaiSchema.safeParse(data)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await checkUserRateLimit(userId, 'update_bonsai')
  if (!rl.success) return actionError(ERR_RATE_LIMIT_OPERATION)

  try {
    const existing = await prisma.bonsai.findFirst({
      where: { id: bonsaiId, userId },
    })
    if (!existing) return actionError(ERR_BONSAI_NOT_FOUND)

    const bonsai = await prisma.bonsai.update({
      where: { id: bonsaiId },
      data: {
        name: parsed.data.name,
        species: parsed.data.species,
        acquiredAt: parsed.data.acquiredAt,
        description: parsed.data.description,
      },
    })

    // 詳細・一覧の双方を再検証（name 変更がリストに反映されるため）。
    revalidatePath(buildBonsaiPath(bonsaiId))
    revalidatePath(ROUTE_BONSAI)
    return actionSuccess({ bonsai })
  } catch (error) {
    logger.error('Update bonsai error:', error)
    return actionError(ERR_BONSAI_UPDATE_FAILED)
  }
}

/** 盆栽を削除する。関連する成長記録・画像はカスケード削除される。 */
export async function deleteBonsai(bonsaiId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!idSchema.safeParse(bonsaiId).success) return actionError(ERR_INVALID_BONSAI_ID)

  const rl = await checkUserRateLimit(userId, 'delete_bonsai')
  if (!rl.success) return actionError(ERR_RATE_LIMIT_OPERATION)

  try {
    const existing = await prisma.bonsai.findFirst({
      where: { id: bonsaiId, userId },
    })
    if (!existing) return actionError(ERR_BONSAI_NOT_FOUND)

    await prisma.bonsai.delete({ where: { id: bonsaiId } })

    // 一覧と、削除済み盆栽の詳細ページ（404 化させる）の双方を再検証する。
    revalidatePath(ROUTE_BONSAI)
    revalidatePath(buildBonsaiPath(bonsaiId))
    return actionSuccess()
  } catch (error) {
    logger.error('Delete bonsai error:', error)
    return actionError(ERR_BONSAI_DELETE_FAILED)
  }
}

// 実装は `./bonsai-record` にあるが、`@/lib/actions/bonsai` を公開 API として
// 使う既存の呼び出し元のため薄いラッパー経由で再エクスポートする。
// `'use server'` ファイルは `export { ... } from ...` 形式の再エクスポートが
// 制限されるため、async function の明示 re-wrap で回避している。
import {
  addBonsaiRecord as _addBonsaiRecord,
  updateBonsaiRecord as _updateBonsaiRecord,
  deleteBonsaiRecord as _deleteBonsaiRecord,
  getBonsaiRecords as _getBonsaiRecords,
  getBonsaiTimeline as _getBonsaiTimeline,
} from './bonsai-record'

export async function addBonsaiRecord(data: {
  bonsaiId: string
  content?: string
  recordAt?: Date
  imageUrls?: string[]
}) {
  return _addBonsaiRecord(data)
}

export async function updateBonsaiRecord(
  recordId: string,
  data: { content?: string; recordAt?: Date; imageUrls?: string[] }
) {
  return _updateBonsaiRecord(recordId, data)
}

export async function deleteBonsaiRecord(recordId: string) {
  return _deleteBonsaiRecord(recordId)
}

export async function getBonsaiTimeline(options: { cursor?: string; limit?: number } = {}) {
  return _getBonsaiTimeline(options)
}

export async function getBonsaiRecords(
  bonsaiId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  return _getBonsaiRecords(bonsaiId, options)
}

/**
 * 現在のユーザーの盆栽をキーワード検索する（name / species / description が対象）。
 * 空クエリは `getBonsais` にフォールバックし、IP 単位のレート制限を適用する。
 */
export async function searchBonsais(query: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const clientIp = await getClientIp()
  const rl = await rateLimit(`search:bonsai:${clientIp}`, RATE_LIMITS.search)
  if (!rl.success) return actionError(ERR_SEARCH_RATE_LIMIT)

  const trimmedQuery = query.trim()
  if (!trimmedQuery) return getBonsais()

  if (trimmedQuery.length > MAX_SEARCH_QUERY_LENGTH) {
    return actionError(ERR_BONSAI_SEARCH_QUERY_TOO_LONG)
  }

  try {
    const bonsais = await prisma.bonsai.findMany({
      where: {
        userId,
        OR: [
          { name: containsInsensitive(trimmedQuery) },
          { species: containsInsensitive(trimmedQuery) },
          { description: containsInsensitive(trimmedQuery) },
        ],
      },
      include: BONSAI_INCLUDE_BASE,
      orderBy: { createdAt: 'desc' },
      take: BONSAI_TIMELINE_LIMIT,
    })

    return actionSuccess({ bonsais })
  } catch (error) {
    logger.error('Search bonsais error:', error)
    return actionError(ERR_BONSAI_SEARCH_FAILED)
  }
}
