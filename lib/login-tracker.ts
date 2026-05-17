/**
 * ログイン試行の追跡とロックアウト。
 *
 * IP+email 単位と IP 単独の 2 レイヤーでカウントし、一定回数で一時ロックする
 * （単独アカウント狙いの総当たりと、クレデンシャルスタッフィング両方に対応）。
 *
 * Redis 障害時の方針:
 * - `checkLoginAttempt` は **fail-close**（ログインを一時的にブロック）。
 *   Redis 不在のまま試行回数を可視化できない状況でブルートフォースを許可しないため。
 * - `recordFailedLogin` は **fail-open**（記録失敗時はリクエストを続行）。
 *   ログ欠損のために正規ユーザのログインを阻害しないため。
 *
 * @module lib/login-tracker
 */

import { getRedisClient } from './redis'
import logger from '@/lib/logger'
import { MAX_LOGIN_ATTEMPTS, MAX_IP_LOGIN_ATTEMPTS, LOGIN_WINDOW_MINUTES, LOGIN_LOCKOUT_MINUTES } from '@/lib/constants/limits'
import { z } from 'zod'

/** 試行カウントを集計する時間窓（秒）。超過するとカウントはリセットされる。 */
const WINDOW_SECONDS = LOGIN_WINDOW_MINUTES * 60

/** 上限到達時のロックアウト時間（秒）。 */
const LOCKOUT_SECONDS = LOGIN_LOCKOUT_MINUTES * 60

export interface LoginCheckResult {
  allowed: boolean
  remainingAttempts: number
  /** ロックアウト解除時刻（ms）。ロックされていなければ null。 */
  lockedUntil: number | null
  /** UI に出す用のメッセージ（拒否時に設定）。 */
  message?: string
}

/**
 * Redis に保存する試行データの形。
 * 破損データ（過去バージョン・手動書き換え）を弾くため Zod で検証する。
 */
const LoginAttemptDataSchema = z.object({
  count: z.number().int().nonnegative(),
  lockedUntil: z.number().nullable(),
})
type LoginAttemptData = z.infer<typeof LoginAttemptDataSchema>

/** Redis から試行データを取り出す。JSON 破損や型不整合時は null を返す。 */
async function getAttemptData(key: string): Promise<LoginAttemptData | null> {
  const redis = getRedisClient()
  const data = await redis.get(key)

  if (!data) return null

  try {
    // Upstash REST クライアントは自動でパース済みを返す場合がある
    const raw = typeof data === 'string' ? JSON.parse(data) : data
    const parsed = LoginAttemptDataSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

async function setAttemptData(key: string, data: LoginAttemptData, ttlSeconds: number): Promise<void> {
  const redis = getRedisClient()
  await redis.set(key, JSON.stringify(data), { ex: ttlSeconds })
}

/**
 * ログイン試行が許可されるかチェックする。
 * IP 単独側がロックされていれば即拒否、それ以外は IP+email 側の状態で判定する。
 */
export async function checkLoginAttempt(identifier: string): Promise<LoginCheckResult> {
  const key = `login_attempt:${identifier}`
  const now = Date.now()

  try {
    // identifier が "ip:email" 形式なら IP 単独側もチェック（クレデンシャルスタッフィング対策）
    const colonIndex = identifier.indexOf(':')
    if (colonIndex > 0) {
      const ip = identifier.substring(0, colonIndex)
      const ipKey = `login_attempt:ip_only:${ip}`
      const ipData = await getAttemptData(ipKey)

      if (ipData) {
        if (ipData.lockedUntil && ipData.lockedUntil > now) {
          const remainingSeconds = Math.ceil((ipData.lockedUntil - now) / 1000)
          const remainingMinutes = Math.ceil(remainingSeconds / 60)
          return {
            allowed: false,
            remainingAttempts: 0,
            lockedUntil: ipData.lockedUntil,
            message: `ログイン試行回数の上限に達しました。${remainingMinutes}分後に再試行してください。`,
          }
        }

        if (ipData.count >= MAX_IP_LOGIN_ATTEMPTS) {
          return {
            allowed: false,
            remainingAttempts: 0,
            lockedUntil: ipData.lockedUntil,
            message: 'ログイン試行回数の上限に達しました。しばらく待ってから再試行してください。',
          }
        }
      }
    }

    const data = await getAttemptData(key)

    if (!data) {
      return {
        allowed: true,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
        lockedUntil: null,
      }
    }

    if (data.lockedUntil && data.lockedUntil > now) {
      const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000)
      const remainingMinutes = Math.ceil(remainingSeconds / 60)
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: data.lockedUntil,
        message: `アカウントが一時的にロックされています。${remainingMinutes}分後に再試行してください。`,
      }
    }

    if (data.count >= MAX_LOGIN_ATTEMPTS) {
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: data.lockedUntil,
        message: 'ログイン試行回数の上限に達しました。しばらく待ってから再試行してください。',
      }
    }

    return {
      allowed: true,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - data.count,
      lockedUntil: null,
    }
  } catch (error) {
    logger.error('Login attempt check error:', error)
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: null,
      message: '一時的なエラーが発生しました。しばらく待ってから再試行してください。',
    }
  }
}

/**
 * ログイン失敗を記録し、上限到達時はロックアウトを発動する。
 * IP 単独側のカウンタも同時に更新する。
 */
export async function recordFailedLogin(identifier: string): Promise<LoginCheckResult> {
  const key = `login_attempt:${identifier}`
  const now = Date.now()

  try {
    const colonIndex = identifier.indexOf(':')
    if (colonIndex > 0) {
      const ip = identifier.substring(0, colonIndex)
      const ipKey = `login_attempt:ip_only:${ip}`
      const ipExisting = await getAttemptData(ipKey)
      if (!ipExisting) {
        await setAttemptData(ipKey, { count: 1, lockedUntil: null }, WINDOW_SECONDS)
      } else {
        const ipNewCount = ipExisting.count + 1
        if (ipNewCount >= MAX_IP_LOGIN_ATTEMPTS) {
          const lockedUntil = now + LOCKOUT_SECONDS * 1000
          await setAttemptData(ipKey, { count: ipNewCount, lockedUntil }, LOCKOUT_SECONDS)
        } else {
          await setAttemptData(ipKey, { count: ipNewCount, lockedUntil: null }, WINDOW_SECONDS)
        }
      }
    }

    const existing = await getAttemptData(key)

    if (!existing) {
      await setAttemptData(key, { count: 1, lockedUntil: null }, WINDOW_SECONDS)
      return {
        allowed: true,
        remainingAttempts: MAX_LOGIN_ATTEMPTS - 1,
        lockedUntil: null,
      }
    }

    const newCount = existing.count + 1

    if (newCount >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = now + LOCKOUT_SECONDS * 1000
      await setAttemptData(key, { count: newCount, lockedUntil }, LOCKOUT_SECONDS)
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil,
        message: `ログイン試行回数の上限に達しました。${LOCKOUT_SECONDS / 60}分後に再試行してください。`,
      }
    }

    await setAttemptData(key, { count: newCount, lockedUntil: null }, WINDOW_SECONDS)
    return {
      allowed: true,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - newCount,
      lockedUntil: null,
    }
  } catch (error) {
    // Redis 障害時は fail-open（checkLoginAttempt と方針を合わせる）
    logger.error('Record failed login error:', error)
    return {
      allowed: true,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      lockedUntil: null,
    }
  }
}

/** ログイン成功時に試行カウンタをリセットする。失敗しても処理は続行する（致命的ではない）。 */
export async function resetLoginAttempts(identifier: string): Promise<void> {
  const redis = getRedisClient()
  const key = `login_attempt:${identifier}`
  try {
    await redis.del(key)
  } catch (error) {
    logger.error('Reset login attempts error:', error)
  }
}

/**
 * IP+email 単位のトラッキングキーを生成する。
 *
 * IP だけでは NAT 配下で巻き添え、email だけでは攻撃者の IP 分散で無意味になるため
 * 組み合わせる。email は lowercase に正規化。
 */
export function getLoginKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`
}

/**
 * IP 単独のトラッキングキー。
 * 同一 IP から多数の email を試すクレデンシャルスタッフィング検知用。
 */
export function getIpOnlyKey(ip: string): string {
  return `ip_only:${ip}`
}
