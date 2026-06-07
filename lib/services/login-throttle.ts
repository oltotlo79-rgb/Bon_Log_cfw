/**
 * @module lib/services/login-throttle
 *
 * ログイン試行のスロットリング/ロックアウトを「リクエスト文脈（IP 解決込み）」で扱う
 * server-only サービス。`lib/auth.ts` の `authorize()` と `lib/actions/auth.ts` の
 * `verifyCredentials` の双方から共有され、ログイン失敗の記録・成功時のリセットを
 * **サーバー側の単一境界**へ集約する。
 *
 * Why server-only (not a Server Action):
 *   `'use server'` を付けると公開 RPC になり、任意クライアントが失敗カウンタの
 *   リセット等を直接叩けてしまう（旧 `clearLoginAttempts` の設計問題）。
 *   server-only モジュールにすることで RPC 露出を断ち、認証成功後の内部処理からのみ
 *   リセットが走るようにする。
 *
 * Redis 障害時の方針は `lib/login-tracker` を踏襲:
 *   - `checkLoginThrottleForRequest` は fail-closed（試行不能時はブロック）
 *   - `recordLoginFailureForRequest` は fail-open（記録失敗で正規ログインを阻害しない）
 */

import 'server-only'
import {
  checkLoginAttempt,
  recordFailedLogin,
  resetLoginAttempts,
  getLoginKey,
} from '@/lib/login-tracker'
import { sanitizeInput } from '@/lib/sanitize'
import { logLoginFailure, logLoginLockout } from '@/lib/security-logger'
import { getClientIp } from '@/lib/utils/request-ip'

/** ロックアウト判定の結果。`message` は拒否/ロック時のみ値が入る。 */
export type LoginThrottleStatus = {
  /** 直近の連続失敗回数がロック閾値未満なら true */
  allowed: boolean
  /** 利用者表示用メッセージ（拒否時のみ。許可時は undefined） */
  message?: string
  /** ロック前に残されている試行回数 */
  remainingAttempts: number
}

/**
 * ログインがブルートフォースレートリミットの観点で許可されるかを判定する。
 * IP + email の組合せをキーに使い、同一 IP から複数アカウントを狙う攻撃も検知する。
 */
export async function checkLoginThrottleForRequest(email: string): Promise<LoginThrottleStatus> {
  const ip = await getClientIp()
  const key = getLoginKey(ip, sanitizeInput(email))
  const result = await checkLoginAttempt(key)
  return {
    allowed: result.allowed,
    message: result.message,
    remainingAttempts: result.remainingAttempts,
  }
}

/**
 * ログイン失敗を記録しセキュリティイベントを発火する。
 * 新規ロック到達時は `LOGIN_LOCKOUT` も記録する。
 */
export async function recordLoginFailureForRequest(email: string): Promise<LoginThrottleStatus> {
  const ip = await getClientIp()
  const sanitizedEmail = sanitizeInput(email)
  const key = getLoginKey(ip, sanitizedEmail)

  const result = await recordFailedLogin(key)

  logLoginFailure(sanitizedEmail, ip, 'invalid_credentials')
  if (!result.allowed) {
    logLoginLockout(sanitizedEmail, ip)
  }

  return {
    allowed: result.allowed,
    message: result.message,
    remainingAttempts: result.remainingAttempts,
  }
}

/** ログイン成功時に試行カウンタをリセットする。失敗しても処理は続行する（致命的ではない）。 */
export async function resetLoginThrottleForRequest(email: string): Promise<void> {
  const ip = await getClientIp()
  const key = getLoginKey(ip, sanitizeInput(email))
  await resetLoginAttempts(key)
}
