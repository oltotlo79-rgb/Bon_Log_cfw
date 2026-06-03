/**
 * 2段階認証（2FA）Server Actions
 *
 * @module lib/actions/two-factor
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth, requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit, type ActionResult } from '@/lib/actions/utils'
import bcrypt from 'bcryptjs'
import { getRedisClient } from '@/lib/redis'
import { TWO_FACTOR_SETUP_TTL_SECONDS } from '@/lib/constants/limits'
import {
  generateSecret,
  generateTOTPUri,
  generateQRCode,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  encryptSecret,
  decryptSecret,
  detectCodeType,
  formatTOTPCode,
} from '@/lib/two-factor'

import { getClientIp } from '@/lib/actions/utils'
import { issueTwoFactorLoginTicket } from '@/lib/two-factor-login-ticket'

import { ERR_USER_NOT_FOUND, ERR_2FA_ALREADY_ENABLED, ERR_2FA_INVALID_CODE, ERR_2FA_NOT_ENABLED, ERR_2FA_SETUP_EXPIRED, ERR_NO_PASSWORD_SET, ERR_INCORRECT_PASSWORD, ERR_INVALID_BACKUP_CODE, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_SETTINGS_SECURITY } from '@/lib/constants/routes'

/** Redis キーのプレフィックス */
const TWO_FACTOR_SETUP_KEY_PREFIX = '2fa_setup'

/**
 * セットアップ用の一時データ構造。
 * シークレットは暗号化済み、バックアップコードはハッシュ化済み。
 *
 * Redis から戻った JSON を `as PendingSetup` キャストで信用してしまうと、
 * 改竄や Redis 側のバージョン差で壊れたペイロードが実行時に処理されるため、
 * Zod スキーマで境界検証してから使用する。
 */
const pendingSetupSchema = z.object({
  encryptedSecret: z.string().min(1),
  hashedBackupCodes: z.array(z.string().min(1)),
})
type PendingSetup = z.infer<typeof pendingSetupSchema>

function buildSetupKey(userId: string, setupId: string): string {
  return `${TWO_FACTOR_SETUP_KEY_PREFIX}:${userId}:${setupId}`
}

/**
 * セットアップID（UUID）を生成。Web Crypto API 経由で Node/Edge/jsdom 全環境で動作。
 */
function generateSetupId(): string {
  return globalThis.crypto.randomUUID()
}

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabled: true },
  })

  if (!user) {
    return actionError(ERR_USER_NOT_FOUND)
  }
  if (user.twoFactorEnabled) {
    return actionError(ERR_2FA_ALREADY_ENABLED)
  }

  const secret = generateSecret()
  const qrCode = await generateQRCode(generateTOTPUri(secret, user.email))
  const backupCodes = generateBackupCodes()

  // 平文 secret は決して DB に保存せず、Redis に暗号化/ハッシュ化して一時退避する。
  // 有効化リクエストは setupId だけで完結し、クライアントから secret を再送させない設計。
  const setupId = generateSetupId()
  const pending: PendingSetup = {
    encryptedSecret: encryptSecret(secret),
    hashedBackupCodes: backupCodes.map((code) => hashBackupCode(code)),
  }
  const redis = getRedisClient()
  await redis.set(buildSetupKey(userId, setupId), JSON.stringify(pending), {
    ex: TWO_FACTOR_SETUP_TTL_SECONDS,
  })

  // secret / backupCodes は「画面に 1 回だけ表示する用途」で返却。
  return actionSuccess({ qrCode, secret, setupId, backupCodes })
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true },
  })

  if (!user) {
    return actionError(ERR_USER_NOT_FOUND)
  }

  if (user.twoFactorEnabled) {
    return actionError(ERR_2FA_ALREADY_ENABLED)
  }

  // Redisからセットアップ情報を復元
  const redis = getRedisClient()
  const setupKey = buildSetupKey(userId, setupId)
  const raw = await redis.get(setupKey)
  if (!raw) {
    return actionError(ERR_2FA_SETUP_EXPIRED)
  }

  let pending: PendingSetup
  try {
    const parsed = pendingSetupSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return actionError(ERR_2FA_SETUP_EXPIRED)
    }
    pending = parsed.data
  } catch {
    return actionError(ERR_2FA_SETUP_EXPIRED)
  }

  // 復号してTOTPコードを検証
  const secret = decryptSecret(pending.encryptedSecret)
  const isValid = await verifyTOTP(token, secret)
  if (!isValid) {
    return actionError(ERR_2FA_INVALID_CODE)
  }

  // DBを更新して2FAを有効化
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: pending.encryptedSecret,
      twoFactorBackupCodes: pending.hashedBackupCodes,
    },
  })

  // 一時データを削除（リプレイ防止）
  await redis.del(setupKey)

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, twoFactorEnabled: true },
  })

  if (!user) {
    return actionError(ERR_USER_NOT_FOUND)
  }

  if (!user.twoFactorEnabled) {
    return actionError(ERR_2FA_NOT_ENABLED)
  }

  // パスワードが設定されていない場合（OAuth専用アカウント）
  if (!user.password) {
    return actionError(ERR_NO_PASSWORD_SET)
  }

  // パスワードを検証
  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return actionError(ERR_INCORRECT_PASSWORD)
  }

  // 2FAを無効化
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  })

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
export async function verify2FAToken(
  email: string,
  code: string
): Promise<ActionResult<{ ticket: string }>> {
  // レート制限チェック（ブルートフォース対策）
  // Security note: This function accepts an email without session auth
  // (called during the login flow before session creation). Both email-
  // and IP-based rate limits are enforced to mitigate unauthenticated
  // brute-force attempts.
  const emailRl = await enforceUserRateLimit(`email:${email}`, 'verify_2fa')
  if (emailRl) return actionError(emailRl.error)

  // IP-based rate limit to prevent distributed attacks across emails
  const ip = await getClientIp()
  const ipRl = await enforceUserRateLimit(`ip:${ip}`, 'verify_2fa')
  if (ipRl) return actionError(ipRl.error)

  // ユーザー情報をメールアドレスで取得
  const user = await prisma.user.findUnique({
    where: { email },
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
  const codeType = detectCodeType(code)

  if (codeType === 'totp') {
    // TOTPコードの検証
    const secret = decryptSecret(user.twoFactorSecret)
    const formattedCode = formatTOTPCode(code)
    const isValid = await verifyTOTP(formattedCode, secret)

    if (!isValid) {
      return actionError(ERR_2FA_INVALID_CODE)
    }

    return actionSuccess({ ticket: await issueTwoFactorLoginTicket(email) })
  } else {
    // バックアップコードの検証
    const backupCodeIndex = verifyBackupCode(code, user.twoFactorBackupCodes)

    if (backupCodeIndex === -1) {
      return actionError(ERR_INVALID_BACKUP_CODE)
    }

    // 使用されたバックアップコードを削除
    const updatedBackupCodes = [...user.twoFactorBackupCodes]
    updatedBackupCodes.splice(backupCodeIndex, 1)

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodes: updatedBackupCodes },
    })

    return actionSuccess({ ticket: await issueTwoFactorLoginTicket(email) })
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, twoFactorEnabled: true },
  })

  if (!user) {
    return actionError(ERR_USER_NOT_FOUND)
  }

  if (!user.twoFactorEnabled) {
    return actionError(ERR_2FA_NOT_ENABLED)
  }

  if (!user.password) {
    return actionError(ERR_NO_PASSWORD_SET)
  }

  // パスワードを検証
  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return actionError(ERR_INCORRECT_PASSWORD)
  }

  // 新しいバックアップコードを生成
  const newBackupCodes = generateBackupCodes()
  const hashedBackupCodes = newBackupCodes.map((code) => hashBackupCode(code))

  // DBを更新
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorBackupCodes: hashedBackupCodes },
  })

  revalidatePath(ROUTE_SETTINGS_SECURITY)

  return actionSuccess({ backupCodes: newBackupCodes })
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorBackupCodes: true },
  })

  if (!user) {
    return actionError(ERR_USER_NOT_FOUND)
  }

  if (user.twoFactorEnabled) {
    return actionSuccess({
      enabled: true,
      backupCodesRemaining: user.twoFactorBackupCodes.length,
    })
  }

  return actionSuccess({ enabled: false })
}

/**
 * ユーザーに2FAが必要かどうかをチェックする
 *
 * ログイン処理中に呼び出し、2FAが有効なユーザーかを確認します。
 *
 * @param email - ユーザーのメールアドレス
 * @returns 2FAが必要かどうか（ユーザー存在の漏洩を防ぐためuserIdは返さない）
 */
export async function check2FARequired(
  email: string
): Promise<{ required: boolean }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { twoFactorEnabled: true },
    })

    if (!user) {
      return { required: false }
    }

    if (user.twoFactorEnabled) {
      return { required: true }
    }

    return { required: false }
  } catch {
    // DB接続エラー等の一時的な障害時は2FA不要として続行（500を防ぐ）
    return { required: false }
  }
}
