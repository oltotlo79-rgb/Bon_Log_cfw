/**
 * アプリ全体で使う汎用ヘルパー。
 *
 * @module lib/utils
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { JST_OFFSET_MS, ONE_DAY_MS } from '@/lib/constants/limits/time'

/**
 * Tailwind クラスを条件付きで結合し、競合（例: `p-4 p-2` → `p-2`）を解決する。
 * shadcn/ui の慣習に沿った関数名。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 現在時刻の JST 暦日の 00:00:00 JST（UTC では前日 15:00:00 UTC）を表す Date を返す。
 *
 * Why JST 固定: 日本向けサービスのため日次制限・統計の日界を JST 00:00 に揃える。
 * サーバーコンテナは TZ 未設定（UTC）のため setHours 等のローカル TZ 依存 API は使わず、
 * Date.UTC ベースで計算することで実行環境の TZ に一切依存しない。
 */
export function getStartOfToday(): Date {
  const nowUtcMs = Date.now()
  const jstMs = nowUtcMs + JST_OFFSET_MS
  const jstDate = new Date(jstMs)
  const jstYear = jstDate.getUTCFullYear()
  const jstMonth = jstDate.getUTCMonth()
  const jstDay = jstDate.getUTCDate()
  // JST 00:00 を UTC に変換して返す（= UTC では前日 15:00）
  return new Date(Date.UTC(jstYear, jstMonth, jstDay, 0, 0, 0, 0) - JST_OFFSET_MS)
}

/**
 * 現在時刻の JST 暦日の YYYY-MM-DD 文字列を返す。
 *
 * Why 専用ヘルパー: getStartOfToday() は UTC 表現の Date を返すため、
 * .toISOString().split('T')[0] すると「JST 日付 − 1 日」になる。
 * Redis キー等で「今日の JST 暦日」をラベルとして使う箇所はこちらを使う。
 */
export function getJstDateString(): string {
  const nowUtcMs = Date.now()
  const jstMs = nowUtcMs + JST_OFFSET_MS
  const jstDate = new Date(jstMs)
  const year = jstDate.getUTCFullYear()
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(jstDate.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 指定日の23時59分59秒999ミリ秒のDateを返す。
 * 日付範囲検索の終端等で使用。
 *
 * @param date - 基準日（省略時は今日）
 */
export function getEndOfDay(date?: Date): Date {
  const d = date ? new Date(date) : new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * N 日前の JST 暦日の 00:00:00 JST を表す Date を返す。
 *
 * Why JST 固定: getStartOfToday() と同じ理由でサーバー TZ に依存しない実装とする。
 * 日本は DST なしのため 1 日 = 固定 86400000ms で安全に計算できる。
 *
 * @param days - 何日前か（正の整数）
 */
export function getStartOfNDaysAgo(days: number): Date {
  return new Date(getStartOfToday().getTime() - days * ONE_DAY_MS)
}
