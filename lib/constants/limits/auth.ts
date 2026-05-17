/**
 * 認証・セキュリティ関連の制限値
 *
 * @module lib/constants/limits/auth
 */

/** パスワードの最小文字数 */
export const PASSWORD_MIN_LENGTH = 8

/** 2FAコードの桁数 */
export const TWO_FACTOR_CODE_LENGTH = 6

/** bcryptのソルトラウンド数 */
export const BCRYPT_SALT_ROUNDS = 12

/** CSP nonceのバイト長 */
export const NONCE_BYTE_LENGTH = 16

/** デバイスフィンガープリントの最小文字数 */
export const MIN_FINGERPRINT_LENGTH = 10

/** デバイスフィンガープリントの最大文字数 */
export const MAX_FINGERPRINT_LENGTH = 64

/** 訪問者識別 Cookie の最大文字数 (UUID v4 = 36 文字 + 後方互換のための余裕) */
export const MAX_VISITOR_COOKIE_LENGTH = 64

/** 訪問者識別 Cookie の有効日数 (1 年保持で日次重複抑止) */
export const VISITOR_COOKIE_MAX_AGE_DAYS = 365

/** ストレージ providers が生成するランダムバイト長 (Base64 で 12 文字、衝突確率 ~10^-29) */
export const STORAGE_RANDOM_BYTES = 8

/** バックアップコードの生成数 */
export const BACKUP_CODE_COUNT = 10

/** バックアップコードの文字数 */
export const BACKUP_CODE_LENGTH = 8

/** TOTP期間（秒） */
export const TOTP_PERIOD_SECONDS = 30

/** QRコードの幅（px） */
export const QR_CODE_WIDTH = 256

/** QRコードのマージン */
export const QR_CODE_MARGIN = 2

/** TOTP検証の許容ウィンドウ（ステップ数） */
export const TOTP_TOLERANCE_WINDOW = 1

/** 2FAセットアップ一時保存のTTL（秒、10分） */
export const TWO_FACTOR_SETUP_TTL_SECONDS = 600

/** 最大ログイン試行回数（IP+メール単位） */
export const MAX_LOGIN_ATTEMPTS = 5

/** 最大ログイン試行回数（IP単位、全メールアドレス合算） */
export const MAX_IP_LOGIN_ATTEMPTS = 20

/** ログイン追跡ウィンドウ（分） */
export const LOGIN_WINDOW_MINUTES = 15

/** ログインロックアウト時間（分） */
export const LOGIN_LOCKOUT_MINUTES = 30

/** シークレットキーの最小長 */
export const MIN_SECRET_LENGTH = 32

/** cronタイムスタンプ許容差（分） */
export const CRON_TIMESTAMP_TOLERANCE_MINUTES = 5

/** メールトークンの最小文字数 */
export const MIN_TOKEN_LENGTH = 10

/** メール認証再送の最大試行回数（1時間あたり） */
export const MAX_RESEND_VERIFICATION_ATTEMPTS = 3

/** パスワードリセットリクエストの最大試行回数（1時間あたり） */
export const MAX_PASSWORD_RESET_ATTEMPTS = 3

/** トークン生成時のランダムバイト数（256ビット） */
export const TOKEN_RANDOM_BYTES = 32

/** HSTS max-age（秒、1年） */
export const HSTS_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

/**
 * セッション最大寿命（秒、7日）。
 * JWT は一度発行されると失効できないため短めに設定し、漏洩時の被害窓口を限定する。
 */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

/**
 * セッション更新間隔（秒、1日）。
 * アクティブユーザーには 1 日ごとに JWT を再発行して UX を維持する。
 */
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60

/**
 * セキュリティイベントログに含める Referer ヘッダーの最大文字数。
 * 不正な Referer 文字列にトークンや機密パスが混入していた場合の漏洩リスクを抑える。
 */
export const REFERER_LOG_PREVIEW_LENGTH = 100
