/**
 * モバイル API v1 向けエラーコード定数とメッセージマッピング
 *
 * コードは SCREAMING_SNAKE_CASE で統一し、OpenAPI enum としてそのまま出力できる形にする。
 * 日本語メッセージは既存の ERR_* 定数と整合させ、対応品がある場合は再利用する。
 *
 * @module lib/constants/errors/mobile-api
 */

import {
  ERR_AUTH_REQUIRED,
  ERR_INVALID_TOKEN,
  ERR_TOKEN_EXPIRED,
  ERR_LOGIN_INVALID_CREDENTIALS,
  ERR_2FA_INVALID_CODE,
  ERR_2FA_SETUP_EXPIRED,
  ERR_ACCOUNT_SUSPENDED,
  ERR_GUEST_CANNOT_CREATE,
  ERR_EMAIL_NOT_VERIFIED,
  ERR_INVALID_INPUT,
  ERR_RATE_LIMIT_OPERATION,
  ERR_NOT_FOUND,
  ERR_OPERATION_FAILED,
  ERR_VIDEO_PREMIUM_ONLY,
  ERR_TERMS_ACCEPTANCE_REQUIRED,
} from '@/lib/constants/errors'

/**
 * モバイル API v1 のエラーコード一覧。
 * `as const` で文字列リテラル型として絞り込み、enum に依存しない型安全を実現する。
 */
export const MOBILE_API_ERROR_CODES = {
  /** Bearer ヘッダーが存在しない、または認証が必要 */
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  /** JWT の署名・形式が不正 */
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  /** JWT の有効期限切れ（モバイルはこのコードでのみリフレッシュを試みる） */
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  /** メール/パスワード認証の資格情報が不正 */
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  /** 2FA が必要（ログイン第2ステップへ進む必要がある） */
  AUTH_2FA_REQUIRED: 'AUTH_2FA_REQUIRED',
  /** 2FA コードが不正 */
  AUTH_2FA_INVALID_CODE: 'AUTH_2FA_INVALID_CODE',
  /** 2FA チケットの有効期限切れ */
  AUTH_2FA_TICKET_EXPIRED: 'AUTH_2FA_TICKET_EXPIRED',
  /** リフレッシュトークンが無効または存在しない */
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  /**
   * リフレッシュトークンの再利用を検知。
   * モバイルはこのコードで専用の「セキュリティ警告」画面を表示する（合意済み）。
   */
  AUTH_REFRESH_TOKEN_REUSE_DETECTED: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
  /** アカウント停止 */
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  /** ゲストアカウントは許可されない操作 */
  GUEST_NOT_ALLOWED: 'GUEST_NOT_ALLOWED',
  /** メールアドレス未確認 */
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  /** 入力バリデーションエラー */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** レート制限超過 */
  RATE_LIMITED: 'RATE_LIMITED',
  /** リソースが見つからない */
  NOT_FOUND: 'NOT_FOUND',
  /** リソースの競合（重複登録等） */
  CONFLICT: 'CONFLICT',
  /** サーバー内部エラー */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** サーバー設定エラー（環境変数未設定等） */
  SERVER_MISCONFIGURED: 'SERVER_MISCONFIGURED',
  /** プレミアム会員限定の操作（動画アップロード等） */
  PREMIUM_REQUIRED: 'PREMIUM_REQUIRED',
  /**
   * Google 認証で未知ユーザーを新規作成する際、規約同意が欠落・不一致（バージョン不一致含む）。
   * 既存ユーザーのログイン/リンクではこのエラーは発生しない。
   */
  TERMS_ACCEPTANCE_REQUIRED: 'TERMS_ACCEPTANCE_REQUIRED',
} as const

/** モバイル API エラーコードの型 */
export type MobileApiErrorCode =
  (typeof MOBILE_API_ERROR_CODES)[keyof typeof MOBILE_API_ERROR_CODES]

/**
 * エラーコードと日本語メッセージのマッピング。
 * 既存の ERR_* 定数と整合させることで、ウェブ側との一貫性を保つ。
 */
export const MOBILE_API_ERROR_MESSAGES: Record<MobileApiErrorCode, string> = {
  AUTH_REQUIRED: ERR_AUTH_REQUIRED,
  AUTH_INVALID_TOKEN: ERR_INVALID_TOKEN,
  AUTH_TOKEN_EXPIRED: ERR_TOKEN_EXPIRED,
  AUTH_INVALID_CREDENTIALS: ERR_LOGIN_INVALID_CREDENTIALS,
  AUTH_2FA_REQUIRED: '2段階認証が必要です',
  AUTH_2FA_INVALID_CODE: ERR_2FA_INVALID_CODE,
  AUTH_2FA_TICKET_EXPIRED: ERR_2FA_SETUP_EXPIRED,
  AUTH_REFRESH_TOKEN_INVALID: 'リフレッシュトークンが無効です。再ログインしてください',
  AUTH_REFRESH_TOKEN_REUSE_DETECTED:
    'セキュリティ上の問題が検出されました。再ログインしてください',
  ACCOUNT_SUSPENDED: ERR_ACCOUNT_SUSPENDED,
  GUEST_NOT_ALLOWED: ERR_GUEST_CANNOT_CREATE,
  EMAIL_NOT_VERIFIED: ERR_EMAIL_NOT_VERIFIED,
  VALIDATION_ERROR: ERR_INVALID_INPUT,
  RATE_LIMITED: ERR_RATE_LIMIT_OPERATION,
  NOT_FOUND: ERR_NOT_FOUND,
  CONFLICT: '既に存在するリソースです',
  INTERNAL_ERROR: ERR_OPERATION_FAILED,
  SERVER_MISCONFIGURED: 'サーバーの設定に問題があります。管理者にお問い合わせください',
  PREMIUM_REQUIRED: ERR_VIDEO_PREMIUM_ONLY,
  TERMS_ACCEPTANCE_REQUIRED: ERR_TERMS_ACCEPTANCE_REQUIRED,
} as const
