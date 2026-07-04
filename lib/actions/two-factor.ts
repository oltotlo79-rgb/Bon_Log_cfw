/**
 * 2段階認証（2FA）Server Actions
 *
 * @module lib/actions/two-factor
 *
 * setup2FA / enable2FA / disable2FA / regenerateBackupCodes / get2FAStatus のコア処理
 * （Prisma 操作・Redis セットアップ管理）は lib/services/two-factor-service.ts に委譲する。
 * このファイルは 認証 → Zod → レート制限 → service 呼び出し → revalidatePath の薄いラッパ。
 * verify2FAToken（ログイン用）はセッション未確立の経路のためコア処理を含めて維持する。
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth, requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit, type ActionResult } from '@/lib/actions/utils'
import {
  setup2FAForUser,
  enable2FAForUser,
  disable2FAForUser,
  regenerateBackupCodesForUser,
  get2FAStatusForUser,
} from '@/lib/services/two-factor-service'
import { TWO_FACTOR_CODE_LENGTH } from '@/lib/constants/limits'
import {
  verifyTOTP,
  verifyBackupCode,
  decryptSecret,
  detectCodeType,
  formatTOTPCode,
} from '@/lib/two-factor'

import { getClientIp } from '@/lib/actions/utils'
import { issueTwoFactorLoginTicket } from '@/lib/two-factor-login-ticket'
import { normalizedEmailSchema } from '@/lib/actions/schemas/common'

import { ERR_2FA_INVALID_CODE, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_SETTINGS_SECURITY } from '@/lib/constants/routes'

const enable2FASchema = z.object({
  token: z.string().min(1),
  setupId: z.string().min(1),
})

const passwordOnlySchema = z.object({
  password: z.string().min(1),
})

/**
 * 2FAセットアップを開始する
 *
 * QRコード、シークレット文字列、バックアップコードを生成し、
 * 暗号化済みシークレットとハッシュ済みバックアップコードをRedisに一時保存します。
 * クライアントには `setupId` を返し、secret/backupCodes は画面表示専用として返却します。
 * 有効化時は `setupId` のみを送信するため、シークレットが再送されることはありません。
 *
 * - 暗号化シークレットのみがサーバーサイドに保存される
 * - クライアントが返ってきた secret を再送する経路を排除（XSS/MITM時の再送攻撃軽減）
 * - TTL（TWO_FACTOR_SETUP_TTL_SECONDS）が切れると自動破棄
 *
 * @returns セットアップ情報（QRコード、setupId、画面表示用secret/backupCodes）
 */
export async function setup2FA(): Promise<ActionResult<{ qrCode: string; secret: string; setupId: string; backupCodes: string[] }>> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rl = await enforceUserRateLimit(userId, 'two_factor_setup')
  if (rl) return actionError(rl.error)

  const result = await setup2FAForUser(userId)
  if (!result.ok) return actionError(result.error)

  // secret / backupCodes は「画面に 1 回だけ表示する用途」で返却。
  return actionSuccess({
    qrCode: result.qrCode,
    secret: result.secret,
    setupId: result.setupId,
    backupCodes: result.backupCodes,
  })
}

/**
 * 2FAを有効化する
 *
 * setup2FAで生成された `setupId` からRedisに保存された暗号化済みシークレットと
 * ハッシュ済みバックアップコードを取得し、TOTPコードを検証した上で2FAを有効化します。
 *
 * - クライアントはシークレットを再送しない
 * - 検証成功後は Redis の一時データを削除（リプレイ防止）
 *
 * @param token - ユーザーが入力した6桁のTOTPコード
 * @param setupId - setup2FA で取得したセットアップID
 * @returns 有効化結果
 */
export async function enable2FA(
  token: string,
  setupId: string
): Promise<ActionResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = enable2FASchema.safeParse({ token, setupId })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'two_factor_setup')
  if (rl) return actionError(rl.error)

  const result = await enable2FAForUser(userId, parsed.data.token, parsed.data.setupId)
  if (!result.ok) return actionError(result.error)

  revalidatePath(ROUTE_SETTINGS_SECURITY)

  return actionSuccess()
}

/**
 * 2FAを無効化する
 *
 * パスワードを検証した後、2FAを無効化します。
 *
 * @param password - ユーザーのパスワード
 * @returns 無効化結果
 */
export async function disable2FA(password: string): Promise<ActionResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = passwordOnlySchema.safeParse({ password })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'two_factor_setup')
  if (rl) return actionError(rl.error)

  const result = await disable2FAForUser(userId, parsed.data.password)
  if (!result.ok) return actionError(result.error)

  revalidatePath(ROUTE_SETTINGS_SECURITY)

  return actionSuccess()
}

/**
 * ログイン時に2FAコードを検証する
 *
 * TOTPコードまたはバックアップコードを検証します。
 * バックアップコードが使用された場合は、そのコードを無効化します。
 *
 * 成功時は単回使用のログインチケットを発行して返す。クライアントはこれを
 * `signIn('credentials')` に渡し、`authorize()` がセッション発行前にチケットを消費する
 * （サーバーサイドで 2FA を強制し、signIn 直叩きによるバイパスを塞ぐ）。
 *
 * @param email - ユーザーのメールアドレス（userIdをクライアントに露出させないため）
 * @param code - TOTPコードまたはバックアップコード
 * @returns 検証結果（成功時は `{ ticket }` を含む）
 */
const verify2FASchema = z.object({
  email: normalizedEmailSchema,
  // TOTP(6桁)またはバックアップコード(8文字)の両形式を許容する最小チェック
  code: z.string().min(TWO_FACTOR_CODE_LENGTH),
})

export async function verify2FAToken(
  email: string,
  code: string
): Promise<ActionResult<{ ticket: string }>> {
  // 1. Zod バリデーション + email 正規化 — 不正入力はレート制限を消費しない
  const parsed = verify2FASchema.safeParse({ email, code })
  if (!parsed.success) {
    return actionError(ERR_2FA_INVALID_CODE)
  }
  const { email: validEmail, code: validCode } = parsed.data

  // 2. レート制限チェック（ブルートフォース対策）
  // Security note: This function accepts an email without session auth
  // (called during the login flow before session creation). Both email-
  // and IP-based rate limits are enforced to mitigate unauthenticated
  // brute-force attempts.
  const emailRl = await enforceUserRateLimit(`email:${validEmail}`, 'verify_2fa')
  if (emailRl) return actionError(emailRl.error)

  // IP-based rate limit to prevent distributed attacks across emails
  const ip = await getClientIp()
  const ipRl = await enforceUserRateLimit(`ip:${ip}`, 'verify_2fa')
  if (ipRl) return actionError(ipRl.error)

  // ユーザー情報をメールアドレスで取得（正規化済み email を使用）
  const user = await prisma.user.findUnique({
    where: { email: validEmail },
    select: {
      id: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  })

  // ユーザー列挙対策: 「該当ユーザーなし」「2FA 未設定」「コード不一致」を区別できる
  // エラーを返すとアカウント存在の有無を推測されるため、全て同一の汎用エラーに統一する。
  // この経路はログイン（パスワード検証後・2FA 有効ユーザーのみ到達想定）の前段であり、
  // 正規ユーザーの UX を損なわない。
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return actionError(ERR_2FA_INVALID_CODE)
  }

  // コードの種類を判定
  const codeType = detectCodeType(validCode)

  if (codeType === 'totp') {
    // TOTPコードの検証
    const secret = decryptSecret(user.twoFactorSecret)
    const formattedCode = formatTOTPCode(validCode)
    const isValid = await verifyTOTP(formattedCode, secret)

    if (!isValid) {
      return actionError(ERR_2FA_INVALID_CODE)
    }

    return actionSuccess({ ticket: await issueTwoFactorLoginTicket(validEmail) })
  } else {
    // バックアップコードの検証
    const backupCodeIndex = verifyBackupCode(validCode, user.twoFactorBackupCodes)

    if (backupCodeIndex === -1) {
      // TOTP 不一致・ユーザー状態の各失敗と同一の汎用エラーに統一する。
      // 失敗理由（コード種別）を揃え、ログイン経路での列挙・推測耐性を高める。
      return actionError(ERR_2FA_INVALID_CODE)
    }

    // 使用されたバックアップコードを削除
    const updatedBackupCodes = [...user.twoFactorBackupCodes]
    updatedBackupCodes.splice(backupCodeIndex, 1)

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodes: updatedBackupCodes },
    })

    return actionSuccess({ ticket: await issueTwoFactorLoginTicket(validEmail) })
  }
}

/**
 * バックアップコードを再生成する
 *
 * 既存のバックアップコードを破棄し、新しいコードを生成します。
 * パスワード認証が必要です。
 *
 * @param password - ユーザーのパスワード
 * @returns 新しいバックアップコード
 */
export async function regenerateBackupCodes(
  password: string
): Promise<ActionResult<{ backupCodes: string[] }>> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = passwordOnlySchema.safeParse({ password })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'two_factor_setup')
  if (rl) return actionError(rl.error)

  const result = await regenerateBackupCodesForUser(userId, parsed.data.password)
  if (!result.ok) return actionError(result.error)

  revalidatePath(ROUTE_SETTINGS_SECURITY)

  return actionSuccess({ backupCodes: result.backupCodes })
}

/**
 * 2FAの状態を取得する
 *
 * @returns 2FAの有効状態と残りのバックアップコード数
 */
export async function get2FAStatus(): Promise<ActionResult<{ enabled: boolean; backupCodesRemaining?: number }>> {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const result = await get2FAStatusForUser(userId)
  if (!result.ok) return actionError(result.error)

  if (result.enabled) {
    return actionSuccess({ enabled: true, backupCodesRemaining: result.backupCodesRemaining })
  }

  return actionSuccess({ enabled: false })
}
