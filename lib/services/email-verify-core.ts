/**
 * @module lib/services/email-verify-core
 *
 * メールアドレス確認メール再送のコアロジック（services 層）。
 *
 * lib/actions/auth-email-verify.ts（Web Server Action）と
 * モバイル API /api/v1/auth/verify-email/resend の双方から共有する。
 *
 * - トークン生成・保存（SHA-256 ハッシュのみ保存、生トークン非保存）
 * - メール送信
 *
 * レート制限は呼び出し元で実施済みの前提で、このサービスは実施しない。
 * 列挙攻撃対策（ユーザー不在・確認済みでも ok:true を返す）は呼び出し元の責務。
 */

import 'server-only'

import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/env'
import {
  ONE_DAY_MS,
  TOKEN_RANDOM_BYTES,
} from '@/lib/constants/limits'

export type ResendVerificationEmailResult =
  | { ok: true }
  | { ok: false; reason: 'email_send_failed' }

/**
 * 確認メールを再送する。
 *
 * ユーザーが存在しない・確認済みの場合も ok:true を返す（呼び出し元で列挙攻撃対策の
 * 統一レスポンスを返すこと）。
 *
 * @param email - 正規化済みメールアドレス
 */
export async function resendVerificationEmailCore(
  email: string,
): Promise<ResendVerificationEmailResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  })

  // ユーザー不在または既確認の場合は黙って成功（列挙攻撃対策は呼び出し元が実施済み）
  if (!user || user.emailVerified) {
    return { ok: true }
  }

  await prisma.emailVerificationToken.deleteMany({ where: { email } })

  const token = crypto.randomBytes(TOKEN_RANDOM_BYTES).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
  const expires = new Date(Date.now() + ONE_DAY_MS)

  await prisma.emailVerificationToken.create({
    data: {
      email,
      token: hashedToken,
      expires,
    },
  })

  const baseUrl = getAppUrl()
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`

  const result = await sendVerificationEmail(email, verifyUrl)
  if (!result.success) {
    return { ok: false, reason: 'email_send_failed' }
  }

  return { ok: true }
}
