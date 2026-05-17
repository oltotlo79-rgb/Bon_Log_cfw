/**
 * 盆栽手入れログ（BonsaiCareLog）関連の数値制限。
 *
 * カレンダービューは 1ヶ月 / 6ヶ月 / 12ヶ月の 3 モードを持ち、
 * いずれも 1 日セル（最大 31 行）× 月列の 2 次元グリッドで表示する。
 *
 * @module lib/constants/limits/bonsai-care
 */

import { ONE_DAY_MS } from './time'

/** 任意コメントの最大文字数 */
export const MAX_BONSAI_CARE_NOTE_LENGTH = 500

/**
 * 範囲クエリ（getCareLogsInRange）で許容する最大日数。
 * 12 ヶ月ビューが最大 366 日を要求するため、1 日の余裕を持たせて 367 に設定。
 * DoS および index range scan の肥大化防止。
 */
export const MAX_CARE_LOG_RANGE_DAYS = 367

/**
 * 未来日のトレランス（ミリ秒）。
 * タイムゾーン差・時刻ズレを吸収するため、+1 日まで許容する。
 */
export const CARE_LOG_FUTURE_TOLERANCE_MS = ONE_DAY_MS

/** unstable_cache の revalidate 秒数 */
export const CARE_LOG_CACHE_SEC = 60

/** 月の最大日数（31日。マルチ月ビューの固定行数） */
export const MAX_DAYS_IN_MONTH = 31

/**
 * マルチ月ビュー（6ヶ月 / 12ヶ月）のセル最小幅（px）。
 * これより狭くなると視認性が落ちるため、モバイルでは横スクロールにフォールバック。
 */
export const MULTIMONTH_CELL_MIN_WIDTH_PX = 32

/** 1 日セルに表示する最大ドット数（超過時は「+N」と数字表示） */
export const MAX_DOTS_PER_CELL = 3

/**
 * カレンダー Day Sheet 内で投稿/成長記録カードに表示する本文の最大文字数。
 * 長文でカードが膨らんでレイアウトが崩れるのを防ぐ。超過時は省略記号を付ける。
 */
export const CALENDAR_SHEET_PREVIEW_MAX_LENGTH = 80
