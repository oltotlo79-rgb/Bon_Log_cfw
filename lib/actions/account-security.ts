/**
 * アカウントセキュリティ関連 Server Actions（パスワード変更・メールアドレス変更等）。
 *
 * @module lib/actions/account-security
 *
 * コア処理（Prisma 操作・パスワード検証）は lib/services/password-change-service.ts /
 * lib/services/email-change-service.ts に委譲する。
 * このファイルは 認証 → Zod → レート制限 → service 呼び出し → revalidatePath の薄いラッパ。
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import {
  requireActiveNonGuestUser,
  actionSuccess,
  actionError,
  enforceUserRateLimit,
  getClientIp,
  type ActionResult,
} from '@/lib/actions/utils'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { changeUserPasswordCore } from '@/lib/services/password-change-service'
import { requestEmailChangeCore, confirmEmailChangeCore } from '@/lib/services/email-change-service'
import { passwordSchema } from '@/lib/validations/password'
import { normalizedEmailSchema } from '@/lib/actions/schemas/common'
import { MIN_TOKEN_LENGTH } from '@/lib/constants/limits'
import {
  ERR_INVALID_INPUT,
  ERR_NO_PASSWORD_SET,
  ERR_INCORRECT_PASSWORD,
  ERR_EMAIL_CHANGE_TOO_MANY,
  ERR_EMAIL_CHANGE_LINK_INVALID,
  ERR_EMAIL_ALREADY_IN_USE,
} from '@/lib/constants/errors'
import { ROUTE_SETTINGS_SECURITY, ROUTE_SETTINGS_ACCOUNT } from '@/lib/constants/routes'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

const requestEmailChangeSchema = z.object({
  newEmail: normalizedEmailSchema,
  currentPassword: z.string().min(1),
})

const confirmEmailChangeSchema = z.string().min(MIN_TOKEN_LENGTH)

/**
 * ログイン中ユーザーのパスワードを変更する。
 *
 * 現パスワードの確認が必須（Phase 1: 2FA 有効ユーザーへの TOTP 追加要求は行わない）。
 * OAuth 専用アカウント（パスワード未設定）はエラーになる。
 *
 * @param input - `currentPassword`（現パスワード）と `newPassword`（新パスワード）
 */
export async function changePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<ActionResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const message = first.newPassword?.[0] ?? first.currentPassword?.[0] ?? ERR_INVALID_INPUT
    return actionError(message)
  }

  const rl = await enforceUserRateLimit(userId, 'password_change')
  if (rl) return actionError(rl.error)

  const ip = await getClientIp()
  const result = await changeUserPasswordCore(
    userId,
    parsed.data.currentPassword,
    parsed.data.newPassword,
    ip,
  )
  if (!result.ok) return actionError(result.error)

  revalidatePath(ROUTE_SETTINGS_SECURITY)

  return actionSuccess()
}

/**
 * ログイン中ユーザーのメールアドレス変更をリクエストする（確認メール経由の二段階の第一段階）。
 *
 * 現パスワード確認必須。newEmail が既に使われている場合も含め、成功/失敗の大半を
 * `actionSuccess()` に丸めて返す（列挙攻撃対策。newEmail の使用状況を UI に一切漏らさない）。
 * 例外的に `currentPassword` 不一致・OAuth 専用アカウント（パスワード未設定）は
 * 本人が既に知っている自分のアカウント状態であり newEmail の enumeration にはならないため、
 * `actionError` でそのまま返してよい。
 *
 * @param input - `newEmail`（変更後のメールアドレス）と `currentPassword`（現パスワード）
 */
export async function requestEmailChange(input: {
  newEmail: string
  currentPassword: string
}): Promise<ActionResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = requestEmailChangeSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'email_change_request')
  if (rl) return actionError(rl.error)

  const ip = await getClientIp()
  const result = await requestEmailChangeCore(
    userId,
    parsed.data.currentPassword,
    parsed.data.newEmail,
    ip,
  )
  if (!result.ok && (result.error === ERR_INCORRECT_PASSWORD || result.error === ERR_NO_PASSWORD_SET)) {
    return actionError(result.error)
  }

  return actionSuccess()
}

/**
 * メールアドレス変更確認トークンを検証し、変更を確定する（第二段階）。
 *
 * トークン所持自体が新アドレスの所有性証明になるため、ログインセッションを要求しない
 * （password-reset の confirm と同じ設計）。Web の確認ページとモバイル API v1
 * `POST /api/v1/auth/email/change/confirm` の双方から同じ service を呼ぶ。
 * レート制限は IP ベース（未ログインでも呼べるため userId が無い）。
 *
 * @param token - メールリンクから渡された生トークン
 */
export async function confirmEmailChange(token: string): Promise<ActionResult> {
  const parsed = confirmEmailChangeSchema.safeParse(token)
  if (!parsed.success) return actionError(ERR_EMAIL_CHANGE_LINK_INVALID)

  const ip = await getClientIp()
  const preset = RATE_LIMITS.email_change_confirm
  const rl = await rateLimit(`email-change-confirm:${ip}`, {
    windowMs: preset.windowMs,
    maxRequests: preset.maxRequests,
    failOpen: preset.failOpen,
  })
  if (!rl.success) return actionError(ERR_EMAIL_CHANGE_TOO_MANY)

  const result = await confirmEmailChangeCore(parsed.data)
  if (!result.ok) {
    if (result.reason === 'email_taken') return actionError(ERR_EMAIL_ALREADY_IN_USE)
    return actionError(ERR_EMAIL_CHANGE_LINK_INVALID)
  }

  revalidatePath(ROUTE_SETTINGS_ACCOUNT)
  revalidatePath(ROUTE_SETTINGS_SECURITY)

  return actionSuccess()
}
