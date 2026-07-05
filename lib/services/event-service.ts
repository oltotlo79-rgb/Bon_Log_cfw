/**
 * @module lib/services/event-service
 * モバイル API v1 向けイベント CRUD サービス層。
 *
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 * Web の lib/actions/event.ts と同等のロジックを Bearer 経路向けに提供する。
 * Web 側 Server Actions は無編集。
 */

import 'server-only'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize'
import logger from '@/lib/logger'
import {
  getPrefecturesByRegion,
  isRegionName,
  REGION_NAME_LIST,
  PREFECTURES,
} from '@/lib/prefectures'
import { getStartOfToday } from '@/lib/utils'
import {
  MAX_EVENT_TITLE_LENGTH,
  MAX_EVENTS_LIMIT,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/lib/constants/limits'
import {
  ERR_EVENT_NOT_FOUND,
  ERR_EDIT_PERMISSION_DENIED,
  ERR_PERMISSION_DENIED,
  ERR_INVALID_START_DATE,
  ERR_INVALID_END_DATE,
  ERR_END_BEFORE_START,
  ERR_OPERATION_FAILED,
  ERR_EVENT_TITLE_REQUIRED,
  ERR_EVENT_START_DATE_REQUIRED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'

// ──────────────────────────────────────────────────
// フィールド最大長定数
// ──────────────────────────────────────────────────

/** イベント説明文の最大文字数 */
const MAX_EVENT_DESCRIPTION_LENGTH = 5000

/** イベント都道府県フィールドの最大文字数 */
const MAX_EVENT_PREFECTURE_LENGTH = 20

/** イベント市区町村フィールドの最大文字数 */
const MAX_EVENT_CITY_LENGTH = 100

/** イベント会場フィールドの最大文字数 */
const MAX_EVENT_VENUE_LENGTH = 200

/** イベント主催者フィールドの最大文字数 */
const MAX_EVENT_ORGANIZER_LENGTH = 200

/** イベント入場料フィールドの最大文字数 */
const MAX_EVENT_ADMISSION_FEE_LENGTH = 100

/** イベント外部 URL の最大文字数 */
const MAX_EVENT_EXTERNAL_URL_LENGTH = 2000

/** イベント ID の最大文字数（cuid: 25 / uuid: 36 + 余裕） */
const MAX_EVENT_ID_LENGTH = 50

// ──────────────────────────────────────────────────
// Zod スキーマ
// ──────────────────────────────────────────────────

/**
 * POST /api/v1/events リクエストボディのスキーマ。
 * Web の eventSchema と同等の検証。prefecture は API では optional（Web では必須）。
 */
export const createEventV1Schema = z.object({
  title: z.string().min(1, ERR_EVENT_TITLE_REQUIRED).max(MAX_EVENT_TITLE_LENGTH),
  startDate: z.string().min(1, ERR_EVENT_START_DATE_REQUIRED),
  description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH).nullable().optional(),
  endDate: z.string().nullable().optional(),
  prefecture: z.string().max(MAX_EVENT_PREFECTURE_LENGTH).nullable().optional(),
  city: z.string().max(MAX_EVENT_CITY_LENGTH).nullable().optional(),
  venue: z.string().max(MAX_EVENT_VENUE_LENGTH).nullable().optional(),
  organizer: z.string().max(MAX_EVENT_ORGANIZER_LENGTH).nullable().optional(),
  admissionFee: z.string().max(MAX_EVENT_ADMISSION_FEE_LENGTH).nullable().optional(),
  hasSales: z.boolean().optional().default(false),
  externalUrl: z.string().url().max(MAX_EVENT_EXTERNAL_URL_LENGTH).nullable().optional(),
})
export type CreateEventV1Input = z.infer<typeof createEventV1Schema>

/**
 * PATCH /api/v1/events/{id} リクエストボディのスキーマ。
 * すべてフィールドが optional（部分更新）。
 */
export const updateEventV1Schema = z.object({
  title: z
    .string()
    .min(1, ERR_EVENT_TITLE_REQUIRED)
    .max(MAX_EVENT_TITLE_LENGTH)
    .optional(),
  startDate: z.string().min(1, ERR_EVENT_START_DATE_REQUIRED).optional(),
  description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH).nullable().optional(),
  endDate: z.string().nullable().optional(),
  prefecture: z.string().max(MAX_EVENT_PREFECTURE_LENGTH).nullable().optional(),
  city: z.string().max(MAX_EVENT_CITY_LENGTH).nullable().optional(),
  venue: z.string().max(MAX_EVENT_VENUE_LENGTH).nullable().optional(),
  organizer: z.string().max(MAX_EVENT_ORGANIZER_LENGTH).nullable().optional(),
  admissionFee: z.string().max(MAX_EVENT_ADMISSION_FEE_LENGTH).nullable().optional(),
  hasSales: z.boolean().optional(),
  externalUrl: z.string().url().max(MAX_EVENT_EXTERNAL_URL_LENGTH).nullable().optional(),
})
export type UpdateEventV1Input = z.infer<typeof updateEventV1Schema>

/**
 * GET /api/v1/events クエリパラメータのスキーマ。
 * Web の getEvents と同等のフィルタ。
 */
export const listEventsV1QuerySchema = z.object({
  cursor: z.string().max(MAX_EVENT_ID_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  region: z.string().optional().refine(
    (v) => v === undefined || isRegionName(v),
    { message: ERR_INVALID_INPUT },
  ),
  prefecture: z
    .string()
    .max(MAX_EVENT_PREFECTURE_LENGTH)
    .optional()
    .refine(
      (v) => v === undefined || (PREFECTURES as readonly string[]).includes(v),
      { message: ERR_INVALID_INPUT },
    ),
  showPast: z.enum(['true', 'false']).optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  month: z.coerce.number().int().min(0).max(11).optional(),
})
export type ListEventsV1Query = z.infer<typeof listEventsV1QuerySchema>

// ──────────────────────────────────────────────────
// Prisma include
// ──────────────────────────────────────────────────

const EVENT_INCLUDE = {
  creator: {
    select: USER_MINIMAL_SELECT,
  },
} as const

// ──────────────────────────────────────────────────
// 型エイリアス
// ──────────────────────────────────────────────────

type EventWithCreator = NonNullable<Awaited<ReturnType<typeof findEventById>>>

// ──────────────────────────────────────────────────
// フォーマット関数
// ──────────────────────────────────────────────────

/** Prisma の Event レコードを API レスポンス形式に変換する。 */
export function formatEventForApi(event: EventWithCreator) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate?.toISOString() ?? null,
    prefecture: event.prefecture,
    city: event.city,
    venue: event.venue,
    organizer: event.organizer,
    admissionFee: event.admissionFee,
    hasSales: event.hasSales,
    externalUrl: event.externalUrl,
    creator: event.creator
      ? {
          id: event.creator.id,
          nickname: event.creator.nickname,
          avatarUrl: event.creator.avatarUrl,
        }
      : null,
    createdAt: event.createdAt.toISOString(),
  }
}

// ──────────────────────────────────────────────────
// 内部ヘルパー
// ──────────────────────────────────────────────────

async function findEventById(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId, isHidden: false },
    include: EVENT_INCLUDE,
  })
}

/**
 * Web の parseEventFormData と同等の日付検証・サニタイズを JSON ボディ向けに実施する。
 * 成功時は `{ ok: true; data: ... }` を返し、失敗時は `{ ok: false; error: string }` を返す。
 */
function buildEventData(
  input: CreateEventV1Input,
): { ok: true; data: ReturnType<typeof sanitizeEventFields> } | { ok: false; error: string } {
  const startDate = new Date(input.startDate)
  if (isNaN(startDate.getTime())) {
    return { ok: false, error: ERR_INVALID_START_DATE }
  }

  const endDate = input.endDate ? new Date(input.endDate) : null
  if (endDate && isNaN(endDate.getTime())) {
    return { ok: false, error: ERR_INVALID_END_DATE }
  }
  if (endDate && endDate < startDate) {
    return { ok: false, error: ERR_END_BEFORE_START }
  }

  return { ok: true, data: sanitizeEventFields(input, startDate, endDate) }
}

/** テキストフィールドをサニタイズして Prisma create/update 用データを構築する。 */
function sanitizeEventFields(
  input: CreateEventV1Input,
  startDate: Date,
  endDate: Date | null,
) {
  return {
    title: sanitizeText(input.title.trim()),
    startDate,
    endDate,
    prefecture: input.prefecture ?? null,
    city: input.city ? sanitizeText(input.city.trim()) : null,
    venue: input.venue ? sanitizeText(input.venue.trim()) : null,
    organizer: input.organizer ? sanitizeText(input.organizer.trim()) : null,
    admissionFee: input.admissionFee ? sanitizeText(input.admissionFee.trim()) : null,
    hasSales: input.hasSales,
    description: input.description ? sanitizeText(input.description.trim()) : null,
    externalUrl: input.externalUrl ? sanitizeUrl(input.externalUrl.trim()) : null,
  }
}

// ──────────────────────────────────────────────────
// Service 関数
// ──────────────────────────────────────────────────

/** GET /api/v1/events — イベント一覧をカーソルページネーションで取得する。 */
export async function listEventsV1(query: ListEventsV1Query): Promise<{
  ok: true
  items: ReturnType<typeof formatEventForApi>[]
  nextCursor: string | null
} | { ok: false; error: string }> {
  try {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT
    const today = getStartOfToday()
    const showPast = query.showPast === 'true'

    let prefectureFilter: string[] | undefined
    if (query.prefecture) {
      prefectureFilter = [query.prefecture]
    } else if (query.region && isRegionName(query.region)) {
      prefectureFilter = getPrefecturesByRegion(query.region)
    }

    let dateFilter: { gte?: Date; lt?: Date } | undefined
    if (query.month !== undefined && query.year !== undefined) {
      const startOfMonth = new Date(query.year, query.month, 1)
      const endOfMonth = new Date(query.year, query.month + 1, 1)
      dateFilter = { gte: startOfMonth, lt: endOfMonth }
    } else if (!showPast) {
      dateFilter = { gte: today }
    }

    const events = await prisma.event.findMany({
      where: {
        isHidden: false,
        ...(dateFilter && { startDate: dateFilter }),
        ...(prefectureFilter && { prefecture: { in: prefectureFilter } }),
      },
      include: EVENT_INCLUDE,
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: Math.min(limit + 1, MAX_EVENTS_LIMIT),
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    })

    const hasNext = events.length > limit
    const page = hasNext ? events.slice(0, limit) : events
    const nextCursor = hasNext ? (page[page.length - 1]?.id ?? null) : null

    return {
      ok: true,
      items: page.map(formatEventForApi),
      nextCursor,
    }
  } catch (error) {
    logger.error('listEventsV1 failed', { error: error instanceof Error ? error.message : String(error) })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

/** GET /api/v1/events/{id} — イベント詳細を取得する。非表示・不存在は null を返す。 */
export async function getEventV1(eventId: string): Promise<{
  ok: true
  event: ReturnType<typeof formatEventForApi>
} | { ok: false; error: string }> {
  try {
    const event = await findEventById(eventId)
    if (!event) {
      return { ok: false, error: ERR_EVENT_NOT_FOUND }
    }
    return { ok: true, event: formatEventForApi(event) }
  } catch (error) {
    logger.error('getEventV1 failed', { error: error instanceof Error ? error.message : String(error) })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

/** POST /api/v1/events — イベントを作成する。 */
export async function createEventV1(
  input: CreateEventV1Input,
  userId: string,
): Promise<{ ok: true; event: ReturnType<typeof formatEventForApi> } | { ok: false; error: string }> {
  const built = buildEventData(input)
  if (!built.ok) return { ok: false, error: built.error }

  try {
    const created = await prisma.event.create({
      data: {
        createdBy: userId,
        ...built.data,
      },
      include: EVENT_INCLUDE,
    })
    return { ok: true, event: formatEventForApi(created) }
  } catch (error) {
    logger.error('createEventV1 failed', { error: error instanceof Error ? error.message : String(error) })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

/** PATCH /api/v1/events/{id} — イベントを部分更新する。作成者のみ実行可能。 */
export async function updateEventV1(
  eventId: string,
  input: UpdateEventV1Input,
  userId: string,
): Promise<{ ok: true; event: ReturnType<typeof formatEventForApi> } | { ok: false; error: string }> {
  try {
    const existing = await prisma.event.findUnique({
      where: { id: eventId },
      select: { createdBy: true, startDate: true, endDate: true },
    })
    if (!existing) return { ok: false, error: ERR_EVENT_NOT_FOUND }
    if (existing.createdBy !== userId) return { ok: false, error: ERR_EDIT_PERMISSION_DENIED }

    // 日付フィールドは指定された場合のみ検証・更新する
    const startDateRaw = input.startDate ?? existing.startDate.toISOString()
    const startDate = new Date(startDateRaw)
    if (isNaN(startDate.getTime())) return { ok: false, error: ERR_INVALID_START_DATE }

    const endDateStr = 'endDate' in input ? input.endDate : existing.endDate?.toISOString()
    const endDate = endDateStr ? new Date(endDateStr) : null
    if (endDate && isNaN(endDate.getTime())) return { ok: false, error: ERR_INVALID_END_DATE }
    if (endDate && endDate < startDate) return { ok: false, error: ERR_END_BEFORE_START }

    const updateData: Record<string, unknown> = {
      startDate,
      endDate,
    }
    if (input.title !== undefined) updateData.title = sanitizeText(input.title.trim())
    if (input.description !== undefined)
      updateData.description = input.description ? sanitizeText(input.description.trim()) : null
    if (input.prefecture !== undefined) updateData.prefecture = input.prefecture ?? null
    if (input.city !== undefined)
      updateData.city = input.city ? sanitizeText(input.city.trim()) : null
    if (input.venue !== undefined)
      updateData.venue = input.venue ? sanitizeText(input.venue.trim()) : null
    if (input.organizer !== undefined)
      updateData.organizer = input.organizer ? sanitizeText(input.organizer.trim()) : null
    if (input.admissionFee !== undefined)
      updateData.admissionFee = input.admissionFee ? sanitizeText(input.admissionFee.trim()) : null
    if (input.hasSales !== undefined) updateData.hasSales = input.hasSales
    if (input.externalUrl !== undefined)
      updateData.externalUrl = input.externalUrl ? sanitizeUrl(input.externalUrl.trim()) : null

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
      include: EVENT_INCLUDE,
    })
    return { ok: true, event: formatEventForApi(updated) }
  } catch (error) {
    logger.error('updateEventV1 failed', { error: error instanceof Error ? error.message : String(error) })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

/** DELETE /api/v1/events/{id} — イベントを削除する。作成者のみ実行可能。 */
export async function deleteEventV1(
  eventId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const existing = await prisma.event.findUnique({
      where: { id: eventId },
      select: { createdBy: true },
    })
    if (!existing) return { ok: false, error: ERR_EVENT_NOT_FOUND }
    if (existing.createdBy !== userId) return { ok: false, error: ERR_PERMISSION_DENIED }

    await prisma.event.delete({ where: { id: eventId } })
    return { ok: true }
  } catch (error) {
    logger.error('deleteEventV1 failed', { error: error instanceof Error ? error.message : String(error) })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

/** region クエリパラメータで許可される値の配列（OpenAPI enum 生成用）。 */
export const EVENT_REGION_VALUES = REGION_NAME_LIST as readonly string[]
