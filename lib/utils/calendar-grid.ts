/**
 * カレンダーグリッド用の純粋関数群。
 *
 * 副作用なし・同期で、Server Actions の Zod スキーマと UI コンポーネントの
 * 両方から再利用される。タイムゾーンはローカル基準（既存 `EventCalendar` と同方針）。
 *
 * @module lib/utils/calendar-grid
 */

import {
  addMonths,
  endOfMonth,
  startOfMonth,
  subMonths,
} from 'date-fns'
import {
  BONSAI_CALENDAR_ANCHOR_PATTERN,
  CALENDAR_MODE_MONTH_COUNT,
  type CalendarMode,
} from '@/lib/constants/bonsai-care'
import type { CareLogListItem } from '@/types/bonsai-care'

/**
 * 表示モードと anchor（ウィンドウ右端＝最新月）から、
 * カレンダーで取得すべき範囲 `[from, to)` を返す。
 *
 * - 1ヶ月ビュー: anchor 月の初日 〜 翌月初日
 * - 6/12ヶ月ビュー: (anchor から N-1 ヶ月遡った月の初日) 〜 anchor 翌月初日
 *
 * `to` は半開区間の上限なので、Prisma `lt` と整合する。
 */
export function resolveCalendarRange(
  mode: CalendarMode,
  anchor: Date,
): { from: Date; to: Date } {
  const monthCount = CALENDAR_MODE_MONTH_COUNT[mode]
  const oldestMonthStart = startOfMonth(subMonths(anchor, monthCount - 1))
  const newestMonthEnd = endOfMonth(anchor)
  // half-open: to = newestMonthEnd の翌ミリ秒（≒ 翌月 1 日 00:00）
  return {
    from: oldestMonthStart,
    to: new Date(newestMonthEnd.getTime() + 1),
  }
}

/**
 * anchor を ±N ヶ月シフトし、月の初日 00:00（ローカル）を返す。
 * 月の途中の日付を渡しても、月初に正規化される。
 */
export function shiftAnchor(anchor: Date, deltaMonths: number): Date {
  return startOfMonth(addMonths(anchor, deltaMonths))
}

/**
 * `YYYY-MM` 文字列を Date（その月の 1 日 00:00 ローカル）にパースする。
 * 不正値や存在しない年月は null を返す（呼び出し側で今月にフォールバック想定）。
 */
export function parseAnchor(input: string): Date | null {
  if (!BONSAI_CALENDAR_ANCHOR_PATTERN.test(input)) return null
  const [yearStr, monthStr] = input.split('-')
  const year = Number(yearStr)
  const monthIdx = Number(monthStr) - 1 // Date コンストラクタの月は 0 始まり
  // パターン上 1 ≤ monthIdx+1 ≤ 12 が保証されているが、防御的に検証
  if (!Number.isFinite(year) || !Number.isFinite(monthIdx)) return null
  if (monthIdx < 0 || monthIdx > 11) return null
  const date = new Date(year, monthIdx, 1, 0, 0, 0, 0)
  // setFullYear をしないと 0-99 が 1900-1999 と解釈される。
  // year を直接コンストラクタに渡しても 100 未満の場合は同じ問題があるため、
  // 取り込み後の getFullYear() と一致するかで検証する。
  if (date.getFullYear() !== year || date.getMonth() !== monthIdx) {
    return null
  }
  return date
}

/** Date を `YYYY-MM` ローカル文字列にフォーマットする（URL 用）。 */
export function formatAnchor(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * モードと anchor から、カレンダーに表示する月配列を返す（古い順 → 新しい順）。
 * 各 Date はその月の 1 日 00:00。
 */
export function listDisplayMonths(mode: CalendarMode, anchor: Date): Date[] {
  const monthCount = CALENDAR_MODE_MONTH_COUNT[mode]
  const result: Date[] = []
  for (let i = monthCount - 1; i >= 0; i--) {
    result.push(startOfMonth(subMonths(anchor, i)))
  }
  return result
}

/**
 * 年・月・日から有効な Date を返す。存在しない日（例: 2月30日）は null。
 * `monthIdx` は 0 始まり（Date コンストラクタと同じ）。
 */
export function resolveDateInMonth(
  year: number,
  monthIdx: number,
  day: number,
): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(monthIdx) || !Number.isInteger(day)) {
    return null
  }
  if (monthIdx < 0 || monthIdx > 11) return null
  if (day < 1 || day > 31) return null
  const d = new Date(year, monthIdx, day, 0, 0, 0, 0)
  // 「2月30日」のような繰り上がりを検出する
  if (d.getFullYear() !== year || d.getMonth() !== monthIdx || d.getDate() !== day) {
    return null
  }
  return d
}

/** ローカルタイムゾーンでの `YYYY-MM-DD` キー文字列を返す。 */
export function localDateKey(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 手入れログ配列を `YYYY-MM-DD` キーで Map にグルーピングする。
 * 同一日内のログは `performedAt` 昇順で並ぶ（呼び出し側でソート済みの場合は順序維持）。
 */
export function groupLogsByDate(
  logs: readonly CareLogListItem[],
): Map<string, CareLogListItem[]> {
  return groupItemsByDate(logs, (log) => log.performedAt)
}

/**
 * 任意の項目配列を、項目から取り出した Date を `YYYY-MM-DD` キーに変換してグルーピングする。
 * 入力配列の順序を保持する（呼び出し側でソート済みなら同一日内も昇順）。
 *
 * 呼び出し元（Server Action 層）で Date への再水和が完了している前提。
 */
export function groupItemsByDate<T>(
  items: readonly T[],
  getDate: (item: T) => Date,
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = localDateKey(getDate(item))
    const bucket = map.get(key)
    if (bucket) {
      bucket.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return map
}
