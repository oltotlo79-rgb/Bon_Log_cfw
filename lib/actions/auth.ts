'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { signIn } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { MAX_NICKNAME_LENGTH } from '@/lib/constants/limits'
import bcrypt from 'bcryptjs'
import { passwordSchema } from '@/lib/validations/password'
import { sanitizeInput } from '@/lib/sanitize'
import { logRegisterSuccess } from '@/lib/security-logger'
import logger from '@/lib/logger'
import {
  checkLoginThrottleForRequest,
  recordLoginFailureForRequest,
} from '@/lib/services/login-throttle'
import { ROUTE_FEED, ROUTE_HOME } from '@/lib/constants/routes'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { FIFTEEN_MINUTES_MS, VERIFY_CREDENTIALS_MAX_ATTEMPTS, MAX_GUEST_LOGIN_ATTEMPTS } from '@/lib/constants/limits'
// 定数はドメイン別ファイルに分割されているため、用途別に直接 import する。
// （ファイル先頭でまとめて import すると実装に到達するまでスクロールが必要になる）
import {
  ERR_ACCOUNT_SUSPENDED,
  ERR_DEVICE_LOGIN_NOT_ALLOWED,
  ERR_EMAIL_NOT_VERIFIED,
  ERR_GUEST_LOGIN_UNAVAILABLE,
  ERR_LOGIN_ERROR,
  ERR_LOGIN_FAILED,
  ERR_LOGIN_INVALID_CREDENTIALS,
} from '@/lib/constants/errors/auth'
import {
  ERR_INPUT_INVALID_GENERIC,
  ERR_NICKNAME_INVALID_CHARS,
  ERR_NICKNAME_REQUIRED,
  ERR_NICKNAME_TOO_LONG,
  ERR_RATE_LIMIT_OPERATION,
} from '@/lib/constants/errors/content'
import { isDeviceBlacklisted } from '@/lib/services/blacklist-check'
import { getClientIp, actionSuccess, actionError } from '@/lib/actions/utils'
import { normalizedEmailSchema } from '@/lib/actions/schemas/common'
import type { ActionResult } from '@/types/action-result'
import { registerUserCore } from '@/lib/services/registration-service'

// auth public action 用のスキーマ群。
// rate limit を消費する前に入力境界で正規化・検証することで、不正形状の入力で quota を
// 消費する経路を塞ぐ。schema 通過後の email を rate limit key 生成にも使う。
const credentialsSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1, ERR_INPUT_INVALID_GENERIC),
})

/**
 * ログイン前段のサーバーサイド検証を単一境界に集約する。
 *
 * ロックアウト判定 → レート制限 → デバイス検査 → パスワード検証（成功後に状態開示）の順で実施し、
 * 結果として 2FA が必要かどうかを返す。`signIn()` を呼ばないため、この時点ではセッションは
 * 作成されない（2FA バイパス防止）。クライアントは本 Action 1 回で 2FA 有無まで判定でき、
 * 旧 `checkLoginAllowed` / `check2FARequired` / `getEmailVerificationStatus` の
 * 個別呼び出し（パスワード検証前に状態を返す列挙面）を不要にする。
 *
 * 列挙耐性: パスワード不一致・存在しないユーザー・パスワード未設定（OAuth のみ）は
 * すべて同一の `ERR_LOGIN_INVALID_CREDENTIALS` を返す。停止/未確認の区別は
 * **パスワード一致後のみ** 開示するため、正規の所有者以外はアカウント状態を推測できない。
 * メール未確認時は `error === ERR_EMAIL_NOT_VERIFIED` を返し、呼び出し側が「確認メール再送」
 * ボタンの識別子に使う。失敗は 2FA 有無に依らずサーバー側で記録される。
 *
 * @param fingerprint 任意。渡された場合はデバイスブラックリストをサーバー側で検査する。
 */
export async function verifyCredentials(
  email: string,
  password: string,
  fingerprint?: string,
): Promise<ActionResult<{ twoFactorRequired: boolean }>> {
  // 1. 入力検証 (rate limit 前に行うことで、不正形状入力で quota を消費しない)
  const parsed = credentialsSchema.safeParse({ email, password })
  if (!parsed.success) {
    return actionError(ERR_LOGIN_INVALID_CREDENTIALS)
  }
  const { email: validEmail, password: validPassword } = parsed.data

  // 2. ロックアウト判定 (サーバー側で一元化。fail-closed: Redis 障害時も拒否)
  const throttle = await checkLoginThrottleForRequest(validEmail)
  if (!throttle.allowed) {
    return actionError(throttle.message ?? ERR_RATE_LIMIT_OPERATION)
  }

  // 3. レート制限 (IP + 正規化済み email で同一アカウントを狙う攻撃も検知)
  const ip = await getClientIp()
  const rateLimitResult = await rateLimit(
    `verify-credentials:${ip}:${sanitizeInput(validEmail)}`,
    {
      windowMs: FIFTEEN_MINUTES_MS,
      maxRequests: VERIFY_CREDENTIALS_MAX_ATTEMPTS,
      failOpen: false,
    }
  )
  if (!rateLimitResult.success) {
    return actionError(ERR_RATE_LIMIT_OPERATION)
  }

  // 4. デバイスブラックリスト (公開ログインフォーム由来のチェックをサーバー側で実施)
  if (fingerprint) {
    const deviceBlocked = await isDeviceBlacklisted(fingerprint)
    if (deviceBlocked) {
      return actionError(ERR_DEVICE_LOGIN_NOT_ALLOWED)
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: validEmail },
      select: {
        password: true,
        emailVerified: true,
        isSuspended: true,
        twoFactorEnabled: true,
      },
    })

    // パスワードを先に検証する。存在しない・パスワード未設定（OAuth のみ）・不一致は
    // すべて同一の汎用エラーで返し、失敗をサーバー側で記録する（2FA 有無に依らず記録される）。
    const passwordValid =
      !!user?.password && (await bcrypt.compare(validPassword, user.password))
    if (!user || !passwordValid) {
      await recordLoginFailureForRequest(validEmail)
      return actionError(ERR_LOGIN_INVALID_CREDENTIALS)
    }

    // ここから先はパスワード一致済み = 正規の所有者のみ到達。アカウント状態を開示してよい。
    if (user.isSuspended) {
      return actionError(ERR_ACCOUNT_SUSPENDED)
    }
    if (!user.emailVerified) {
      return actionError(ERR_EMAIL_NOT_VERIFIED)
    }

    return actionSuccess({ twoFactorRequired: user.twoFactorEnabled })
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

  // 認証不要でセッションを発行できる経路のため IP ベースでレート制限する
  const ip = await getClientIp()
  const rateLimitResult = await rateLimit(`guest-login:${ip}`, {
    windowMs: FIFTEEN_MINUTES_MS,
    maxRequests: MAX_GUEST_LOGIN_ATTEMPTS,
    failOpen: false,
  })
  if (!rateLimitResult.success) {
    return actionError(ERR_RATE_LIMIT_OPERATION)
  }

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
  email: normalizedEmailSchema,
  password: passwordSchema,
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
    const message = first.email?.[0] ?? first.password?.[0] ?? first.nickname?.[0] ?? ERR_INPUT_INVALID_GENERIC
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

  // 3. ユーザー作成 + 確認メール送信（services 層に委譲）
  const result = await registerUserCore({ email, password, nickname, fingerprint })
  if (!result.ok) {
    return actionError(result.message)
  }

  logRegisterSuccess(result.userId, ip)

  return actionSuccess({ userId: result.userId })
}

// メール確認系 / パスワードリセット系は別ファイルに分離。
// 既存 import 互換性のため `@/lib/actions/auth` 経由でも参照できるようラッパー経由で公開する。
// Why wrappers (not `export { } from`):
//   Next.js 16 (SWC) の `'use server'` 制約により、ファイル内では async function declaration のみが許可される。
//   `export { name } from '...'` の re-export は build 時 SWC で reject される (vitest はこの制約を通すため要注意)。
import {
  verifyEmailToken as _verifyEmailToken,
  resendVerificationEmail as _resendVerificationEmail,
} from './auth-email-verify'
import {
  requestPasswordReset as _requestPasswordReset,
  resetPassword as _resetPassword,
  verifyPasswordResetToken as _verifyPasswordResetToken,
} from './auth-password-reset'

export async function verifyEmailToken(token: string) {
  return _verifyEmailToken(token)
}

export async function resendVerificationEmail(email: string) {
  return _resendVerificationEmail(email)
}

export async function requestPasswordReset(email: string) {
  return _requestPasswordReset(email)
}

export async function resetPassword(data: { email: string; token: string; newPassword: string }) {
  return _resetPassword(data)
}

export async function verifyPasswordResetToken(email: string, token: string) {
  return _verifyPasswordResetToken(email, token)
}
