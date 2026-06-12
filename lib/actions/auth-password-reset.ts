/**
 * パスワードリセット系 Server Action。
 *
 * - 列挙攻撃対策: ユーザー不在でも success を返す
 * - レート制限: IP + email キーで fail-closed (Redis 障害時も拒否)
 * - トークン: SHA-256 ハッシュで保存、1 時間 TTL
 *
 * 互換のため `@/lib/actions/auth` 経由でも参照可能 (re-export)。
 *
 * @module lib/actions/auth-password-reset
 */
'use server'

import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { sanitizeInput } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rate-limit'
import {
  MAX_PASSWORD_RESET_ATTEMPTS,
  MIN_TOKEN_LENGTH,
  ONE_HOUR_MS,
} from '@/lib/constants/limits'
import {
  ERR_EMAIL_SEND_FAILED,
  ERR_INVALID_TOKEN,
  ERR_RESET_LINK_INVALID,
  ERR_RESET_TOO_MANY,
} from '@/lib/constants/errors/auth'
import {
  ERR_INPUT_INVALID_GENERIC,
} from '@/lib/constants/errors/content'
import { ERR_USER_NOT_FOUND } from '@/lib/constants/errors/entity'
import { getClientIp, actionSuccess, actionError } from '@/lib/actions/utils'
import { normalizedEmailSchema } from '@/lib/actions/schemas/common'
import { passwordSchema } from '@/lib/validations/password'
import type { ActionResult } from '@/types/action-result'
import {
  requestPasswordResetCore,
  resetPasswordCore,
} from '@/lib/services/password-reset-service'

const passwordResetRequestSchema = z.object({
  email: normalizedEmailSchema,
})

const passwordResetConfirmSchema = z.object({
  email: normalizedEmailSchema,
  token: z.string().min(MIN_TOKEN_LENGTH, ERR_INVALID_TOKEN),
  newPassword: passwordSchema,
})

/**
 * パスワードリセットメールを送信する。
 *
 * 列挙攻撃対策: ユーザー不在時も success を返す。
 * トークンは SHA-256 ハッシュで保存し、1 時間で expire。
 */
export async function requestPasswordReset(email: string) {
  // 1. 入力検証 (Zod schema) — rate limit より前
  const parsed = passwordResetRequestSchema.safeParse({ email })
  if (!parsed.success) {
    // 列挙攻撃対策として失敗時もユーザーが存在しなかった時と同等のレスポンスを返す
    return actionSuccess()
  }
  const { email: validEmail } = parsed.data

  // 2. レート制限 (IP + email)。Redis 障害時はフェイルクローズで列挙攻撃・乱用を遮断
  const ip = await getClientIp()
  const rateLimitResult = await rateLimit(
    `password-reset:${ip}:${sanitizeInput(validEmail)}`,
    {
      windowMs: ONE_HOUR_MS,
      maxRequests: MAX_PASSWORD_RESET_ATTEMPTS,
      failOpen: false,
    },
  )

  if (!rateLimitResult.success) {
    return actionError(ERR_RESET_TOO_MANY)
  }

  const coreResult = await requestPasswordResetCore(validEmail, ip)
  if (!coreResult.ok) {
    return actionError(ERR_EMAIL_SEND_FAILED)
  }

  return actionSuccess()
}

/**
 * パスワードリセットトークンを検証し、新パスワードに更新する。
 */
export async function resetPassword(data: {
  email: string
  token: string
  newPassword: string
}) {
  // 1. 入力検証 (Zod schema) — token / email / password 形式を rate limit より前に検証
  const parsed = passwordResetConfirmSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const message =
      first.newPassword?.[0] ?? first.email?.[0] ?? first.token?.[0] ?? ERR_INPUT_INVALID_GENERIC
    return actionError(message)
  }
  const { email, token, newPassword } = parsed.data

  // 2. レート制限 (IP + email)。token 自体が十分長くても他の auth action と防御を統一
  const ip = await getClientIp()
  const rateLimitResult = await rateLimit(
    `password-reset-confirm:${ip}:${sanitizeInput(email)}`,
    {
      windowMs: ONE_HOUR_MS,
      maxRequests: MAX_PASSWORD_RESET_ATTEMPTS,
      failOpen: false,
    },
  )
  if (!rateLimitResult.success) {
    return actionError(ERR_RESET_TOO_MANY)
  }

  // 3. token 検証 + パスワード更新（services に委譲）
  const coreResult = await resetPasswordCore(email, token, newPassword)

  if (!coreResult.ok) {
    if (coreResult.reason === 'user_not_found') {
      return actionError(ERR_USER_NOT_FOUND)
    }
    return actionError(ERR_RESET_LINK_INVALID)
  }

  return actionSuccess()
}

const verifyResetTokenSchema = z.object({
  email: normalizedEmailSchema,
  token: z.string().min(MIN_TOKEN_LENGTH),
})

/**
 * パスワードリセットトークンが有効かつ未失効かを確認する。
 * リセットフォーム表示前のチェックに使用。
 *
 * 入力不正やレート超過は列挙面を作らないため `actionSuccess({ valid: false })` で返す。
 * レート超過時のみ `actionError(...)` でクライアントにフィードバックする。
 */
export async function verifyPasswordResetToken(
  email: string,
  token: string,
): Promise<ActionResult<{ valid: boolean }>> {
  // 1. Zod バリデーション — 不正形状はトークン照合せず valid:false（列挙面を作らない）
  const parsed = verifyResetTokenSchema.safeParse({ email, token })
  if (!parsed.success) {
    return actionSuccess({ valid: false })
  }
  const { email: validEmail, token: validToken } = parsed.data

  // 2. IP + email でレート制限（fail-closed）
  const ip = await getClientIp()
  const rateLimitResult = await rateLimit(
    `verify-reset-token:${ip}:${sanitizeInput(validEmail)}`,
    {
      windowMs: ONE_HOUR_MS,
      maxRequests: MAX_PASSWORD_RESET_ATTEMPTS,
      failOpen: false,
    },
  )
  if (!rateLimitResult.success) {
    return actionError(ERR_RESET_TOO_MANY)
  }

  // 3. トークン照合
  const hashedToken = crypto.createHash('sha256').update(validToken).digest('hex')

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      email: validEmail,
      token: hashedToken,
      expires: { gt: new Date() },
    },
  })

  return actionSuccess({ valid: !!resetToken })
}
