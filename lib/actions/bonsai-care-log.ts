/**
 * 盆栽手入れログ (BonsaiCareLog) の Server Actions。
 *
 * カレンダービュー専用の構造化メモを管理する。手入れ記録は特定の盆栽に
 * 紐付けず、ユーザー全体のログとして扱う (タイムラインや盆栽詳細には漏出させない)。
 *
 * 必須パターン (`.claude/rules/server-actions.md`):
 *   1. `requireActiveNonGuestUser()` で認証 + 非ゲスト
 *   2. Zod でランタイム検証
 *   3. `enforceUserRateLimit(userId, action)` でレート制限
 *   4. ビジネスロジック (所有者チェックは `findFirst({ where: { id, userId } })` 1 段)
 *   5. `revalidateTag` でキャッシュ無効化
 *   6. `actionSuccess` / `actionError` で返却
 *
 * @module lib/actions/bonsai-care-log
 */

'use server'

import { z } from 'zod'
import { revalidateTag, unstable_cache } from 'next/cache'
import { BonsaiCareType } from '@prisma/client'

import { prisma } from '@/lib/db'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import logger from '@/lib/logger'
import {
  ALL_CARE_TYPE_COUNT,
} from '@/lib/constants/bonsai-care'
import {
  CARE_LOG_CACHE_SEC,
  CARE_LOG_FUTURE_TOLERANCE_MS,
  MAX_BONSAI_CARE_NOTE_LENGTH,
  MAX_CARE_LOG_RANGE_DAYS,
  ONE_DAY_MS,
} from '@/lib/constants/limits'
import {
  ERR_CARE_LOG_CREATE_FAILED,
  ERR_CARE_LOG_DELETE_FAILED,
  ERR_CARE_LOG_FUTURE_DATE,
  ERR_CARE_LOG_LIST_FAILED,
  ERR_CARE_LOG_NOT_FOUND,
  ERR_CARE_LOG_RANGE_TOO_LARGE,
  ERR_CARE_LOG_UPDATE_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import type {
  BonsaiPostCalendarItem,
  BonsaiRecordCalendarItem,
  CareLogListItem,
} from '@/types/bonsai-care'

const idSchema = z.string().min(1).max(64)

/**
 * 「未来日」と判定するか。タイムゾーン差を吸収するため
 * `now + CARE_LOG_FUTURE_TOLERANCE_MS` を許容上限とする。
 */
function isTooFarInFuture(date: Date, now: Date = new Date()): boolean {
  return date.getTime() > now.getTime() + CARE_LOG_FUTURE_TOLERANCE_MS
}

/** ユーザー単位のキャッシュ無効化タグ */
function tagForUser(userId: string): string {
  return `care-log-user-${userId}`
}

/** 成長記録/タグ付け投稿用のキャッシュタグ。手入れログとは独立に無効化する */
function overlayTagForUser(userId: string): string {
  return `bonsai-calendar-overlay-${userId}`
}

/** types フィルタを安定キー化（順序差・重複を吸収） */
function buildTypesKey(types?: readonly BonsaiCareType[]): string {
  if (!types || types.length === 0) return 'all'
  return [...new Set(types)].sort().join(',')
}

const noteSchema = z.string().max(MAX_BONSAI_CARE_NOTE_LENGTH).optional()

const addCareLogSchema = z.object({
  type: z.nativeEnum(BonsaiCareType),
  performedAt: z.coerce.date(),
  note: noteSchema,
})

const updateCareLogSchema = z.object({
  type: z.nativeEnum(BonsaiCareType).optional(),
  performedAt: z.coerce.date().optional(),
  note: noteSchema.or(z.null()),
}).partial()

const listRangeSchema = z.object({
  fromIso: z.string().datetime(),
  toIso: z.string().datetime(),
  types: z.array(z.nativeEnum(BonsaiCareType)).max(ALL_CARE_TYPE_COUNT).optional(),
})

/**
 * 手入れログを追加する。`userId` はサーバー側で `session.user.id` を強制セットする。
 */
export async function addBonsaiCareLog(input: {
  type: BonsaiCareType
  performedAt: Date | string
  note?: string
}) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  const parsed = addCareLogSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  if (isTooFarInFuture(parsed.data.performedAt)) {
    return actionError(ERR_CARE_LOG_FUTURE_DATE)
  }

  const rl = await enforceUserRateLimit(userId, 'care_log_write')
  if (rl) return actionError(rl.error)

  try {
    const created = await prisma.bonsaiCareLog.create({
      data: {
        userId,
        type: parsed.data.type,
        performedAt: parsed.data.performedAt,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    })

    revalidateTag(tagForUser(userId), { expire: 0 })
    return actionSuccess({ id: created.id })
  } catch (error) {
    logger.error({ err: error, userId }, 'addBonsaiCareLog failed')
    return actionError(ERR_CARE_LOG_CREATE_FAILED)
  }
}

/**
 * 手入れログを更新する。所有者以外には NOT_FOUND を返し、ID 列挙攻撃を防ぐ。
 * `note` は明示的に null を渡すと削除できる。
 */
export async function updateBonsaiCareLog(
  id: string,
  input: {
    type?: BonsaiCareType
    performedAt?: Date | string
    note?: string | null
  },
) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  if (!idSchema.safeParse(id).success) return actionError(ERR_INVALID_INPUT)
  const parsed = updateCareLogSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  if (parsed.data.performedAt && isTooFarInFuture(parsed.data.performedAt)) {
    return actionError(ERR_CARE_LOG_FUTURE_DATE)
  }

  const rl = await enforceUserRateLimit(userId, 'care_log_write')
  if (rl) return actionError(rl.error)

  try {
    // 所有者チェックを 1 クエリで実施 (IDOR 防御)
    const existing = await prisma.bonsaiCareLog.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!existing) return actionError(ERR_CARE_LOG_NOT_FOUND)

    await prisma.bonsaiCareLog.update({
      where: { id },
      data: {
        type: parsed.data.type,
        performedAt: parsed.data.performedAt,
        // null を明示すると DB 上の note を消去
        note: parsed.data.note === undefined ? undefined : parsed.data.note,
      },
    })

    revalidateTag(tagForUser(userId), { expire: 0 })
    return actionSuccess()
  } catch (error) {
    logger.error({ err: error, userId, id }, 'updateBonsaiCareLog failed')
    return actionError(ERR_CARE_LOG_UPDATE_FAILED)
  }
}

/** 手入れログを削除する。所有者以外には NOT_FOUND を返す。 */
export async function deleteBonsaiCareLog(id: string) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  if (!idSchema.safeParse(id).success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'delete_care_log')
  if (rl) return actionError(rl.error)

  try {
    const existing = await prisma.bonsaiCareLog.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!existing) return actionError(ERR_CARE_LOG_NOT_FOUND)

    await prisma.bonsaiCareLog.delete({ where: { id } })

    revalidateTag(tagForUser(userId), { expire: 0 })
    return actionSuccess()
  } catch (error) {
    logger.error({ err: error, userId, id }, 'deleteBonsaiCareLog failed')
    return actionError(ERR_CARE_LOG_DELETE_FAILED)
  }
}

/**
 * 期間内の手入れログを取得する（カレンダー主クエリ）。
 *
 * `[from, to)` の半開区間で取得し、`performedAt` 昇順で返す。
 * 1 ユーザー単位で `unstable_cache` 60 秒キャッシュ。書き込み時に `revalidateTag` で失効。
 *
 * セキュリティ:
 *   - 範囲が `MAX_CARE_LOG_RANGE_DAYS` を超える場合は ERR_CARE_LOG_RANGE_TOO_LARGE
 *   - `to <= from` は ERR_INVALID_INPUT
 */
export async function getCareLogsInRange(input: {
  fromIso: string
  toIso: string
  types?: BonsaiCareType[]
}) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  const parsed = listRangeSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const from = new Date(parsed.data.fromIso)
  const to = new Date(parsed.data.toIso)
  if (!(to.getTime() > from.getTime())) return actionError(ERR_INVALID_INPUT)
  if (to.getTime() - from.getTime() > MAX_CARE_LOG_RANGE_DAYS * ONE_DAY_MS) {
    return actionError(ERR_CARE_LOG_RANGE_TOO_LARGE)
  }

  const rl = await enforceUserRateLimit(userId, 'care_log_read')
  if (rl) return actionError(rl.error)

  const typesKey = buildTypesKey(parsed.data.types)

  try {
    // 文字列キーから BonsaiCareType[] を安全に復元するための Zod 配列スキーマ
    const typesArraySchema = z.nativeEnum(BonsaiCareType).array()

    const cached = unstable_cache(
      async (fromIsoArg: string, toIsoArg: string, typesKeyArg: string) => {
        // unstable_cache の第二引数（キー配列）にユーザー単位の名前空間を含めるが、
        // 実クエリ側の userId はクロージャから参照する。
        const typeFilter =
          typesKeyArg === 'all'
            ? undefined
            : typesArraySchema.parse(typesKeyArg.split(','))
        const where = {
          userId,
          performedAt: {
            gte: new Date(fromIsoArg),
            lt: new Date(toIsoArg),
          },
          ...(typeFilter && { type: { in: typeFilter } }),
        }
        return prisma.bonsaiCareLog.findMany({
          where,
          select: { id: true, type: true, performedAt: true, note: true },
          orderBy: { performedAt: 'asc' },
        })
      },
      ['care-log', userId],
      { revalidate: CARE_LOG_CACHE_SEC, tags: [tagForUser(userId)] },
    )

    // unstable_cache は内部で JSON シリアライズするため、Date が ISO 文字列に降格して返る。
    // 型契約（performedAt: Date）を守るため、ここで Date に再水和する。
    const raw = await cached(parsed.data.fromIso, parsed.data.toIso, typesKey)
    const logs: CareLogListItem[] = raw.map((l) => ({
      ...l,
      performedAt: l.performedAt instanceof Date ? l.performedAt : new Date(l.performedAt),
    }))
    return actionSuccess({ logs })
  } catch (error) {
    logger.error({ err: error, userId }, 'getCareLogsInRange failed')
    return actionError(ERR_CARE_LOG_LIST_FAILED)
  }
}

/**
 * 期間内の「成長記録」「タグ付け投稿」を取得する（カレンダーオーバーレイ用）。
 *
 * 手入れログ（BonsaiCareLog）とは別軸で表示されるユーザーの所有盆栽に
 * 紐付くアクティビティを返す。
 *
 *   - records: BonsaiRecord（recordAt が範囲内）
 *   - posts:   Post（bonsaiId が自分の盆栽 / createdAt が範囲内 / 非モデレーション）
 *
 * セキュリティ:
 *   - ユーザーが所有する Bonsai のみ対象（他ユーザーの盆栽 ID 列挙を防ぐ）
 *   - 範囲が `MAX_CARE_LOG_RANGE_DAYS` を超える場合は ERR_CARE_LOG_RANGE_TOO_LARGE
 */
export async function getBonsaiCalendarOverlaysInRange(input: {
  fromIso: string
  toIso: string
}) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  const parsed = listRangeSchema.safeParse({ ...input, types: undefined })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const from = new Date(parsed.data.fromIso)
  const to = new Date(parsed.data.toIso)
  if (!(to.getTime() > from.getTime())) return actionError(ERR_INVALID_INPUT)
  if (to.getTime() - from.getTime() > MAX_CARE_LOG_RANGE_DAYS * ONE_DAY_MS) {
    return actionError(ERR_CARE_LOG_RANGE_TOO_LARGE)
  }

  const rl = await enforceUserRateLimit(userId, 'care_log_read')
  if (rl) return actionError(rl.error)

  try {
    const cached = unstable_cache(
      async (fromIsoArg: string, toIsoArg: string) => {
        const fromArg = new Date(fromIsoArg)
        const toArg = new Date(toIsoArg)

        // 所有盆栽 ID を取得（空ならクエリせず即時 return）
        const ownedBonsais = await prisma.bonsai.findMany({
          where: { userId },
          select: { id: true, name: true },
        })
        if (ownedBonsais.length === 0) {
          return { records: [], posts: [] }
        }
        const bonsaiIds = ownedBonsais.map((b) => b.id)
        const nameMap = new Map(ownedBonsais.map((b) => [b.id, b.name]))

        const [records, posts] = await Promise.all([
          prisma.bonsaiRecord.findMany({
            where: {
              bonsaiId: { in: bonsaiIds },
              recordAt: { gte: fromArg, lt: toArg },
            },
            select: {
              id: true,
              bonsaiId: true,
              content: true,
              recordAt: true,
              _count: { select: { images: true } },
            },
            orderBy: { recordAt: 'asc' },
          }),
          prisma.post.findMany({
            where: {
              bonsaiId: { in: bonsaiIds },
              isHidden: false,
              createdAt: { gte: fromArg, lt: toArg },
            },
            select: {
              id: true,
              bonsaiId: true,
              content: true,
              createdAt: true,
              _count: { select: { media: true } },
            },
            orderBy: { createdAt: 'asc' },
          }),
        ])

        return {
          records: records.map((r) => ({
            id: r.id,
            bonsaiId: r.bonsaiId,
            bonsaiName: nameMap.get(r.bonsaiId) ?? '',
            content: r.content,
            recordAt: r.recordAt,
            imageCount: r._count.images,
          })),
          // Post.bonsaiId は schema 上 nullable。`bonsaiId in [...]` で実質的に
          // null は除外されるが、Prisma の戻り値型は nullable のまま。
          // null の場合に壊れたリンク（/posts/）を作らないよう防御的に絞り込む。
          posts: posts.flatMap((p) => {
            if (p.bonsaiId === null) return []
            return [
              {
                id: p.id,
                bonsaiId: p.bonsaiId,
                bonsaiName: nameMap.get(p.bonsaiId) ?? '',
                content: p.content,
                createdAt: p.createdAt,
                mediaCount: p._count.media,
              },
            ]
          }),
        }
      },
      ['bonsai-calendar-overlay', userId],
      { revalidate: CARE_LOG_CACHE_SEC, tags: [overlayTagForUser(userId)] },
    )

    const raw = await cached(parsed.data.fromIso, parsed.data.toIso)
    // unstable_cache の JSON 経由で Date が文字列化されるため再水和する
    const records: BonsaiRecordCalendarItem[] = raw.records.map((r) => ({
      ...r,
      recordAt: r.recordAt instanceof Date ? r.recordAt : new Date(r.recordAt),
    }))
    const posts: BonsaiPostCalendarItem[] = raw.posts.map((p) => ({
      ...p,
      createdAt: p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt),
    }))
    return actionSuccess({ records, posts })
  } catch (error) {
    logger.error({ err: error, userId }, 'getBonsaiCalendarOverlaysInRange failed')
    return actionError(ERR_CARE_LOG_LIST_FAILED)
  }
}
