/**
 * @module lib/cron-auth
 * Cron Job 認証。Vercel Cron が送信する `Authorization: Bearer <CRON_SECRET>` と、
 * 外部スケジューラから送る HMAC-SHA256 署名 + timestamp の両方を受け付ける。
 *
 * 設計上の選択:
 *   - Vercel Cron は HMAC ヘッダを付与しない (https://vercel.com/docs/cron-jobs)。
 *     ここで Bearer を拒否すると本番 cron がすべて 401 で死ぬ。
 *   - HMAC + timestamp は外部スケジューラのリプレイ攻撃耐性を持つ強い方式として併存。
 *   - HMAC を必須化したい運用では `DISABLE_LEGACY_CRON_AUTH=true` を設定し Bearer を無効化する。
 */

import crypto from 'crypto'
import logger from '@/lib/logger'
import { CRON_TIMESTAMP_TOLERANCE_MINUTES, ONE_MINUTE_MS } from '@/lib/constants/limits'
import {
  API_ERR_CRON_SECRET_MISSING,
  API_ERR_CRON_INVALID_SCHEME,
  API_ERR_CRON_MISSING_TIMESTAMP,
  API_ERR_CRON_INVALID_TIMESTAMP,
  API_ERR_CRON_TIMESTAMP_EXPIRED,
  API_ERR_CRON_INVALID_SIGNATURE,
} from '@/lib/constants/errors'
import { getCronSecret, isProduction, isLegacyCronAuthDisabled } from '@/lib/env'

const TIMESTAMP_TOLERANCE_MS = CRON_TIMESTAMP_TOLERANCE_MINUTES * ONE_MINUTE_MS

const BEARER_PREFIX = 'Bearer '
const HMAC_PREFIX = 'HMAC '

/**
 * Bearer 認証ヘッダを定数時間比較で照合する。
 * `===` は短絡評価により一致桁数からの timing leak が原理的に存在するため、
 * 共有秘密の比較は必ず `timingSafeEqual` を使う。
 */
function isValidBearer(authHeader: string, cronSecret: string): boolean {
  if (!authHeader.startsWith(BEARER_PREFIX)) return false
  const provided = Buffer.from(authHeader.slice(BEARER_PREFIX.length))
  const expected = Buffer.from(cronSecret)
  if (provided.length !== expected.length) return false
  return crypto.timingSafeEqual(provided, expected)
}

/**
 * Cron 認証ヘッダーを検証する。Bearer (Vercel Cron) と HMAC (外部) の両方式を受け付ける。
 */
export function verifyCronAuth(
  authHeader: string | null,
  timestampHeader: string | null,
  pathname?: string
): { valid: boolean; error?: string } {
  const cronSecret = getCronSecret()

  if (!cronSecret) {
    if (isProduction()) {
      return { valid: false, error: API_ERR_CRON_SECRET_MISSING }
    }
    logger.warn('Warning: CRON_SECRET is not set. Cron authentication is disabled.')
    return { valid: true }
  }

  // Vercel Cron は Authorization: Bearer <CRON_SECRET> のみ送信し、timestamp ヘッダは付けない。
  // ここを拒否すると vercel.json で定義した cron が production で全て 401 になる。
  if (
    !isLegacyCronAuthDisabled()
    && authHeader
    && !timestampHeader
    && isValidBearer(authHeader, cronSecret)
  ) {
    return { valid: true }
  }

  if (!authHeader?.startsWith(HMAC_PREFIX)) {
    return { valid: false, error: API_ERR_CRON_INVALID_SCHEME }
  }

  if (!timestampHeader) {
    return { valid: false, error: API_ERR_CRON_MISSING_TIMESTAMP }
  }

  const timestamp = parseInt(timestampHeader, 10)
  if (isNaN(timestamp)) {
    return { valid: false, error: API_ERR_CRON_INVALID_TIMESTAMP }
  }

  const now = Date.now()
  const timeDiff = Math.abs(now - timestamp)
  if (timeDiff > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, error: API_ERR_CRON_TIMESTAMP_EXPIRED }
  }

  const providedSignature = authHeader.slice(HMAC_PREFIX.length)
  const expectedSignature = generateCronSignature(timestampHeader, cronSecret, pathname)

  const providedBuf = Buffer.from(providedSignature)
  const expectedBuf = Buffer.from(expectedSignature)

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, error: API_ERR_CRON_INVALID_SIGNATURE }
  }

  return { valid: true }
}

/** Cron 認証用の HMAC-SHA256 署名を生成する。pathname を渡すと `timestamp:pathname` を署名対象にする。 */
export function generateCronSignature(timestamp: string, secret: string, pathname?: string): string {
  const message = pathname ? `${timestamp}:${pathname}` : timestamp
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')
}

/**
 * 外部スケジューラ / 手動テスト用の HMAC 認証ヘッダを生成する。
 * Vercel Cron からの呼び出しは Vercel 側で Bearer ヘッダを付与するため不要。
 */
export function generateCronHeaders(): { authorization: string; 'x-cron-timestamp': string } {
  const cronSecret = getCronSecret()
  if (!cronSecret) {
    throw new Error('CRON_SECRET is not set')
  }

  const timestamp = Date.now().toString()
  const signature = generateCronSignature(timestamp, cronSecret)

  return {
    authorization: `${HMAC_PREFIX}${signature}`,
    'x-cron-timestamp': timestamp,
  }
}
