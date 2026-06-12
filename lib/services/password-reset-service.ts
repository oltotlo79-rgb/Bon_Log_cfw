/**
 * @module lib/services/password-reset-service
 *
 * パスワードリセットのコアロジック（services 層）。
 *
 * lib/actions/auth-password-reset.ts（Web Server Action）と
 * モバイル API /api/v1/auth/password-reset/* の双方から共有する。
 *
 * - トークン生成・保存（SHA-256 ハッシュのみ保存、生トークン非保存）
 * - メール送信
 * - トークン検証・パスワード更新
 *
 * レート制限は呼び出し元で実施済みの前提で、このサービスは実施しない。
 * 列挙攻撃対策（ユーザー不在でも success を返す）は呼び出し元の責務。
 */

import 'server-only'

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import logger from '@/lib/logger'
import { sanitizeInput } from '@/lib/sanitize'
import { logPasswordResetRequest, logPasswordResetSuccess } from '@/lib/security-logger'
import { getAppUrl } from '@/lib/env'
import {
  BCRYPT_SALT_ROUNDS,
  ONE_HOUR_MS,
  TOKEN_RANDOM_BYTES,
} from '@/lib/constants/limits'

export type PasswordResetRequestResult =
  | { ok: true }
  | { ok: false; reason: 'email_send_failed' }

export type PasswordResetConfirmResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_token' | 'user_not_found' }

/**
 * パスワードリセットメールを送信する。
 * ユーザーが存在しない場合は ok:true を返す（呼び出し元で列挙攻撃対策の統一レスポンスを返すこと）。
 *
 * @param email - 正規化済みメールアドレス
 * @param clientIp - ログ記録用 IP（セキュリティイベントに使用）
 */
export async function requestPasswordResetCore(
  email: string,
  clientIp: string,
): Promise<PasswordResetRequestResult> {
  logPasswordResetRequest(email, clientIp)

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { ok: true }
  }

  await prisma.passwordResetToken.deleteMany({ where: { email } })

  const token = crypto.randomBytes(TOKEN_RANDOM_BYTES).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  await prisma.passwordResetToken.create({
    data: {
      email,
      token: hashedToken,
      expires: new Date(Date.now() + ONE_HOUR_MS),
    },
  })

  const baseUrl = getAppUrl()
  const resetUrl = `${baseUrl}/password-reset/confirm?token=${token}&email=${encodeURIComponent(email)}`

  logger.log(
    'Attempting to send password reset email to:',
    sanitizeInput(email).replace(/(.{2}).*(@.*)/, '$1***$2'),
  )

  const result = await sendPasswordResetEmail(email, resetUrl)
  if (!result.success) {
    logger.error('Failed to send password reset email:', result.error)
    return { ok: false, reason: 'email_send_failed' }
  }

  return { ok: true }
}

/**
 * パスワードリセットトークンを検証し、新パスワードに更新する。
 *
 * @param email - 正規化済みメールアドレス
 * @param token - 生トークン（URL パラメータから受け取ったもの）
 * @param newPassword - 新パスワード（平文）
 */
export async function resetPasswordCore(
  email: string,
  token: string,
  newPassword: string,
): Promise<PasswordResetConfirmResult> {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      token: hashedToken,
      expires: { gt: new Date() },
    },
  })

  if (!resetToken) {
    return { ok: false, reason: 'invalid_token' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { ok: false, reason: 'user_not_found' }
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  })

  await prisma.passwordResetToken.deleteMany({ where: { email } })

  logPasswordResetSuccess(user.id)

  return { ok: true }
}
