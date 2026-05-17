/**
 * 2段階認証（2FA）ユーティリティ
 *
 * @module lib/two-factor
 */

import { OTP } from 'otplib'
import * as QRCode from 'qrcode'
import crypto from 'crypto'
import {
  BACKUP_CODE_COUNT as LIMITS_BACKUP_CODE_COUNT,
  BACKUP_CODE_LENGTH as LIMITS_BACKUP_CODE_LENGTH,
  TOTP_PERIOD_SECONDS,
  TOTP_TOLERANCE_WINDOW,
  TWO_FACTOR_CODE_LENGTH,
  QR_CODE_WIDTH,
  QR_CODE_MARGIN,
} from '@/lib/constants/limits'

const otp = new OTP({ strategy: 'totp' })

const TOTP_ISSUER = 'BON-LOG'
const BACKUP_CODE_COUNT = LIMITS_BACKUP_CODE_COUNT
const BACKUP_CODE_LENGTH = LIMITS_BACKUP_CODE_LENGTH

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // AES-GCM の初期化ベクトル長
const AUTH_TAG_LENGTH = 16 // AES-GCM の認証タグ長

/**
 * 鍵バージョン識別子の検証用パターン。整数のみ許容（`v1`, `v2`, ...）。
 * 想定外のキー名で `process.env` を参照する事故を防ぐため厳格に判定する。
 */
const KEY_VERSION_PATTERN = /^v(\d+)$/

/**
 * 暗号文の鍵バージョンプレフィックス区切り文字。
 * `v1:base64...` のようにエンコード結果の先頭に付与する。
 * 旧形式（プレフィックスなし）は v1 として扱う後方互換あり（migrateToCurrentKeyVersion 参照）。
 */
const KEY_VERSION_DELIMITER = ':'

/** 暗号化に使用する鍵バージョン（出力時に付与）。未指定なら v1。 */
const CURRENT_KEY_VERSION_ENV = 'TWO_FACTOR_KEY_VERSION'

/**
 * 鍵を環境変数から取得する。
 *
 * 単一鍵 (`TWO_FACTOR_ENCRYPTION_KEY`) と
 * バージョン別鍵 (`TWO_FACTOR_ENCRYPTION_KEY_v1`, `_v2`, ...) の両方に対応する。
 * バージョン別鍵が設定されていれば優先し、無ければ単一鍵を v1 とみなす。
 *
 * これにより以下のローテーション運用が可能となる:
 * 1. 新鍵 v2 を `TWO_FACTOR_ENCRYPTION_KEY_v2` として追加投入
 * 2. `TWO_FACTOR_KEY_VERSION=v2` に切替（以降の暗号化は v2 で実行）
 * 3. ユーザー再ログイン時等に migrateToCurrentKeyVersion で再暗号化
 * 4. 全レコード移行完了後、旧鍵 v1 を削除
 */
function getEncryptionKey(version: string): Buffer {
  if (!KEY_VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid 2FA key version: ${version}`)
  }

  const versionedKey = process.env[`TWO_FACTOR_ENCRYPTION_KEY_${version}`]
  const fallbackKey = version === 'v1' ? process.env.TWO_FACTOR_ENCRYPTION_KEY : undefined
  const key = versionedKey || fallbackKey

  if (!key) {
    throw new Error(`TWO_FACTOR_ENCRYPTION_KEY for ${version} is not configured`)
  }

  // hex文字列をBufferに変換（32バイト = 256ビット）
  return Buffer.from(key, 'hex')
}

/**
 * 暗号化に使用する現在の鍵バージョンを取得する。
 * 未指定時は `v1` を使用（既存環境との後方互換）。
 */
function getCurrentKeyVersion(): string {
  const version = process.env[CURRENT_KEY_VERSION_ENV] || 'v1'
  if (!KEY_VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid ${CURRENT_KEY_VERSION_ENV}: ${version}`)
  }
  return version
}

/** Google Authenticator 等で読み取れる Base32 エンコードのシークレットを生成する。 */
export function generateSecret(): string {
  return otp.generateSecret()
}

/** Authenticator アプリ用の otpauth URI を組み立てる。 */
export function generateTOTPUri(secret: string, email: string): string {
  return otp.generateURI({
    secret,
    issuer: TOTP_ISSUER,
    label: email,
    period: TOTP_PERIOD_SECONDS,
    digits: TWO_FACTOR_CODE_LENGTH,
    algorithm: 'sha1',
  })
}

/** otpauth URI を PNG QR コードの Data URL にする。 */
export async function generateQRCode(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: QR_CODE_MARGIN,
    width: QR_CODE_WIDTH,
  })
}

/**
 * TOTP コードを検証する。
 * 端末時計のズレを許容するため前後 TOTP_TOLERANCE_WINDOW ステップ（既定: 前後 1 = 合計 90 秒）まで受理する。
 */
export async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  const normalizedToken = token.replace(/\D/g, '').slice(0, TWO_FACTOR_CODE_LENGTH)

  if (normalizedToken.length !== TWO_FACTOR_CODE_LENGTH) {
    return false
  }

  try {
    const result = await otp.verify({
      secret,
      token: normalizedToken,
      epochTolerance: TOTP_TOLERANCE_WINDOW * TOTP_PERIOD_SECONDS,
    })
    return result.valid
  } catch {
    return false
  }
}

/**
 * 2FA の予備用バックアップコードを生成する（各コードは 1 回限り）。
 * モジュラバイアスを避けるため、文字セット長の整数倍（252 = 256 - 256 % 36）を超える乱数バイトはリジェクトする。
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = []
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const maxValid = 256 - (256 % chars.length) // = 252

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let code = ''
    let pos = 0
    const randomBytes = crypto.randomBytes(BACKUP_CODE_LENGTH * 2)

    while (code.length < BACKUP_CODE_LENGTH) {
      if (pos >= randomBytes.length) {
        // リジェクト続きで枯渇した場合は追加バッファを用意
        const extra = crypto.randomBytes(BACKUP_CODE_LENGTH)
        for (let k = 0; k < extra.length && code.length < BACKUP_CODE_LENGTH; k++) {
          const byte = extra[k]
          if (byte !== undefined && byte < maxValid) {
            const ch = chars[byte % chars.length]
            if (ch) code += ch
          }
        }
        continue
      }
      const byte = randomBytes[pos]
      if (byte !== undefined && byte < maxValid) {
        const ch = chars[byte % chars.length]
        if (ch) code += ch
      }
      pos++
    }

    codes.push(code)
  }

  return codes
}

/**
 * バックアップコードを SHA-256 でハッシュ化する。
 * DB 保存前に必ず通すこと。大文字＋英数のみに正規化してから hash する。
 */
export function hashBackupCode(code: string): string {
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return crypto.createHash('sha256').update(normalizedCode).digest('hex')
}

/**
 * バックアップコードを検証し、一致したハッシュのインデックスを返す（無ければ -1）。
 * 呼び出し側は返却インデックスを使って該当ハッシュを DB から無効化すること。
 */
export function verifyBackupCode(
  inputCode: string,
  hashedCodes: string[]
): number {
  const inputHash = hashBackupCode(inputCode)

  for (let i = 0; i < hashedCodes.length; i++) {
    // タイミング攻撃対策として timingSafeEqual で比較

    const stored = hashedCodes[i]
    if (!stored) continue
    const storedHash = Buffer.from(stored, 'hex')
    const inputHashBuffer = Buffer.from(inputHash, 'hex')

    if (
      storedHash.length === inputHashBuffer.length &&
      crypto.timingSafeEqual(storedHash, inputHashBuffer)
    ) {
      return i
    }
  }

  return -1
}

/**
 * シークレットを AES-256-GCM で暗号化する。
 * 出力形式は `<version>:<base64(IV|cipher|authTag)>`。version プレフィックスにより
 * 復号時に鍵のバージョンを判別でき、無停止ローテーションが可能。
 */
export function encryptSecret(plainSecret: string): string {
  const version = getCurrentKeyVersion()
  const key = getEncryptionKey(version)
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)

  let encrypted = cipher.update(plainSecret, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag,
  ])

  return `${version}${KEY_VERSION_DELIMITER}${combined.toString('base64')}`
}

/**
 * 暗号化シークレットを復号する。
 * バージョンプレフィックスが無い旧形式は v1 として扱う（後方互換）。
 */
export function decryptSecret(encryptedSecret: string): string {
  const delimiterIndex = encryptedSecret.indexOf(KEY_VERSION_DELIMITER)
  const hasVersionPrefix =
    delimiterIndex > 0 && KEY_VERSION_PATTERN.test(encryptedSecret.slice(0, delimiterIndex))
  const version = hasVersionPrefix ? encryptedSecret.slice(0, delimiterIndex) : 'v1'
  const cipherPayload = hasVersionPrefix
    ? encryptedSecret.slice(delimiterIndex + 1)
    : encryptedSecret

  const key = getEncryptionKey(version)
  const combined = Buffer.from(cipherPayload, 'base64')

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

/**
 * 旧鍵で暗号化されたシークレットを現在の鍵で再暗号化する（無停止ローテーション用）。
 *
 * 通常の運用では `verifyTOTP` 直後に呼び、復号→現行鍵で再暗号化→DB 更新の流れで使う。
 * 現行バージョンと一致する場合は元の文字列を返す（再書き込み不要）。
 *
 * @returns 再暗号化が必要なら新しい暗号文、不要ならnull
 */
export function migrateToCurrentKeyVersion(encryptedSecret: string): string | null {
  const delimiterIndex = encryptedSecret.indexOf(KEY_VERSION_DELIMITER)
  const hasVersionPrefix =
    delimiterIndex > 0 && KEY_VERSION_PATTERN.test(encryptedSecret.slice(0, delimiterIndex))
  const storedVersion = hasVersionPrefix ? encryptedSecret.slice(0, delimiterIndex) : 'v1'
  const currentVersion = getCurrentKeyVersion()

  if (storedVersion === currentVersion) return null

  const plaintext = decryptSecret(encryptedSecret)
  return encryptSecret(plaintext)
}

/** 入力されたコードを数字のみの所定桁数に正規化する。 */
export function formatTOTPCode(code: string): string {
  return code.replace(/[^0-9]/g, '').slice(0, TWO_FACTOR_CODE_LENGTH)
}

/** 入力されたバックアップコードを大文字英数のみに正規化する。 */
export function formatBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** 6 桁の数字なら TOTP、それ以外はバックアップコードとみなす。 */
export function detectCodeType(code: string): 'totp' | 'backup' {
  const cleaned = code.replace(/[^A-Za-z0-9]/g, '')

  if (/^\d{6}$/.test(cleaned)) {
    return 'totp'
  }

  return 'backup'
}
