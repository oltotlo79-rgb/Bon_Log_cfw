/**
 * デバイスフィンガープリント収集ユーティリティ
 *
 * FingerprintJSを使用してブラウザのフィンガープリントを収集し、
 * デバイス識別に使用します。
 *
 * @module lib/fingerprint
 */

import { clientLogger } from '@/lib/client-logger'
import { ONE_DAY_MS } from '@/lib/constants/limits'

type FingerprintAgent = { get: () => Promise<{ visitorId: string }> }

// シングルトンのFingerprintJSインスタンス
let fpPromise: Promise<FingerprintAgent> | null = null

/**
 * FingerprintJSインスタンスを取得する（シングルトン）。
 * ライブラリは login/register の初期バンドルから外すため動的 import する。
 */
function getFingerprintJS(): Promise<FingerprintAgent> {
  if (!fpPromise) {
    fpPromise = import('@fingerprintjs/fingerprintjs').then(({ default: FingerprintJS }) =>
      FingerprintJS.load()
    )
  }
  return fpPromise
}

/**
 * デバイスフィンガープリントを取得する
 *
 * @returns フィンガープリント（visitorId）
 *
 * @example
 * ```typescript
 * const fingerprint = await getFingerprint()
 * console.log(fingerprint) // "abc123..."
 * ```
 */
export async function getFingerprint(): Promise<string | null> {
  try {
    // サーバーサイドでは実行しない
    if (typeof window === 'undefined') {
      return null
    }

    const fp = await getFingerprintJS()
    const result = await fp.get()

    return result.visitorId
  } catch (error) {
    clientLogger.error('Failed to get fingerprint:', error)
    return null
  }
}

/**
 * フィンガープリントをローカルストレージにキャッシュする
 * （パフォーマンス向上のため）
 */
const FINGERPRINT_CACHE_KEY = 'device_fp'
const FINGERPRINT_CACHE_DURATION = ONE_DAY_MS

interface CachedFingerprint {
  value: string
  timestamp: number
}

/**
 * キャッシュされたフィンガープリントを取得する
 */
export function getCachedFingerprint(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(FINGERPRINT_CACHE_KEY)
    if (!cached) return null

    const data: CachedFingerprint = JSON.parse(cached)
    const now = Date.now()

    // キャッシュが有効期限内かチェック
    if (now - data.timestamp < FINGERPRINT_CACHE_DURATION) {
      return data.value
    }

    // 期限切れの場合は削除
    localStorage.removeItem(FINGERPRINT_CACHE_KEY)
    return null
  } catch {
    return null
  }
}

/**
 * フィンガープリントをキャッシュに保存する
 */
export function cacheFingerprint(fingerprint: string): void {
  if (typeof window === 'undefined') return

  try {
    const data: CachedFingerprint = {
      value: fingerprint,
      timestamp: Date.now(),
    }
    localStorage.setItem(FINGERPRINT_CACHE_KEY, JSON.stringify(data))
  } catch {
    // localStorage が使えない環境では無視
  }
}

/**
 * フィンガープリントを取得する（キャッシュ利用）
 *
 * まずキャッシュを確認し、なければ新規取得してキャッシュに保存します。
 *
 * @returns フィンガープリント
 */
export async function getFingerprintWithCache(): Promise<string | null> {
  // キャッシュをチェック
  const cached = getCachedFingerprint()
  if (cached) {
    return cached
  }

  // 新規取得
  const fingerprint = await getFingerprint()
  if (fingerprint) {
    cacheFingerprint(fingerprint)
  }

  return fingerprint
}
