/**
 * 時間定数
 *
 * @module lib/constants/limits/time
 */

/** 1秒（ミリ秒） */
export const ONE_SECOND_MS = 1000

/** 1分（ミリ秒） */
export const ONE_MINUTE_MS = 60 * 1000

/** 15分（ミリ秒） */
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

/** 1時間（ミリ秒） */
export const ONE_HOUR_MS = 60 * 60 * 1000

/** 1日（秒） */
export const ONE_DAY_SECONDS = 24 * 60 * 60

/** 1分（秒） */
export const SECONDS_PER_MINUTE = 60

/** 1日（ミリ秒） */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000

/** 30日（ミリ秒） */
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/** 1週間の日数 */
export const DAYS_PER_WEEK = 7

/** 1ヶ月の日数（相対時刻表示の近似） */
export const DAYS_PER_MONTH = 30

/** Redis TTL の真夜中バッファ（秒） */
export const MIDNIGHT_BUFFER_SECONDS = 60

/** Cronジョブのデフォルトタイムアウト秒数（Vercel Function制限） */
export const CRON_FUNCTION_TIMEOUT_SECONDS = 60
