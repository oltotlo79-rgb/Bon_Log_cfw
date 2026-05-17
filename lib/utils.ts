/**
 * アプリ全体で使う汎用ヘルパー。
 *
 * @module lib/utils
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Tailwind クラスを条件付きで結合し、競合（例: `p-4 p-2` → `p-2`）を解決する。
 * shadcn/ui の慣習に沿った関数名。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 今日の0時0分0秒のDateを返す。
 * 日次制限チェック等で使用。
 */
export function getStartOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
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
 * N日前の0時0分0秒のDateを返す。
 * 統計・分析の日付範囲計算等で使用。
 *
 * @param days - 何日前か（正の整数）
 */
export function getStartOfNDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date
}
