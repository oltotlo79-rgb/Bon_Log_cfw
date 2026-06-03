/**
 * @module lib/two-factor-login-ticket
 *
 * ログイン時 2FA のサーバーサイド強制に使うワンタイムチケット。
 *
 * Why: NextAuth credentials の `authorize()` はセッション発行の唯一の境界だが、
 * そこで TOTP を直接受け取ると `verify2FAToken` のレート制限・バックアップコード消費・
 * 詳細エラーUX を二重実装することになる。代わりに `verify2FAToken` 成功時に高エントロピーの
 * 単回使用チケットを Redis 発行し、`authorize()` は 2FA 有効ユーザーに対してそのチケットの
 * 検証・消費のみを必須化する。チケットはブルートフォース不可・短命・単回使用のため、
 * `signIn('credentials')` の直叩きによる 2FA バイパスを塞ぐ。
 */

import { getRedisClient } from '@/lib/redis'
import { TWO_FACTOR_LOGIN_TICKET_TTL_SECONDS } from '@/lib/constants/limits'

const TWO_FACTOR_LOGIN_TICKET_PREFIX = '2fa_login_ticket'

function buildTicketKey(email: string, ticket: string): string {
  return `${TWO_FACTOR_LOGIN_TICKET_PREFIX}:${email}:${ticket}`
}

/**
 * 2FA 検証成功時に単回使用チケットを発行する。
 * キーに email を含めるため、別 email のチケットで認可を通すことはできない。
 */
export async function issueTwoFactorLoginTicket(email: string): Promise<string> {
  const ticket = globalThis.crypto.randomUUID()
  const redis = getRedisClient()
  await redis.set(buildTicketKey(email, ticket), '1', {
    ex: TWO_FACTOR_LOGIN_TICKET_TTL_SECONDS,
  })
  return ticket
}

/**
 * チケットを検証し、有効なら消費（削除）して true を返す。
 * 空文字・期限切れ・存在しないチケットはすべて false（fail-closed）。
 */
export async function consumeTwoFactorLoginTicket(
  email: string,
  ticket: string
): Promise<boolean> {
  if (!ticket) return false
  const redis = getRedisClient()
  const key = buildTicketKey(email, ticket)
  // GETDEL でアトミックに取得+削除する。get→del の 2 段だと TTL 内の並行 authorize() で
  // 同一チケットが二重消費されうるため、単一コマンドで読み取りと無効化を不可分にする。
  const existing = await redis.getdel(key)
  return existing !== null
}
