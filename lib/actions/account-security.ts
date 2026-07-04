/**
 * アカウントセキュリティ関連 Server Actions（パスワード変更等）。
 *
 * @module lib/actions/account-security
 *
 * コア処理（Prisma 操作・パスワード検証）は lib/services/password-change-service.ts に委譲する。
 * このファイルは 認証 → Zod → レート制限 → service 呼び出し → revalidatePath の薄いラッパ。
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit, getClientIp, type ActionResult } from '@/lib/actions/utils'
import { changeUserPasswordCore } from '@/lib/services/password-change-service'
import { passwordSchema } from '@/lib/validations/password'
import { ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_SETTINGS_SECURITY } from '@/lib/constants/routes'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

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
