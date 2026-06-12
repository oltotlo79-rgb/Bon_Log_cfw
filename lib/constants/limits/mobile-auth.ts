/**
 * モバイル API v1 の認証・JWT 関連制限値
 *
 * @module lib/constants/limits/mobile-auth
 */

/** アクセストークンの有効期間（秒、15分） */
export const MOBILE_ACCESS_TOKEN_TTL_SECONDS = 15 * 60

/** リフレッシュトークンの有効期間（秒、30日） */
export const MOBILE_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

/** JWT issuer 識別子 */
export const MOBILE_JWT_ISSUER = 'bon-log-api'

/** JWT audience 識別子 */
export const MOBILE_JWT_AUDIENCE = 'bon-log-mobile'

/** アクセストークンのトークン種別クレーム値 */
export const MOBILE_TOKEN_TYPE_ACCESS = 'access'

/** リフレッシュトークンのトークン種別クレーム値 */
export const MOBILE_TOKEN_TYPE_REFRESH = 'refresh'

/** JWT 署名アルゴリズム */
export const MOBILE_JWT_ALGORITHM = 'HS256'

/**
 * MOBILE_JWT_SECRET の期待バイト長（hex 文字列として 64 文字 = 32 バイト）。
 * `openssl rand -hex 32` で生成される形式に対応する。
 */
export const MOBILE_JWT_SECRET_HEX_LENGTH = 64

/** リフレッシュトークン生成時のランダムバイト数（32 バイト = 256 ビット）。 */
export const MOBILE_REFRESH_TOKEN_RANDOM_BYTES = 32

/**
 * モバイル向け 2FA チケットの TTL（秒、5 分）。
 * Web の TWO_FACTOR_LOGIN_TICKET_TTL_SECONDS（120 秒）とは別の値。
 * モバイルはユーザーがアプリを切り替えてコードを確認する時間が必要なため長めに設定する。
 */
export const MOBILE_2FA_TICKET_TTL_SECONDS = 5 * 60
