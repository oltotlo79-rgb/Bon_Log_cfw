/**
 * @module lib/services/email-change-service
 *
 * ログイン中ユーザーのメールアドレス変更（確認メール経由の二段階）コアロジック。
 *
 * lib/actions/account-security.ts（Web Server Action）と
 * app/api/v1/auth/email/change/*（モバイル API）の双方から共有する。
 *
 * 二段階の設計:
 *   1. request: 現パスワード確認（本人性）→ 新アドレス宛に確認メール送信
 *   2. confirm: メール内トークンの検証（新アドレス所有性）→ user.email を更新
 * confirm はトークン所持自体が本人性の証明になるため、呼び出し元はログインセッションを
 * 要求しない設計を採ってよい（password-reset-service.ts と同じ考え方）。
 *
 * 列挙攻撃対策（newEmail が既に使われていても ok:true を返す）は request 側の責務として
 * このモジュール内で実施する。認証・Zod バリデーション・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendEmailChangeConfirmation, sendEmailChangeNotification } from '@/lib/email'
import logger from '@/lib/logger'
import { getAppUrl } from '@/lib/env'
import { ONE_HOUR_MS, TOKEN_RANDOM_BYTES } from '@/lib/constants/limits'
import { ROUTE_EMAIL_CHANGE_CONFIRM } from '@/lib/constants/routes'
import {
  ERR_USER_NOT_FOUND,
  ERR_NO_PASSWORD_SET,
  ERR_INCORRECT_PASSWORD,
  ERR_EMAIL_SEND_FAILED,
} from '@/lib/constants/errors'
import { logEmailChangeRequest, logEmailChangeSuccess } from '@/lib/security-logger'

export type RequestEmailChangeResult =
  | { ok: true }
  | { ok: false; error: string }

export type ConfirmEmailChangeResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_token' | 'email_taken' }

/**
 * ログイン中ユーザーのメールアドレス変更をリクエストする。
 *
 * OAuth 専用アカウント（`password` が null）は変更不可として扱う。
 * newEmail が既に他ユーザーに使われている場合は列挙攻撃対策として ok:true を返し、
 * メールは送信しない（呼び出し元はこの分岐を UI に一切露出させないこと）。
 *
 * @param ip - 監査ログ記録用 IP（呼び出し元で取得済みのものを渡す）
 */
export async function requestEmailChangeCore(
  userId: string,
  currentPassword: string,
  newEmail: string,
  ip?: string,
): Promise<RequestEmailChangeResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, password: true },
  })
  if (!user) return { ok: false, error: ERR_USER_NOT_FOUND }
  if (!user.password) return { ok: false, error: ERR_NO_PASSWORD_SET }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
  if (!isCurrentPasswordValid) return { ok: false, error: ERR_INCORRECT_PASSWORD }

  logEmailChangeRequest(userId, ip)

  const existing = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  })
  if (existing) {
    // 列挙攻撃対策: 使用中のアドレスでもエラーにせず、メールも送らずに ok:true を返す
    return { ok: true }
  }

  // 同一ユーザーの既存未使用トークンは無効化してから新規発行する
  await prisma.emailChangeToken.deleteMany({ where: { userId } })

  const token = crypto.randomBytes(TOKEN_RANDOM_BYTES).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  await prisma.emailChangeToken.create({
    data: {
      userId,
      newEmail,
      tokenHash,
      expiresAt: new Date(Date.now() + ONE_HOUR_MS),
    },
  })

  const confirmUrl = `${getAppUrl()}${ROUTE_EMAIL_CHANGE_CONFIRM}?token=${token}`
  const sendResult = await sendEmailChangeConfirmation(newEmail, confirmUrl)
  if (!sendResult.success) {
    logger.error('Failed to send email change confirmation:', sendResult.error)
    return { ok: false, error: ERR_EMAIL_SEND_FAILED }
  }

  // 乗っ取り検知のためのセキュリティ通知（旧アドレス宛）。送信失敗しても変更フロー自体は継続する
  const notifyResult = await sendEmailChangeNotification(user.email)
  if (!notifyResult.success) {
    logger.error('Failed to send email change notification to old address:', notifyResult.error)
  }

  return { ok: true }
}

/**
 * メールアドレス変更確認トークンを検証し、user.email を新アドレスに更新する。
 *
 * @param token - 生トークン（URL パラメータ / モバイルからの入力として受け取ったもの）
 */
export async function confirmEmailChangeCore(token: string): Promise<ConfirmEmailChangeResult> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const record = await prisma.emailChangeToken.findUnique({ where: { tokenHash } })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, reason: 'invalid_token' }
  }

  // request 〜 confirm の間に newEmail が別ユーザーに取られていないか再チェック
  const taken = await prisma.user.findUnique({
    where: { email: record.newEmail },
    select: { id: true },
  })
  if (taken && taken.id !== record.userId) {
    return { ok: false, reason: 'email_taken' }
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { email: record.newEmail, emailVerified: new Date() },
      }),
      prisma.emailChangeToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])
  } catch (error) {
    // TOCTOU: 上の再チェックと update の間に別リクエストが先に newEmail を取得した場合
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, reason: 'email_taken' }
    }
    throw error
  }

  logEmailChangeSuccess(record.userId)

  return { ok: true }
}
