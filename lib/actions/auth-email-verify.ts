/**
 * メールアドレス確認系 Server Action。
 *
 * - 検証トークンは SHA-256 ハッシュで保存、1 日 TTL
 * - 再送はレート制限 (1時間 3 回 / IP) で fail-closed
 * - 列挙攻撃対策: ユーザー不在 / 確認済みでも success を返す
 *
 * 互換のため `@/lib/actions/auth` 経由でも参照可能 (re-export)。
 *
 * @module lib/actions/auth-email-verify
 */
'use server'

import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import {
  MAX_RESEND_VERIFICATION_ATTEMPTS,
  MIN_TOKEN_LENGTH,
  ONE_HOUR_MS,
} from '@/lib/constants/limits'
import {
  ERR_INVALID_TOKEN,
  ERR_RESEND_TOO_MANY,
  ERR_TOKEN_EXPIRED,
  ERR_TOKEN_EXPIRED_OR_INVALID,
  ERR_VERIFICATION_EMAIL_FAILED,
} from '@/lib/constants/errors/auth'
import { getClientIp, actionSuccess, actionError } from '@/lib/actions/utils'
import { normalizedEmailSchema } from '@/lib/actions/schemas/common'
import { resendVerificationEmailCore } from '@/lib/services/email-verify-core'

const resendVerificationSchema = z.object({
  email: normalizedEmailSchema,
})

/**
 * メール確認トークンを検証し、ユーザーの emailVerified を更新する。
 */
export async function verifyEmailToken(token: string) {
  if (!token || typeof token !== 'string' || token.length < MIN_TOKEN_LENGTH) {
    return actionError(ERR_INVALID_TOKEN)
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token: hashedToken },
  })

  if (!record) {
    return actionError(ERR_TOKEN_EXPIRED_OR_INVALID)
  }

  if (record.expires < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } })
    return actionError(ERR_TOKEN_EXPIRED)
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.email },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.delete({ where: { id: record.id } }),
  ])

  return actionSuccess()
}

/**
 * 確認メールを再送する (rate-limited: 3 per hour per IP)。
 *
 * Returns success even if the user doesn't exist or is already verified
 * to prevent email enumeration.
 */
export async function resendVerificationEmail(email: string) {
  // 1. Zod バリデーション + 正規化 — 不正形状は列挙対策で success を返す
  const parsed = resendVerificationSchema.safeParse({ email })
  if (!parsed.success) {
    return actionSuccess()
  }
  const validEmail = parsed.data.email

  const ip = await getClientIp()

  // 2. レート制限（Zod 通過後）
  // Redis 障害時はフェイルクローズ: メール乱用と列挙攻撃を防ぐ。
  const rateLimitResult = await rateLimit(`resend-verify:${ip}`, {
    windowMs: ONE_HOUR_MS,
    maxRequests: MAX_RESEND_VERIFICATION_ATTEMPTS,
    failOpen: false,
  })

  if (!rateLimitResult.success) {
    return actionError(ERR_RESEND_TOO_MANY)
  }

  // 3. コアロジック呼び出し（ユーザー不在・確認済みでも ok:true を返す設計）
  const coreResult = await resendVerificationEmailCore(validEmail)

  // メール送信失敗のみエラーを返す（ユーザー不在・確認済みは列挙攻撃対策で success のまま）
  if (!coreResult.ok && coreResult.reason === 'email_send_failed') {
    return actionError(ERR_VERIFICATION_EMAIL_FAILED)
  }

  return actionSuccess()
}
