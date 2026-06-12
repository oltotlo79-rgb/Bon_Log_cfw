/**
 * @module lib/api/v1/mobile-2fa-ticket
 *
 * モバイル API v1 専用の 2FA 一時チケット。
 *
 * Web の lib/two-factor-login-ticket.ts とは用途が異なる:
 *   - Web:    パスワード照合済み・TOTP 検証済みのセッション発行前チケット
 *   - Mobile: パスワード照合済み・TOTP 検証待ち状態を表すチケット
 *
 * Redis に userId を値として保持し、GETDEL で単回消費する。
 * TTL は MOBILE_2FA_TICKET_TTL_SECONDS（5 分）。
 */

import { getRedisClient } from '@/lib/redis'
import { MOBILE_2FA_TICKET_TTL_SECONDS } from '@/lib/constants/limits/mobile-auth'

const MOBILE_2FA_TICKET_PREFIX = 'mobile_2fa_ticket'

function buildMobile2FATicketKey(ticket: string): string {
  return `${MOBILE_2FA_TICKET_PREFIX}:${ticket}`
}

/**
 * パスワード照合成功後に 2FA 待ちチケットを発行する。
 * 値に userId を保持することで、チケット検証時に DB 参照不要でユーザーを特定できる。
 */
export async function issueMobile2FATicket(userId: string): Promise<string> {
  const ticket = globalThis.crypto.randomUUID()
  const redis = getRedisClient()
  await redis.set(buildMobile2FATicketKey(ticket), userId, {
    ex: MOBILE_2FA_TICKET_TTL_SECONDS,
  })
  return ticket
}

/**
 * チケットを検証し、有効なら消費（GETDEL）して userId を返す。
 * 存在しない / 期限切れ / 空文字は null を返す（fail-closed）。
 */
export async function consumeMobile2FATicket(ticket: string): Promise<string | null> {
  if (!ticket) return null
  const redis = getRedisClient()
  const userId = await redis.getdel(buildMobile2FATicketKey(ticket))
  return userId ?? null
}
