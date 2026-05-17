'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { signIn } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { MAX_EMAIL_LENGTH, MAX_NICKNAME_LENGTH } from '@/lib/constants/limits'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/email'
import logger from '@/lib/logger'
import {
  checkLoginAttempt,
  recordFailedLogin,
  resetLoginAttempts,
  getLoginKey,
} from '@/lib/login-tracker'
import { validatePassword } from '@/lib/validations/password'
import { sanitizeInput } from '@/lib/sanitize'
import {
  logLoginFailure,
  logLoginLockout,
  logRegisterSuccess,
  logPasswordResetRequest,
  logPasswordResetSuccess,
} from '@/lib/security-logger'
import { getAppUrl } from '@/lib/env'
import { ROUTE_FEED, ROUTE_HOME } from '@/lib/constants/routes'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { Prisma } from '@prisma/client'
import { PASSWORD_MIN_LENGTH, BCRYPT_SALT_ROUNDS, ONE_DAY_MS, ONE_HOUR_MS, FIFTEEN_MINUTES_MS, MIN_TOKEN_LENGTH, MAX_RESEND_VERIFICATION_ATTEMPTS, MAX_PASSWORD_RESET_ATTEMPTS, TOKEN_RANDOM_BYTES } from '@/lib/constants/limits'
// 定数はドメイン別ファイルに分割されているため、用途別に直接 import する。
// （ファイル先頭で 28 個まとめて import すると実装に到達するまでスクロールが必要になる）
import {
  ERR_ACCOUNT_SUSPENDED,
  ERR_DEVICE_BLACKLISTED,
  ERR_EMAIL_ALREADY_REGISTERED,
  ERR_EMAIL_BLACKLISTED,
  ERR_EMAIL_NOT_VERIFIED,
  ERR_EMAIL_SEND_FAILED,
  ERR_GUEST_LOGIN_UNAVAILABLE,
  ERR_INVALID_TOKEN,
  ERR_LOGIN_ERROR,
  ERR_LOGIN_FAILED,
  ERR_LOGIN_INVALID_CREDENTIALS,
  ERR_NICKNAME_RESERVED,
  ERR_PASSWORD_ALPHANUMERIC,
  ERR_PASSWORD_MIN_LENGTH,
  ERR_RESEND_TOO_MANY,
  ERR_RESET_LINK_INVALID,
  ERR_RESET_TOO_MANY,
  ERR_TOKEN_EXPIRED,
  ERR_TOKEN_EXPIRED_OR_INVALID,
  ERR_VERIFICATION_EMAIL_FAILED,
} from '@/lib/constants/errors/auth'
import {
  ERR_EMAIL_INVALID,
  ERR_EMAIL_TOO_LONG,
  ERR_INPUT_INVALID_GENERIC,
  ERR_NICKNAME_INVALID_CHARS,
  ERR_NICKNAME_REQUIRED,
  ERR_NICKNAME_TOO_LONG,
  ERR_RATE_LIMIT_OPERATION,
} from '@/lib/constants/errors/content'
import { ERR_USER_NOT_FOUND } from '@/lib/constants/errors/entity'
import { isReservedNickname } from '@/lib/constants/reserved'
import { isEmailBlacklisted, isDeviceBlacklisted } from '@/lib/actions/blacklist'
import { getClientIp, actionSuccess, actionError } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'

/**
 * `checkLoginAllowed` の戻り値。
 * 失敗パスを持たない rate-limit クエリのため `ActionResult` ではなく状態オブジェクトを返す。
 *
 * `message` は拒否時のみ値が入り許可時は undefined となるため optional。
 * 元の `LoginCheckResult.message` の optionality をそのまま伝搬する。
 */
export type LoginAllowedResult = {
  /** 直近の連続失敗回数がロック閾値未満なら true */
  allowed: boolean
  /** 利用者表示用メッセージ（拒否時のみ。許可時は undefined） */
  message?: string
  /** ロック前に残されている試行回数 */
  remainingAttempts: number
}

/**
 * `recordLoginFailure` の戻り値。
 * 失敗パスを持たない監査記録系のため `ActionResult` ではなく状態オブジェクトを返す。
 *
 * `message` は新規ロック時のみ値が入る。
 */
export type LoginFailureResult = {
  /** 今回の失敗で新たにロック状態に入ったかどうか */
  locked: boolean
  /** 利用者表示用メッセージ（ロック発動時のみ。それ以外は undefined） */
  message?: string
  /** ロック前に残されている試行回数 */
  remainingAttempts: number
}

/**
 * ログインがブルートフォースレートリミットの観点で許可されるかを判定する。
 *
 * IP + email の組合せをキーに使い、同一 IP から複数アカウントを狙う攻撃も検知する。
 *
 * 戻り値が `ActionResult` ではなく `LoginAllowedResult` なのは、これが
 * 「失敗しうる書き込み Action」ではなく「Redis のレート状態を返す純粋なクエリ」
 * であるため。`hashtag.ts` の `getTrendingHashtags` 等と同じく、
 * 読み取り系で素直なドメインオブジェクトを返す既存パターンに合わせている。
 */
export async function checkLoginAllowed(email: string): Promise<LoginAllowedResult> {
  const ip = await getClientIp()
  const key = getLoginKey(ip, sanitizeInput(email))
  const result = await checkLoginAttempt(key)

  return {
    allowed: result.allowed,
    message: result.message,
    remainingAttempts: result.remainingAttempts,
  }
}

/**
 * ログイン失敗を記録しセキュリティイベントを発火する。
 *
 * 戻り値が `ActionResult` ではない理由は `checkLoginAllowed` と同様
 * （観測可能な状態を返すクエリ系で、失敗パスを持たない）。
 */
export async function recordLoginFailure(email: string): Promise<LoginFailureResult> {
  const ip = await getClientIp()
  const sanitizedEmail = sanitizeInput(email)
  const key = getLoginKey(ip, sanitizedEmail)

  const result = await recordFailedLogin(key)

  logLoginFailure(sanitizedEmail, ip, 'invalid_credentials')

  if (!result.allowed) {
    logLoginLockout(sanitizedEmail, ip)
  }

  return {
    locked: !result.allowed,
    message: result.message,
    remainingAttempts: result.remainingAttempts,
  }
}

/**
 * ログイン成功時に試行カウンタをリセットする。
 *
 * 失敗パスを持たないため戻り値なし（Promise<void>）。
 */
export async function clearLoginAttempts(email: string): Promise<void> {
  const ip = await getClientIp()
  const key = getLoginKey(ip, sanitizeInput(email))
  await resetLoginAttempts(key)
}

// auth public action 用のスキーマ群。
// rate limit を消費する前に入力境界で正規化・検証することで、不正形状の入力で quota を
// 消費する経路を塞ぐ。schema 通過後の email を rate limit key 生成にも使う。
const credentialsSchema = z.object({
  email: z
    .string()
    .email(ERR_EMAIL_INVALID)
    .max(MAX_EMAIL_LENGTH, ERR_EMAIL_TOO_LONG(MAX_EMAIL_LENGTH)),
  password: z.string().min(1, ERR_INPUT_INVALID_GENERIC),
})

const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .email(ERR_EMAIL_INVALID)
    .max(MAX_EMAIL_LENGTH, ERR_EMAIL_TOO_LONG(MAX_EMAIL_LENGTH)),
})

const passwordResetConfirmSchema = z.object({
  email: z
    .string()
    .email(ERR_EMAIL_INVALID)
    .max(MAX_EMAIL_LENGTH, ERR_EMAIL_TOO_LONG(MAX_EMAIL_LENGTH)),
  token: z.string().min(MIN_TOKEN_LENGTH, ERR_INVALID_TOKEN),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, ERR_PASSWORD_MIN_LENGTH),
})

/**
 * セッション作成なしでパスワードのみ検証する。
 * 2FA有効ユーザーのログインフロー前段で使用。
 * signIn()を呼ばないため、この時点ではセッションは作成されない。
 *
 * メール未確認の場合は `error === ERR_EMAIL_NOT_VERIFIED` を返す。
 * 呼び出し側はこれを識別子として「確認メール再送」ボタンを表示する。
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<ActionResult<void>> {
  // 1. 入力検証 (rate limit 前に行うことで、不正形状入力で quota を消費しない)
  const parsed = credentialsSchema.safeParse({ email, password })
  if (!parsed.success) {
    return actionError(ERR_LOGIN_INVALID_CREDENTIALS)
  }
  const { email: validEmail, password: validPassword } = parsed.data

  // 2. レート制限 (IP + 正規化済み email で同一アカウントを狙う攻撃も検知)
  const ip = await getClientIp()
  const rateLimitResult = await rateLimit(
    `verify-credentials:${ip}:${sanitizeInput(validEmail)}`,
    {
      windowMs: FIFTEEN_MINUTES_MS,
      maxRequests: 5,
      failOpen: false,
    }
  )
  if (!rateLimitResult.success) {
    return actionError(ERR_RATE_LIMIT_OPERATION)
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: validEmail },
      select: { id: true, password: true, emailVerified: true, isSuspended: true },
    })

    if (!user || !user.password) {
      return actionError(ERR_LOGIN_INVALID_CREDENTIALS)
    }

    if (user.isSuspended) {
      return actionError(ERR_ACCOUNT_SUSPENDED)
    }

    if (!user.emailVerified) {
      return actionError(ERR_EMAIL_NOT_VERIFIED)
    }

    const isValid = await bcrypt.compare(validPassword, user.password)
    if (!isValid) {
      return actionError(ERR_LOGIN_INVALID_CREDENTIALS)
    }

    return actionSuccess()
  } catch (error) {
    logger.error('verifyCredentials error:', error)
    return actionError(ERR_LOGIN_ERROR)
  }
}

/**
 * ゲストとしてログイン（トップの「のぞいてみる」用）。
 * 成功時は /feed へリダイレクトする。
 */
export async function signInAsGuest() {
  const password =
    process.env.GUEST_PASSWORD ??
    (process.env.NODE_ENV === 'development' ? 'GuestPass1!' : '')
  if (!password) return actionError(ERR_GUEST_LOGIN_UNAVAILABLE)
  try {
    const result = await signIn('credentials', {
      email: GUEST_EMAIL,
      password,
      redirect: false,
    })
    if (result?.ok) redirect(ROUTE_FEED)
  } catch (error) {
    // Auth.js が authorize 失敗時に throw する場合のハンドリング（本番の Sentry 誤検知を防ぐ）
    logger.warn('Guest sign-in failed (check GUEST_PASSWORD and guest user in DB)', { cause: error instanceof Error ? error.message : undefined })
  }
  return actionError(ERR_LOGIN_FAILED)
}

/** フォーム action 用（void を返す）。失敗時はトップにクエリ付きでリダイレクト */
export async function signInAsGuestFormAction() {
  const result = await signInAsGuest()
  if (result && !result.success) redirect(`${ROUTE_HOME}?guest_error=1`)
}

const registerUserSchema = z.object({
  email: z.string().email(ERR_EMAIL_INVALID).max(MAX_EMAIL_LENGTH, ERR_EMAIL_TOO_LONG(MAX_EMAIL_LENGTH)),
  password: z.string(),
  nickname: z
    .string()
    .min(1, ERR_NICKNAME_REQUIRED)
    .max(MAX_NICKNAME_LENGTH, ERR_NICKNAME_TOO_LONG(MAX_NICKNAME_LENGTH))
    .refine((v) => !/[\r\n<>]/.test(v), ERR_NICKNAME_INVALID_CHARS),
  fingerprint: z.string().optional(),
})

/**
 * Register a new user.
 *
 * @returns `{ success, userId }` on success, `{ error }` on failure
 */
export async function registerUser(data: {
  email: string
  password: string
  nickname: string
  fingerprint?: string
}) {
  // 1. 入力検証 (Zod) — rate limit より先に行うことで不正入力で quota を消費しない
  const parsed = registerUserSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    // registerUserSchema のメッセージは全て ERR_* 定数由来。
    // フィールド未マッチ時のフォールバックも定数を使うことでインライン文字列を排除する。
    const message = first.email?.[0] ?? first.nickname?.[0] ?? ERR_INPUT_INVALID_GENERIC
    return actionError(message)
  }
  const { email, password, nickname, fingerprint } = parsed.data

  // 2. レート制限 (IP + 正規化済み email)
  const ip = await getClientIp()
  const rateLimitResult = await rateLimit(`register:${ip}:${sanitizeInput(email)}`, {
    ...RATE_LIMITS.register,
    failOpen: false,
  })
  if (!rateLimitResult.success) {
    return actionError(ERR_RATE_LIMIT_OPERATION)
  }

  const passwordValidation = validatePassword(password)
  if (!passwordValidation.valid) {
    return actionError(passwordValidation.error)
  }

  if (isReservedNickname(nickname)) {
    return actionError(ERR_NICKNAME_RESERVED)
  }

  const emailBlacklisted = await isEmailBlacklisted(email)
  if (emailBlacklisted) {
    return actionError(ERR_EMAIL_BLACKLISTED)
  }

  if (fingerprint) {
    const deviceBlacklisted = await isDeviceBlacklisted(fingerprint)
    if (deviceBlacklisted) {
      return actionError(ERR_DEVICE_BLACKLISTED)
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return actionError(ERR_EMAIL_ALREADY_REGISTERED)
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)

  let user
  try {
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname,
      },
    })
  } catch (error) {
    // TOCTOU: another request may have created the user between findUnique and create
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return actionError(ERR_EMAIL_ALREADY_REGISTERED)
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
      email: data.email,
      token: hashedToken,
      expires,
    },
  })

  const baseUrl = getAppUrl()
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`

  const emailResult = await sendVerificationEmail(email, verifyUrl)
  if (!emailResult.success) {
    logger.error('Failed to send verification email:', emailResult.error)
    return actionError(ERR_VERIFICATION_EMAIL_FAILED)
  }

  logRegisterSuccess(user.id, ip)

  return actionSuccess({ userId: user.id })
}

/**
 * Verify an email confirmation token and mark the user as verified.
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
 * Resend verification email (rate-limited: 3 per hour per IP).
 *
 * Returns success even if the user doesn't exist or is already verified
 * to prevent email enumeration.
 */
export async function resendVerificationEmail(email: string) {
  const ip = await getClientIp()
  const sanitizedEmail = sanitizeInput(email)

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
    where: { email: sanitizedEmail },
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
    where: { email: sanitizedEmail },
  })

  const token = crypto.randomBytes(TOKEN_RANDOM_BYTES).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
  const expires = new Date(Date.now() + ONE_DAY_MS)

  await prisma.emailVerificationToken.create({
    data: {
      email: sanitizedEmail,
      token: hashedToken,
      expires,
    },
  })

  const baseUrl = getAppUrl()
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`

  const result = await sendVerificationEmail(sanitizedEmail, verifyUrl)
  if (!result.success) {
    return actionError(ERR_EMAIL_SEND_FAILED)
  }

  return actionSuccess()
}

/**
 * Check email verification status (used to show unverified hint on login failure).
 * On DB error returns { verified: true } to avoid breaking the login form (E2E安定化).
 */
export async function getEmailVerificationStatus(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: sanitizeInput(email) },
      select: { emailVerified: true },
    })
    // ユーザーが存在しない場合はメール未確認エラーにしない（通常のログインエラーに流す）
    if (!user) return { verified: true }
    return { verified: !!user.emailVerified }
  } catch (error) {
    logger.warn('getEmailVerificationStatus: DB error, assuming verified', {
      cause: error instanceof Error ? error.message : undefined,
    })
    return { verified: true }
  }
}

/**
 * Send a password reset email.
 *
 * Returns success even if the user doesn't exist to prevent enumeration attacks.
 * Token is stored as SHA-256 hash; expires in 1 hour.
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
    }
  )

  if (!rateLimitResult.success) {
    return actionError(ERR_RESET_TOO_MANY)
  }

  logPasswordResetRequest(validEmail, ip)

  const user = await prisma.user.findUnique({
    where: { email: validEmail },
  })

  // Return success even if user not found (enumeration prevention)
  if (!user) {
    return actionSuccess()
  }

  await prisma.passwordResetToken.deleteMany({
    where: { email: validEmail },
  })

  const token = crypto.randomBytes(TOKEN_RANDOM_BYTES).toString('hex')
  // Store only the hash so the raw token can't be recovered from DB
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  await prisma.passwordResetToken.create({
    data: {
      email: validEmail,
      token: hashedToken,
      expires: new Date(Date.now() + ONE_HOUR_MS),
    },
  })

  const baseUrl = getAppUrl()
  const resetUrl = `${baseUrl}/password-reset/confirm?token=${token}&email=${encodeURIComponent(validEmail)}`

  logger.log('Attempting to send password reset email to:', validEmail.replace(/(.{2}).*(@.*)/, '$1***$2'))
  logger.debug('Reset URL generated')

  const result = await sendPasswordResetEmail(validEmail, resetUrl)

  logger.log('Email send result:', result.success ? 'success' : 'failed')

  if (!result.success) {
    logger.error('Failed to send password reset email:', result.error)
    return actionError(ERR_EMAIL_SEND_FAILED)
  }

  return actionSuccess()
}

/**
 * Reset password using a valid reset token.
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

  // password の英数字混在チェックは Zod では補えないため後段で実施
  const hasLetter = /[a-zA-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  if (!hasLetter || !hasNumber) {
    return actionError(ERR_PASSWORD_ALPHANUMERIC)
  }

  // 2. レート制限 (IP + email)。token 自体が十分長くても他の auth action と防御を統一
  const ip = await getClientIp()
  const rateLimitResult = await rateLimit(
    `password-reset-confirm:${ip}:${sanitizeInput(email)}`,
    {
      windowMs: ONE_HOUR_MS,
      maxRequests: MAX_PASSWORD_RESET_ATTEMPTS,
      failOpen: false,
    }
  )
  if (!rateLimitResult.success) {
    return actionError(ERR_RESET_TOO_MANY)
  }

  // 3. token 検証 + パスワード更新
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      token: hashedToken,
      expires: { gt: new Date() },
    },
  })

  if (!resetToken) {
    return actionError(ERR_RESET_LINK_INVALID)
  }

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    return actionError(ERR_USER_NOT_FOUND)
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  })

  await prisma.passwordResetToken.deleteMany({
    where: { email },
  })

  logPasswordResetSuccess(user.id)

  return actionSuccess()
}

/**
 * Verify a password reset token is valid and not expired.
 * Used to check before showing the reset form.
 */
export async function verifyPasswordResetToken(email: string, token: string) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      token: hashedToken,
      expires: { gt: new Date() },
    },
  })

  return { valid: !!resetToken }
}
