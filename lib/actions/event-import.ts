/**
 * イベントインポート用Server Actions
 *
 * 外部サイトからイベント情報をスクレイピングし、
 * 管理者がインポートできる機能を提供
 */

'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
  scrapeAllEvents,
  scrapeEventsFromRegion,
  BONSAI_EVENT_SOURCES,
  type ScrapedEvent,
} from '@/lib/scraping/bonsai-events'
import logger from '@/lib/logger'
import { requireAdmin, actionSuccess, actionError, type ActionResult } from '@/lib/actions/utils'
import { ERR_EVENTS_NOT_FOUND, ERR_SCRAPING_FAILED, ERR_REGION_NOT_FOUND, ERR_NO_EVENTS_SELECTED, ERR_IMPORT_FAILED } from '@/lib/constants/errors'
import { ROUTE_EVENTS, ROUTE_ADMIN_EVENTS } from '@/lib/constants/routes'
import { EVENT_TITLE_SIMILARITY_PREFIX_LENGTH } from '@/lib/constants/limits'

/**
 * 重複タイプの定義
 * - 'exact': 完全重複（同タイトル・同期間・同都道府県）→ 表示しない
 * - 'similar': 類似イベント（類似タイトル・同都道府県・異なる期間）→ 黄色警告
 * - null: 重複なし
 */
export type DuplicateType = 'exact' | 'similar' | null

/**
 * インポート用イベントデータの型（クライアントに送信可能な形式）
 */
export interface ImportableEvent {
  id: string // 一時ID（インポート時の識別用）
  title: string
  startDate: string | null
  endDate: string | null
  prefecture: string | null
  city: string | null
  venue: string | null
  organizer: string | null
  admissionFee: string | null
  hasSales: boolean
  description: string
  externalUrl: string | null
  sourceRegion: string
  sourceUrl: string
  isDuplicate: boolean // 後方互換性のため残す（similarの場合true）
  duplicateType: DuplicateType // 重複タイプ
  similarEventTitle?: string // 類似イベントのタイトル（警告表示用）
}


/**
 * 重複チェック結果の型
 */
interface DuplicateCheckResult {
  type: DuplicateType
  similarEventTitle?: string
}

/**
 * タイトルの類似度を計算（簡易版）
 * タイトルの先頭 N 文字が一致、または一方が他方を含む場合に類似とみなす。
 * N は {@link EVENT_TITLE_SIMILARITY_PREFIX_LENGTH} で集中管理。
 */
function isSimilarTitle(title1: string, title2: string): boolean {
  const normalized1 = title1.replace(/\s+/g, '').toLowerCase()
  const normalized2 = title2.replace(/\s+/g, '').toLowerCase()

  // 完全一致
  if (normalized1 === normalized2) return true

  // 先頭N文字が一致
  if (
    normalized1.substring(0, EVENT_TITLE_SIMILARITY_PREFIX_LENGTH) ===
    normalized2.substring(0, EVENT_TITLE_SIMILARITY_PREFIX_LENGTH)
  ) {
    return true
  }

  // 一方が他方を含む
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true

  return false
}

/**
 * 日付が同じかどうかをチェック（日付部分のみ比較）
 */
function isSameDate(date1: Date | null, date2: Date | null): boolean {
  if (!date1 && !date2) return true
  if (!date1 || !date2) return false

  return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0]
}

/**
 * 重複チェック
 * - 完全重複: 同タイトル・同期間・同都道府県 → 'exact'
 * - 類似イベント: 類似タイトル・同都道府県・異なる期間 → 'similar'
 * - 重複なし: null
 */
async function checkDuplicates(events: ScrapedEvent[]): Promise<Map<string, DuplicateCheckResult>> {
  const duplicateMap = new Map<string, DuplicateCheckResult>()

  // 対象都道府県を収集して一括取得（N+1回避）
  // `as string[]` キャストの代わりに type predicate で null を絞り込む
  const prefectures = [
    ...new Set(
      events
        .map((e) => e.prefecture)
        .filter((p): p is string => typeof p === 'string' && p.length > 0),
    ),
  ]
  const existingEvents = await prisma.event.findMany({
    where: {
      isHidden: false,
      ...(prefectures.length > 0 && { prefecture: { in: prefectures } }),
    },
    select: {
      title: true,
      startDate: true,
      endDate: true,
      prefecture: true,
    },
  })

  // 都道府県別にグループ化してメモリ上で検索
  const eventsByPrefecture = new Map<string, typeof existingEvents>()
  for (const existing of existingEvents) {
    const pref = existing.prefecture || ''
    let bucket = eventsByPrefecture.get(pref)
    if (!bucket) {
      bucket = []
      eventsByPrefecture.set(pref, bucket)
    }
    bucket.push(existing)
  }

  for (const event of events) {
    if (!event.startDate) {
      duplicateMap.set(event.title, { type: null })
      continue
    }

    // メモリ上で都道府県が一致する既存イベントを取得
    const candidates = eventsByPrefecture.get(event.prefecture || '') || []

    let duplicateResult: DuplicateCheckResult = { type: null }

    for (const existing of candidates) {
      // タイトルが類似しているかチェック
      if (!isSimilarTitle(event.title, existing.title)) {
        continue
      }

      // 完全重複チェック: 同タイトル・同期間・同都道府県
      const isSameStartDate = isSameDate(event.startDate, existing.startDate)
      const isSameEndDate = isSameDate(event.endDate, existing.endDate)
      const isSamePrefecture = event.prefecture === existing.prefecture

      if (isSameStartDate && isSameEndDate && isSamePrefecture) {
        duplicateResult = { type: 'exact', similarEventTitle: existing.title }
        break
      }

      // 類似イベント: 類似タイトル・同都道府県・異なる期間
      if (isSamePrefecture && (!isSameStartDate || !isSameEndDate)) {
        duplicateResult = { type: 'similar', similarEventTitle: existing.title }
      }
    }

    duplicateMap.set(event.title, duplicateResult)
  }

  return duplicateMap
}

/**
 * ScrapedEventをImportableEventに変換
 */
function toImportableEvent(
  event: ScrapedEvent,
  index: number,
  duplicateResult: DuplicateCheckResult
): ImportableEvent {
  return {
    id: `scraped-${index}-${Date.now()}`,
    title: event.title,
    startDate: event.startDate?.toISOString() || null,
    endDate: event.endDate?.toISOString() || null,
    prefecture: event.prefecture,
    city: event.city,
    venue: event.venue,
    organizer: event.organizer,
    admissionFee: event.admissionFee,
    hasSales: event.hasSales,
    description: event.description,
    externalUrl: event.externalUrl,
    sourceRegion: event.sourceRegion,
    sourceUrl: event.sourceUrl,
    isDuplicate: duplicateResult.type === 'similar', // 後方互換性
    duplicateType: duplicateResult.type,
    similarEventTitle: duplicateResult.similarEventTitle,
  }
}

/**
 * 全地方のイベントをスクレイピング（プレビュー用）
 */
export async function scrapeExternalEvents(): Promise<
  ActionResult<{ events: ImportableEvent[]; filteredCount: number }>
> {
  // 管理者チェック
  const admin = await requireAdmin('events:manage')
  if ('error' in admin) return actionError(admin.error)

  try {
    // スクレイピング実行
    const scrapedEvents = await scrapeAllEvents()

    if (scrapedEvents.length === 0) {
      return actionError(ERR_EVENTS_NOT_FOUND)
    }

    // 重複チェック
    const duplicateMap = await checkDuplicates(scrapedEvents)

    // ImportableEvent形式に変換し、完全重複を除外
    let filteredCount = 0
    const events: ImportableEvent[] = []

    scrapedEvents.forEach((event, index) => {
      const duplicateResult = duplicateMap.get(event.title) || { type: null }

      // 完全重複は除外
      if (duplicateResult.type === 'exact') {
        filteredCount++
        return
      }

      events.push(toImportableEvent(event, index, duplicateResult))
    })

    return actionSuccess({ events, filteredCount })
  } catch (error) {
    logger.error('Scraping error:', error)
    return actionError(ERR_SCRAPING_FAILED)
  }
}

/**
 * 特定の地方のイベントをスクレイピング
 */
export async function scrapeEventsByRegion(
  regionId: string
): Promise<ActionResult<{ events: ImportableEvent[]; filteredCount: number }>> {
  // 管理者チェック
  const admin = await requireAdmin('events:manage')
  if ('error' in admin) return actionError(admin.error)

  const source = BONSAI_EVENT_SOURCES.find(
    (s) => s.region === regionId || s.url.includes(regionId)
  )

  if (!source) {
    return actionError(ERR_REGION_NOT_FOUND)
  }

  try {
    const scrapedEvents = await scrapeEventsFromRegion(
      source.url,
      source.region,
      source.prefectures
    )

    if (scrapedEvents.length === 0) {
      return actionError(ERR_EVENTS_NOT_FOUND)
    }

    const duplicateMap = await checkDuplicates(scrapedEvents)

    // ImportableEvent形式に変換し、完全重複を除外
    let filteredCount = 0
    const events: ImportableEvent[] = []

    scrapedEvents.forEach((event, index) => {
      const duplicateResult = duplicateMap.get(event.title) || { type: null }

      // 完全重複は除外
      if (duplicateResult.type === 'exact') {
        filteredCount++
        return
      }

      events.push(toImportableEvent(event, index, duplicateResult))
    })

    return actionSuccess({ events, filteredCount })
  } catch (error) {
    logger.error('Scraping error:', error)
    return actionError(ERR_SCRAPING_FAILED)
  }
}

/**
 * 選択されたイベントをインポート
 */
export async function importSelectedEvents(
  events: ImportableEvent[]
): Promise<ActionResult<{ importedCount: number }>> {
  // 管理者チェック
  const admin = await requireAdmin('events:manage')
  if ('error' in admin) return actionError(admin.error)
  const userId = admin.userId

  if (!events || events.length === 0) {
    return actionError(ERR_NO_EVENTS_SELECTED)
  }

  try {
    // 1) 有効なイベントのみを抽出（startDate 必須）
    //    type predicate で非 null に絞り込み、以降 `as string` キャストを排除する
    const validEvents = events.filter(
      (event): event is ImportableEvent & { startDate: string } =>
        typeof event.startDate === 'string' && event.startDate.length > 0,
    )
    if (validEvents.length === 0) {
      return actionSuccess({ importedCount: 0 })
    }

    // 2) 既存イベントを一括取得（N+1 回避）
    //    (title, startDate) の組を OR 条件でまとめて検索し、クライアント側で重複判定する。
    const existingEvents = await prisma.event.findMany({
      where: {
        isHidden: false,
        OR: validEvents.map((event) => ({
          title: event.title,
          startDate: new Date(event.startDate),
        })),
      },
      select: { title: true, startDate: true },
    })

    // 重複判定用 Set (title + ISO date 文字列)
    const existingKey = (title: string, startDate: Date) =>
      `${title}\u0000${startDate.toISOString()}`
    const existingKeys = new Set(
      existingEvents.map((e) => existingKey(e.title, e.startDate))
    )

    // 3) 重複以外を createMany で一括挿入
    const toCreate = validEvents
      .filter((event) => {
        const key = existingKey(event.title, new Date(event.startDate))
        return !existingKeys.has(key)
      })
      .map((event) => ({
        title: event.title,
        description: event.description || null,
        startDate: new Date(event.startDate),
        endDate: event.endDate ? new Date(event.endDate) : null,
        prefecture: event.prefecture || null,
        city: event.city || null,
        venue: event.venue || null,
        organizer: event.organizer || null,
        admissionFee: event.admissionFee || null,
        hasSales: event.hasSales,
        externalUrl: event.externalUrl || null,
        createdBy: userId,
      }))

    if (toCreate.length === 0) {
      return actionSuccess({ importedCount: 0 })
    }

    const { count } = await prisma.event.createMany({ data: toCreate })

    // キャッシュ再検証
    revalidatePath(ROUTE_EVENTS)
    revalidatePath(ROUTE_ADMIN_EVENTS)

    return actionSuccess({ importedCount: count })
  } catch (error) {
    logger.error('Import error:', error)
    return actionError(ERR_IMPORT_FAILED)
  }
}

/**
 * 利用可能な地方リストを取得
 */
export async function getAvailableRegions(): Promise<
  { regions: { id: string; name: string; url: string }[] }
> {
  return {
    regions: BONSAI_EVENT_SOURCES.map((source) => ({
      id: source.region,
      name: source.region,
      url: source.url,
    })),
  }
}
