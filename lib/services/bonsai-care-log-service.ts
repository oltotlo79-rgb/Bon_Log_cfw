/**
 * @module lib/services/bonsai-care-log-service
 * モバイル API v1 向け盆栽手入れログ（BonsaiCareLog）サービス層。
 *
 * BonsaiCareLog はユーザー全体のカレンダー用手入れメモで、特定の盆栽に紐付かない
 * （bonsaiId フィールドは存在しない。Web 実装 lib/actions/bonsai-care-log.ts 参照）。
 * このため API パスは /api/v1/bonsai/care-logs（ユーザー自身のログ一覧/CRUD）。
 *
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 * Web Server Actions は無編集。
 */

import 'server-only'

import { z } from 'zod'
import { BonsaiCareType } from '@prisma/client'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import {
  MAX_BONSAI_CARE_NOTE_LENGTH,
  MAX_CARE_LOG_RANGE_DAYS,
  ONE_DAY_MS,
  CARE_LOG_FUTURE_TOLERANCE_MS,
  DEFAULT_PAGE_LIMIT,
} from '@/lib/constants/limits'
import {
  ERR_CARE_LOG_NOT_FOUND,
  ERR_CARE_LOG_CREATE_FAILED,
  ERR_CARE_LOG_UPDATE_FAILED,
  ERR_CARE_LOG_DELETE_FAILED,
  ERR_CARE_LOG_LIST_FAILED,
  ERR_CARE_LOG_FUTURE_DATE,
  ERR_CARE_LOG_RANGE_TOO_LARGE,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'

// ──────────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────────

export type CareLogItem = {
  id: string
  type: BonsaiCareType
  performedAt: Date
  note: string | null
}

type ServiceOk<T> = { ok: true } & T
type ServiceError = { ok: false; status: number; error: string }

export type CareLogListResult = ServiceOk<{ items: CareLogItem[]; nextCursor: string | null }>
export type CareLogDetailResult = ServiceOk<{ log: CareLogItem }>
export type CareLogCreateResult = ServiceOk<{ id: string }>
export type CareLogMutateResult = ServiceOk<Record<never, never>>
export type CareLogDeleteResult = ServiceOk<Record<never, never>>

// ──────────────────────────────────────────────────
// Zod スキーマ（route handler と OpenAPI 生成で共用）
// ──────────────────────────────────────────────────

const noteSchema = z.string().max(MAX_BONSAI_CARE_NOTE_LENGTH).optional()

export const createCareLogV1Schema = z.object({
  type: z.nativeEnum(BonsaiCareType),
  performedAt: z.string().datetime(),
  note: noteSchema,
})
export type CreateCareLogV1Input = z.infer<typeof createCareLogV1Schema>

export const updateCareLogV1Schema = z.object({
  type: z.nativeEnum(BonsaiCareType).optional(),
  performedAt: z.string().datetime().optional(),
  note: z.string().max(MAX_BONSAI_CARE_NOTE_LENGTH).nullable().optional(),
})
export type UpdateCareLogV1Input = z.infer<typeof updateCareLogV1Schema>

export const listCareLogsV1QuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
export type ListCareLogsV1Query = z.infer<typeof listCareLogsV1QuerySchema>

// ──────────────────────────────────────────────────
// 内部ヘルパー
// ──────────────────────────────────────────────────

function isTooFarInFuture(date: Date): boolean {
  return date.getTime() > Date.now() + CARE_LOG_FUTURE_TOLERANCE_MS
}

// ──────────────────────────────────────────────────
// Service 関数
// ──────────────────────────────────────────────────

/**
 * 手入れログ一覧を取得する。from/to 両方指定時は期間フィルタを適用する。
 * カーソルページネーション形式で返す。
 *
 * @param userId  認証済みユーザー ID（自分のログのみ返る）
 */
export async function listCareLogsV1(
  userId: string,
  input: ListCareLogsV1Query,
): Promise<CareLogListResult | ServiceError> {
  const parsed = listCareLogsV1QuerySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: ERR_INVALID_INPUT }
  }

  const { from, to, cursor, limit = DEFAULT_PAGE_LIMIT } = parsed.data

  if (from && to) {
    const fromDate = new Date(from)
    const toDate = new Date(to)
    if (!(toDate.getTime() > fromDate.getTime())) {
      return { ok: false, status: 400, error: ERR_INVALID_INPUT }
    }
    if (toDate.getTime() - fromDate.getTime() > MAX_CARE_LOG_RANGE_DAYS * ONE_DAY_MS) {
      return { ok: false, status: 400, error: ERR_CARE_LOG_RANGE_TOO_LARGE }
    }
  }

  try {
    const safeLimit = Math.min(Math.max(limit, 1), 100)
    const items = await prisma.bonsaiCareLog.findMany({
      where: {
        userId,
        ...(from && to
          ? { performedAt: { gte: new Date(from), lt: new Date(to) } }
          : {}),
      },
      select: { id: true, type: true, performedAt: true, note: true },
      orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const nextCursor = items.length === safeLimit ? (items[items.length - 1]?.id ?? null) : null

    return { ok: true, items, nextCursor }
  } catch (error) {
    logger.error({ err: error, userId }, 'listCareLogsV1 failed')
    return { ok: false, status: 500, error: ERR_CARE_LOG_LIST_FAILED }
  }
}

/**
 * 手入れログを 1 件取得する。所有者以外・不存在は 404。
 */
export async function getCareLogV1(
  userId: string,
  logId: string,
): Promise<CareLogDetailResult | ServiceError> {
  try {
    const log = await prisma.bonsaiCareLog.findFirst({
      where: { id: logId, userId },
      select: { id: true, type: true, performedAt: true, note: true },
    })
    if (!log) return { ok: false, status: 404, error: ERR_CARE_LOG_NOT_FOUND }
    return { ok: true, log }
  } catch (error) {
    logger.error({ err: error, userId, logId }, 'getCareLogV1 failed')
    return { ok: false, status: 500, error: ERR_CARE_LOG_LIST_FAILED }
  }
}

/**
 * 手入れログを作成する。
 */
export async function createCareLogV1(
  userId: string,
  input: CreateCareLogV1Input,
): Promise<CareLogCreateResult | ServiceError> {
  const parsed = createCareLogV1Schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: ERR_INVALID_INPUT }
  }

  const performedAt = new Date(parsed.data.performedAt)
  if (isTooFarInFuture(performedAt)) {
    return { ok: false, status: 400, error: ERR_CARE_LOG_FUTURE_DATE }
  }

  try {
    const created = await prisma.bonsaiCareLog.create({
      data: {
        userId,
        type: parsed.data.type,
        performedAt,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    })
    return { ok: true, id: created.id }
  } catch (error) {
    logger.error({ err: error, userId }, 'createCareLogV1 failed')
    return { ok: false, status: 500, error: ERR_CARE_LOG_CREATE_FAILED }
  }
}

/**
 * 手入れログを更新する。所有者以外・不存在は 404。
 */
export async function updateCareLogV1(
  userId: string,
  logId: string,
  input: UpdateCareLogV1Input,
): Promise<CareLogMutateResult | ServiceError> {
  const parsed = updateCareLogV1Schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: ERR_INVALID_INPUT }
  }

  if (parsed.data.performedAt) {
    const performedAt = new Date(parsed.data.performedAt)
    if (isTooFarInFuture(performedAt)) {
      return { ok: false, status: 400, error: ERR_CARE_LOG_FUTURE_DATE }
    }
  }

  try {
    const existing = await prisma.bonsaiCareLog.findFirst({
      where: { id: logId, userId },
      select: { id: true },
    })
    if (!existing) return { ok: false, status: 404, error: ERR_CARE_LOG_NOT_FOUND }

    await prisma.bonsaiCareLog.update({
      where: { id: logId },
      data: {
        type: parsed.data.type,
        performedAt: parsed.data.performedAt ? new Date(parsed.data.performedAt) : undefined,
        note: parsed.data.note === undefined ? undefined : parsed.data.note,
      },
    })

    return { ok: true }
  } catch (error) {
    logger.error({ err: error, userId, logId }, 'updateCareLogV1 failed')
    return { ok: false, status: 500, error: ERR_CARE_LOG_UPDATE_FAILED }
  }
}

/**
 * 手入れログを削除する。所有者以外・不存在は 404。
 */
export async function deleteCareLogV1(
  userId: string,
  logId: string,
): Promise<CareLogDeleteResult | ServiceError> {
  try {
    const existing = await prisma.bonsaiCareLog.findFirst({
      where: { id: logId, userId },
      select: { id: true },
    })
    if (!existing) return { ok: false, status: 404, error: ERR_CARE_LOG_NOT_FOUND }

    await prisma.bonsaiCareLog.delete({ where: { id: logId } })

    return { ok: true }
  } catch (error) {
    logger.error({ err: error, userId, logId }, 'deleteCareLogV1 failed')
    return { ok: false, status: 500, error: ERR_CARE_LOG_DELETE_FAILED }
  }
}
