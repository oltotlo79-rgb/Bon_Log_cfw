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
import { sendVerificationEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/env'
import { rateLimit } from '@/lib/rate-limit'
import {
  MAX_RESEND_VERIFICATION_ATTEMPTS,
  MIN_TOKEN_LENGTH,
  ONE_DAY_MS,
  ONE_HOUR_MS,
  TOKEN_RANDOM_BYTES,
} from '@/lib/constants/limits'
import {
  ERR_EMAIL_SEND_FAILED,
  ERR_INVALID_TOKEN,
  ERR_RESEND_TOO_MANY,
  ERR_TOKEN_EXPIRED,
  ERR_TOKEN_EXPIRED_OR_INVALID,
} from '@/lib/constants/errors/auth'
import { getClientIp, actionSuccess, actionError } from '@/lib/actions/utils'
import { normalizedEmailSchema } from '@/lib/actions/schemas/common'

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

  const user = await prisma.user.findUnique({
    where: { email: validEmail },
    select: { id: true, emailVerified: true },
  })

  // Return success even if user not found or already verified (enumeration prevention)
  if (!user) {
    return actionSuccess()
  }

  if (user.emailVerified) {
    return actionSuccess()
  }

  await prisma.emailVerificationToken.deleteMany({
    where: { email: validEmail },
  })

  const token = crypto.randomBytes(TOKEN_RANDOM_BYTES).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
  const expires = new Date(Date.now() + ONE_DAY_MS)

  await prisma.emailVerificationToken.create({
    data: {
      email: validEmail,
      token: hashedToken,
      expires,
    },
  })

  const baseUrl = getAppUrl()
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`

  const result = await sendVerificationEmail(validEmail, verifyUrl)
  if (!result.success) {
    return actionError(ERR_EMAIL_SEND_FAILED)
  }

  return actionSuccess()
}
