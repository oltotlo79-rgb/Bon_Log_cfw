/**
 * セキュリティチェックユーティリティ
 *
 * 本番環境でのセキュリティ設定を検証するためのユーティリティ。
 * アプリケーション起動時やリクエスト処理時に使用。
 *
 * ## チェック項目
 * - NEXTAUTH_SECRETの強度
 * - 必須環境変数の設定
 * - 危険な設定の検出
 *
 * @module lib/security-checks
 */

import logger from '@/lib/logger'
import { MIN_SECRET_LENGTH as LIMITS_MIN_SECRET_LENGTH } from '@/lib/constants/limits'
import { getAppUrl } from '@/lib/env'

/**
 * 弱いシークレットのパターン
 *
 * 本番環境で使用すべきでないシークレットのパターン
 */
const WEAK_SECRET_PATTERNS = [
  'your-development-secret',
  'your-secret-key',
  'change-in-production',
  'development-secret',
  'dev-secret',
  'test-secret',
  'secret',
  'password',
  '12345',
  'example',
  'changeme',
  'placeholder',
]

/**
 * 最小シークレット長
 *
 * 安全なシークレットの最小文字数
 * Base64エンコードされた32バイト = 44文字
 */
const MIN_SECRET_LENGTH = LIMITS_MIN_SECRET_LENGTH

/**
 * 最小エントロピー比率
 *
 * シークレットの複雑性を判定するための閾値
 * (ユニーク文字数 / 全体の文字数)
 */
const MIN_ENTROPY_RATIO = 0.3

/**
 * NEXTAUTH_SECRETの強度を検証
 *
 * @returns 検証結果
 */
export function validateAuthSecret(): {
  valid: boolean
  warnings: string[]
  errors: string[]
} {
  const secret = process.env.NEXTAUTH_SECRET
  const isProduction = process.env.NODE_ENV === 'production'
  const warnings: string[] = []
  const errors: string[] = []

  // シークレットが設定されていない
  if (!secret) {
    if (isProduction) {
      errors.push('NEXTAUTH_SECRET が設定されていません。本番環境では必須です。')
    } else {
      warnings.push('NEXTAUTH_SECRET が設定されていません。')
    }
    return { valid: !isProduction, warnings, errors }
  }

  // シークレットが短すぎる
  if (secret.length < MIN_SECRET_LENGTH) {
    const message = `NEXTAUTH_SECRET が短すぎます（${secret.length}文字）。${MIN_SECRET_LENGTH}文字以上を推奨します。`
    if (isProduction) {
      errors.push(message)
    } else {
      warnings.push(message)
    }
  }

  // 弱いパターンを含む
  const lowerSecret = secret.toLowerCase()
  for (const pattern of WEAK_SECRET_PATTERNS) {
    if (lowerSecret.includes(pattern.toLowerCase())) {
      const message = `NEXTAUTH_SECRET に弱いパターン '${pattern}' が含まれています。'openssl rand -base64 32' で生成した値を使用してください。`
      if (isProduction) {
        errors.push(message)
      } else {
        warnings.push(message)
      }
      break
    }
  }

  // エントロピーチェック（簡易版）
  const uniqueChars = new Set(secret).size
  const entropyRatio = uniqueChars / secret.length
  if (entropyRatio < MIN_ENTROPY_RATIO) {
    const message = 'NEXTAUTH_SECRET のエントロピーが低いです。より複雑な値を使用してください。'
    if (isProduction) {
      warnings.push(message)
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  }
}

/**
 * 必須環境変数のチェック
 *
 * @returns 検証結果
 */
export function validateRequiredEnvVars(): {
  valid: boolean
  missing: string[]
} {
  const isProduction = process.env.NODE_ENV === 'production'

  // 本番環境で必須の環境変数
  const requiredInProduction = [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
  ]

  // 常に必須の環境変数
  const alwaysRequired = ['DATABASE_URL']

  const toCheck = isProduction ? requiredInProduction : alwaysRequired
  const missing: string[] = []

  for (const envVar of toCheck) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * セキュリティ警告をログに出力
 *
 * アプリケーション起動時に呼び出す
 */
export function logSecurityWarnings(): void {
  const isProduction = process.env.NODE_ENV === 'production'

  // シークレット検証
  const secretCheck = validateAuthSecret()

  for (const error of secretCheck.errors) {
    logger.error(`[SECURITY ERROR] ${error}`)
  }

  for (const warning of secretCheck.warnings) {
    logger.warn(`[SECURITY WARNING] ${warning}`)
  }

  // 環境変数検証
  const envCheck = validateRequiredEnvVars()

  if (envCheck.missing.length > 0) {
    const level = isProduction ? 'ERROR' : 'WARNING'
    logger.warn(
      `[SECURITY ${level}] 以下の環境変数が設定されていません: ${envCheck.missing.join(', ')}`
    )
  }

  // 本番環境での追加チェック
  if (isProduction) {
    // HTTPSチェック
    const appUrl = getAppUrl()
    if (appUrl && !appUrl.startsWith('https://')) {
      logger.warn('[SECURITY WARNING] NEXT_PUBLIC_APP_URL がHTTPSではありません')
    }

    // デバッグモードチェック
    if (process.env.DEBUG === 'true') {
      logger.warn('[SECURITY WARNING] 本番環境でDEBUGモードが有効です')
    }

    // 画像最適化の許可元ホスト名チェック (next/image remotePatterns)。
    // 未設定時は wildcard fallback (`*.r2.dev` 等) が適用され許可範囲が広くなるため警告する。
    const imageHostnameEnvs = [
      'R2_PUBLIC_HOSTNAME',
      'R2_CUSTOM_HOSTNAME',
      'SUPABASE_STORAGE_HOSTNAME',
    ]
    for (const envVar of imageHostnameEnvs) {
      if (!process.env[envVar]) {
        logger.warn(`[SECURITY WARNING] ${envVar} が未設定です。next/image の remotePatterns は wildcard にフォールバックします。`)
      }
    }
  }
}

/**
 * セキュリティチェックを実行して結果を返す
 *
 * @returns 全体の検証結果
 */
export function runSecurityChecks(): {
  valid: boolean
  secretCheck: ReturnType<typeof validateAuthSecret>
  envCheck: ReturnType<typeof validateRequiredEnvVars>
} {
  const secretCheck = validateAuthSecret()
  const envCheck = validateRequiredEnvVars()

  return {
    valid: secretCheck.valid && envCheck.valid,
    secretCheck,
    envCheck,
  }
}

/**
 * 本番環境でセキュリティチェックに失敗した場合にエラーをスロー
 *
 * アプリケーション起動時に呼び出すことで、
 * セキュリティ設定が不十分な状態での起動を防ぐ
 */
export function enforceSecurityInProduction(): void {
  if (process.env.NODE_ENV !== 'production') {
    // 開発環境では警告のみ
    logSecurityWarnings()
    return
  }

  const result = runSecurityChecks()

  if (!result.valid) {
    const errors: string[] = [
      ...result.secretCheck.errors,
      ...(result.envCheck.missing.length > 0
        ? [`必須環境変数が不足: ${result.envCheck.missing.join(', ')}`]
        : []),
    ]

    logger.error('[SECURITY] 本番環境でセキュリティチェックに失敗しました:')
    errors.forEach((e) => logger.error(`  - ${e}`))

    // 本番環境ではエラーをスロー
    throw new Error(`セキュリティチェック失敗: ${errors.join('; ')}`)
  }

  // 警告をログ出力
  logSecurityWarnings()
}
