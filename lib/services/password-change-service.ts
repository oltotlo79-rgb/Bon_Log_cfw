/**
 * @module lib/services/password-change-service
 *
 * ログイン中ユーザーの現パスワード確認によるパスワード変更コアロジック。
 *
 * lib/actions/account-security.ts（Web Server Action）と
 * app/api/v1/auth/password/change（モバイル API）の双方から共有する。
 * two-factor-service.ts の disable2FAForUser と同じ戻り値慣習
 * （`{ ok: true } | { ok: false, error }`、error は既存 ERR_* 定数）に合わせる。
 *
 * 認証・Zod バリデーション・レート制限は呼び出し元が担う前提。
 * Phase 1 は現パスワード確認のみとし、2FA 有効ユーザーへの TOTP 追加要求は行わない
 * （将来 Phase で必要になった場合に拡張できるよう戻り値は discriminated union にしてある）。
 */

import 'server-only'

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { BCRYPT_SALT_ROUNDS } from '@/lib/constants/limits'
import { ERR_USER_NOT_FOUND, ERR_NO_PASSWORD_SET, ERR_INCORRECT_PASSWORD } from '@/lib/constants/errors'
import { logPasswordChangeSuccess } from '@/lib/security-logger'

export type ChangePasswordResult = { ok: true } | { ok: false; error: string }

/**
 * ログイン中ユーザーのパスワードを変更する。
 *
 * OAuth 専用アカウント（`password` が null）は変更不可として扱う
 * （現パスワードという概念自体が存在しないため）。
 *
 * @param ip - 監査ログ記録用 IP（呼び出し元で取得済みのものを渡す）
 */
export async function changeUserPasswordCore(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ip?: string,
): Promise<ChangePasswordResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })

  if (!user) return { ok: false, error: ERR_USER_NOT_FOUND }
  if (!user.password) return { ok: false, error: ERR_NO_PASSWORD_SET }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
  if (!isCurrentPasswordValid) return { ok: false, error: ERR_INCORRECT_PASSWORD }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS)

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  })

  logPasswordChangeSuccess(userId, ip)

  return { ok: true }
}
