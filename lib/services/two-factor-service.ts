/**
 * @module lib/services/two-factor-service
 * 2段階認証（2FA）のコア処理（Prisma 操作・Redis セットアップ管理）。
 *
 * lib/actions/two-factor.ts（Web）と app/api/v1/auth/2fa/{setup,enable,disable}（モバイル）の
 * 双方から呼ばれる。認証・Zod バリデーション・レート制限は呼び出し元が担う前提。
 * 戻り値は `{ ok: true, ... } | { ok: false, error: string }` の discriminated union とし、
 * error には lib/constants/errors の既存メッセージ定数をそのまま使う
 * （呼び出し元の Web action / v1 route が同一文字列でエラー分岐できるようにするため）。
 */

import 'server-only'

import { z } from 'zod'
import { prisma } from '@/lib/db'
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
  encryptSecret,
  decryptSecret,
} from '@/lib/two-factor'
import {
  ERR_USER_NOT_FOUND,
  ERR_2FA_ALREADY_ENABLED,
  ERR_2FA_INVALID_CODE,
  ERR_2FA_NOT_ENABLED,
  ERR_2FA_SETUP_EXPIRED,
  ERR_NO_PASSWORD_SET,
  ERR_INCORRECT_PASSWORD,
} from '@/lib/constants/errors'

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

export type SetupTwoFactorResult =
  | {
      ok: true
      qrCode: string
      /** otpauth:// URI。Native 側でクライアントローカルに QR を描画する用途 */
      otpAuthUrl: string
      secret: string
      setupId: string
      backupCodes: string[]
    }
  | { ok: false; error: string }

export type EnableTwoFactorResult = { ok: true } | { ok: false; error: string }

export type DisableTwoFactorResult = { ok: true } | { ok: false; error: string }

export type RegenerateBackupCodesResult =
  | { ok: true; backupCodes: string[] }
  | { ok: false; error: string }

export type TwoFactorStatusResult =
  | { ok: true; enabled: boolean; backupCodesRemaining?: number }
  | { ok: false; error: string }

/**
 * 2FAセットアップを開始する。
 *
 * QRコード、シークレット文字列、バックアップコードを生成し、
 * 暗号化済みシークレットとハッシュ済みバックアップコードをRedisに一時保存する。
 * 有効化時は `setupId` のみを送信するため、シークレットが再送されることはない。
 */
export async function setup2FAForUser(userId: string): Promise<SetupTwoFactorResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabled: true },
  })

  if (!user) return { ok: false, error: ERR_USER_NOT_FOUND }
  if (user.twoFactorEnabled) return { ok: false, error: ERR_2FA_ALREADY_ENABLED }

  const secret = generateSecret()
  const otpAuthUrl = generateTOTPUri(secret, user.email)
  const qrCode = await generateQRCode(otpAuthUrl)
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

  return { ok: true, qrCode, otpAuthUrl, secret, setupId, backupCodes }
}

/**
 * 2FAを有効化する。
 *
 * setup2FAForUser で生成された `setupId` からRedisに保存された暗号化済みシークレットと
 * ハッシュ済みバックアップコードを取得し、TOTPコードを検証した上で2FAを有効化する。
 * 検証成功後は Redis の一時データを削除する（リプレイ防止）。
 */
export async function enable2FAForUser(
  userId: string,
  token: string,
  setupId: string,
): Promise<EnableTwoFactorResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true },
  })

  if (!user) return { ok: false, error: ERR_USER_NOT_FOUND }
  if (user.twoFactorEnabled) return { ok: false, error: ERR_2FA_ALREADY_ENABLED }

  const redis = getRedisClient()
  const setupKey = buildSetupKey(userId, setupId)
  const raw = await redis.get(setupKey)
  if (!raw) return { ok: false, error: ERR_2FA_SETUP_EXPIRED }

  let pending: PendingSetup
  try {
    const parsed = pendingSetupSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return { ok: false, error: ERR_2FA_SETUP_EXPIRED }
    pending = parsed.data
  } catch {
    return { ok: false, error: ERR_2FA_SETUP_EXPIRED }
  }

  const secret = decryptSecret(pending.encryptedSecret)
  const isValid = await verifyTOTP(token, secret)
  if (!isValid) return { ok: false, error: ERR_2FA_INVALID_CODE }

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

  return { ok: true }
}

/**
 * 2FAを無効化する。パスワードを検証した後、2FAを無効化する。
 */
export async function disable2FAForUser(
  userId: string,
  password: string,
): Promise<DisableTwoFactorResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, twoFactorEnabled: true },
  })

  if (!user) return { ok: false, error: ERR_USER_NOT_FOUND }
  if (!user.twoFactorEnabled) return { ok: false, error: ERR_2FA_NOT_ENABLED }

  // パスワードが設定されていない場合（OAuth専用アカウント）
  if (!user.password) return { ok: false, error: ERR_NO_PASSWORD_SET }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) return { ok: false, error: ERR_INCORRECT_PASSWORD }

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  })

  return { ok: true }
}

/**
 * バックアップコードを再生成する。既存のバックアップコードを破棄し、新しいコードを生成する。
 * パスワード認証が必要。
 */
export async function regenerateBackupCodesForUser(
  userId: string,
  password: string,
): Promise<RegenerateBackupCodesResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, twoFactorEnabled: true },
  })

  if (!user) return { ok: false, error: ERR_USER_NOT_FOUND }
  if (!user.twoFactorEnabled) return { ok: false, error: ERR_2FA_NOT_ENABLED }
  if (!user.password) return { ok: false, error: ERR_NO_PASSWORD_SET }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) return { ok: false, error: ERR_INCORRECT_PASSWORD }

  const newBackupCodes = generateBackupCodes()
  const hashedBackupCodes = newBackupCodes.map((code) => hashBackupCode(code))

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorBackupCodes: hashedBackupCodes },
  })

  return { ok: true, backupCodes: newBackupCodes }
}

/** 2FAの状態を取得する。 */
export async function get2FAStatusForUser(userId: string): Promise<TwoFactorStatusResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorBackupCodes: true },
  })

  if (!user) return { ok: false, error: ERR_USER_NOT_FOUND }

  if (user.twoFactorEnabled) {
    return { ok: true, enabled: true, backupCodesRemaining: user.twoFactorBackupCodes.length }
  }

  return { ok: true, enabled: false }
}
