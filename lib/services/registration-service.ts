/**
 * @module lib/services/registration-service
 *
 * 新規ユーザー登録のコアロジック（services 層）。
 *
 * Web Server Action（lib/actions/auth.ts の registerUser）と
 * モバイル API ルート（app/api/v1/auth/register）の双方から共有する。
 *
 * 呼び出し元の責務:
 *   - レート制限チェック（IP ベース）
 *   - ログ記録（logRegisterSuccess）
 * この関数が担う責務:
 *   - ニックネーム・メール・デバイスのブラックリスト検査
 *   - パスワードハッシュ化 + ユーザー作成
 *   - メール確認トークン生成・保存
 *   - 確認メール送信
 *
 * 戻り値:
 *   - ok:true — 登録成功。userId を返す
 *   - ok:false, reason — 失敗理由の分類
 *     - 'email_already_registered': メール重複（409 相当）
 *     - 'nickname_reserved': 予約済みニックネーム（400 相当）
 *     - 'email_blacklisted': メール blacklist（400 相当）
 *     - 'device_blacklisted': デバイス blacklist（400 相当）
 *     - 'email_send_failed': 確認メール送信失敗（500 相当）
 *   - message: 呼び出し側が ActionResult / HTTP レスポンスに使う日本語エラーメッセージ
 */

import 'server-only'

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'
import logger from '@/lib/logger'
import { getAppUrl } from '@/lib/env'
import { BCRYPT_SALT_ROUNDS, ONE_DAY_MS, TOKEN_RANDOM_BYTES } from '@/lib/constants/limits'
import {
  ERR_EMAIL_ALREADY_REGISTERED,
  ERR_NICKNAME_RESERVED,
  ERR_EMAIL_BLACKLISTED,
  ERR_DEVICE_BLACKLISTED,
  ERR_VERIFICATION_EMAIL_FAILED,
} from '@/lib/constants/errors/auth'
import { isReservedNickname } from '@/lib/constants/reserved'
import { isEmailBlacklisted, isDeviceBlacklisted } from '@/lib/services/blacklist-check'

export type RegistrationFailureReason =
  | 'email_already_registered'
  | 'nickname_reserved'
  | 'email_blacklisted'
  | 'device_blacklisted'
  | 'email_send_failed'

export type RegistrationResult =
  | { ok: true; userId: string }
  | { ok: false; reason: RegistrationFailureReason; message: string }

export interface RegistrationInput {
  email: string
  password: string
  nickname: string
  fingerprint?: string
  /**
   * 規約同意の証跡バージョン。指定された場合のみ termsAcceptedAt（サーバー時刻）と
   * 併せて保存する。省略時（Web の既存呼び出し）は両カラムとも null のまま
   * （既存ユーザーへの遡及もしない）。
   */
  termsVersion?: string
}

/**
 * 新規ユーザーを作成し、確認メールを送信する。
 *
 * email・password・nickname は Zod で検証・正規化済みであることが前提。
 * レート制限は呼び出し元（Action / Route Handler）が担う。
 */
export async function registerUserCore(
  input: RegistrationInput,
): Promise<RegistrationResult> {
  const { email, password, nickname, fingerprint, termsVersion } = input

  if (isReservedNickname(nickname)) {
    return { ok: false, reason: 'nickname_reserved', message: ERR_NICKNAME_RESERVED }
  }

  const emailBlacklisted = await isEmailBlacklisted(email)
  if (emailBlacklisted) {
    return { ok: false, reason: 'email_blacklisted', message: ERR_EMAIL_BLACKLISTED }
  }

  if (fingerprint) {
    const deviceBlacklisted = await isDeviceBlacklisted(fingerprint)
    if (deviceBlacklisted) {
      return { ok: false, reason: 'device_blacklisted', message: ERR_DEVICE_BLACKLISTED }
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (existingUser) {
    return { ok: false, reason: 'email_already_registered', message: ERR_EMAIL_ALREADY_REGISTERED }
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)

  let userId: string
  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname,
        ...(termsVersion && { termsAcceptedAt: new Date(), termsVersion }),
      },
    })
    userId = user.id
  } catch (error) {
    // TOCTOU: findUnique と create の間に別リクエストが先に作成した場合
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, reason: 'email_already_registered', message: ERR_EMAIL_ALREADY_REGISTERED }
    }
    throw error
  }

  await prisma.emailVerificationToken.deleteMany({
    where: { email },
  })

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

  const emailResult = await sendVerificationEmail(email, verifyUrl)
  if (!emailResult.success) {
    logger.error('Failed to send verification email:', emailResult.error)
    return { ok: false, reason: 'email_send_failed', message: ERR_VERIFICATION_EMAIL_FAILED }
  }

  return { ok: true, userId }
}
