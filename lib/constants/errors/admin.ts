/**
 * 管理者・モデレーション・ブラックリスト・ロール管理関連のエラーメッセージ
 *
 * @module lib/constants/errors/admin
 */

/** 管理者 */
export const ERR_USER_ALREADY_SUSPENDED = 'このユーザーは既に停止されています'
export const ERR_USER_NOT_SUSPENDED = 'このユーザーは停止されていません'
export const ERR_CANNOT_DELETE_SELF = '自分自身を削除することはできません'
export const ERR_CANNOT_DELETE_ADMIN = '管理者ユーザーは削除できません'
export const ERR_NOT_PREMIUM_USER = 'このユーザーは有料会員ではありません'

/** ブラックリスト */
export const ERR_INVALID_EMAIL_FORMAT = '有効なメールアドレスを入力してください'
export const ERR_EMAIL_ALREADY_BLACKLISTED = 'このメールアドレスは既にブラックリストに登録されています'
export const ERR_BLACKLIST_ADD_FAILED = 'ブラックリストへの追加に失敗しました'
export const ERR_BLACKLIST_REMOVE_FAILED = 'ブラックリストからの削除に失敗しました'
export const ERR_BLACKLIST_FETCH_FAILED = 'ブラックリストの取得に失敗しました'
export const ERR_INVALID_FINGERPRINT = '有効なデバイスフィンガープリントを入力してください'
export const ERR_DEVICE_ALREADY_BLACKLISTED = 'このデバイスは既にブラックリストに登録されています'
export const ERR_DEVICE_INFO_FETCH_FAILED = 'デバイス情報の取得に失敗しました'
export const ERR_NO_ASSOCIATED_DEVICES = 'このユーザーに関連付けられたデバイスがありません'
export const ERR_ALL_DEVICES_BLACKLISTED = '全てのデバイスは既にブラックリストに登録されています'
export const ERR_DEVICE_BLACKLIST_FAILED = 'デバイスのブラックリスト追加に失敗しました'

/** モデレーション */
export const ERR_NG_WORD_REQUIRED = 'NGワードを入力してください'
export const ERR_NG_WORD_DUPLICATE = 'このNGワードは既に登録されています'
export const ERR_NG_WORD_NOT_FOUND = 'NGワードが見つかりません'
export const ERR_MODERATION_ITEM_NOT_FOUND = 'モデレーション対象が見つかりません'
export const ERR_WARNING_NOT_FOUND = '警告が見つかりません'
export const ERR_CANNOT_WARN_ADMIN = '管理者に警告を発行できません'
export const ERR_NG_WORD_TOO_LONG = (max: number) => `NGワードは${max}文字以内で入力してください`
export const ERR_NG_WORD_REGEX_TOO_LONG = (max: number) => `正規表現は${max}文字以内で入力してください`
export const ERR_NG_WORD_REGEX_INVALID = '正規表現の構文が不正です'
export const ERR_NG_WORD_REGEX_UNSAFE = '正規表現がReDoS攻撃に脆弱なパターンを含んでいます'
export const ERR_BULK_OPERATION_LIMIT = '一括操作の上限を超えています'

/** セグメント */
export const ERR_SEGMENT_NOT_FOUND = 'セグメントが見つかりません'
export const ERR_SEGMENT_NAME_REQUIRED = 'セグメント名を入力してください'
export const ERR_SEGMENT_CONDITIONS_INVALID = 'セグメント条件が不正です'

/** お知らせ */
export const ERR_ANNOUNCEMENT_NOT_FOUND = 'お知らせが見つかりません'
export const ERR_ANNOUNCEMENT_TITLE_REQUIRED = 'タイトルを入力してください'

/** CMS */
export const ERR_CMS_PAGE_NOT_FOUND = 'ページが見つかりません'
export const ERR_CMS_SLUG_DUPLICATE = 'このスラッグは既に使用されています'
export const ERR_CMS_SLUG_INVALID_CHARS = 'スラッグは英小文字、数字、ハイフン、アンダースコアのみ使用できます'
export const ERR_CMS_SLUG_RESERVED = 'このスラッグは予約語のため使用できません'

/** ロール管理 */
export const ERR_CANNOT_CHANGE_OWN_ROLE = '自分自身のロールは変更できません'
export const ERR_CANNOT_MANAGE_HIGHER_ROLE = '自分より高い権限のロールは管理できません'

/** 分析・監視 */
export const ERR_UNSUPPORTED_EXPORT_TYPE = '未対応のエクスポートタイプです'
export const ERR_MONITORING_DATA_FETCH_FAILED = '監視データの取得に失敗しました'

/** メンテナンス */
export const ERR_SYSTEM_SETTING_UPDATE_FAILED = 'システム設定の更新に失敗しました'
export const ERR_SETTING_UPDATE_FAILED = '設定の更新に失敗しました'

/** API（管理系等）で未認証時に返す英語メッセージ */
export const API_ERR_UNAUTHORIZED = 'Unauthorized'

/** API（管理系等）で権限不足時に返す英語メッセージ */
export const API_ERR_FORBIDDEN = 'Forbidden'

/** API で予期せぬ障害が発生した場合の汎用英語メッセージ */
export const API_ERR_INTERNAL_SERVER_ERROR = 'Internal server error'

/** API で HTTP 429 を返す際の英語メッセージ */
export const API_ERR_TOO_MANY_REQUESTS = 'Too many requests'

/** Stripe webhook secret 未設定時の英語メッセージ */
export const API_ERR_WEBHOOK_NOT_CONFIGURED = 'Webhook not configured'

/** Webhook ハンドラが一過性エラーで失敗し、リトライを要求する場合の英語メッセージ */
export const API_ERR_WEBHOOK_PROCESSING_FAILED = 'Webhook processing failed'

/** Webhook 受信時に stripe-signature ヘッダが欠落していた場合の英語メッセージ */
export const API_ERR_MISSING_SIGNATURE = 'Missing signature'

/** Webhook 署名検証に失敗した場合の英語メッセージ */
export const API_ERR_INVALID_SIGNATURE = 'Invalid signature'

/** Push 通知の VAPID 鍵が未設定で配信不可な場合の英語メッセージ */
export const API_ERR_PUSH_NOT_CONFIGURED = 'Push notifications not configured'

/** Cron API (`/api/cron/*`) の認証エラー */
export const API_ERR_CRON_SECRET_MISSING = 'CRON_SECRET is not configured'
export const API_ERR_CRON_INVALID_SCHEME = 'Invalid authorization scheme'
export const API_ERR_CRON_MISSING_TIMESTAMP = 'Missing timestamp header'
export const API_ERR_CRON_INVALID_TIMESTAMP = 'Invalid timestamp format'
export const API_ERR_CRON_TIMESTAMP_EXPIRED =
  'Request timestamp is too old or too far in the future'
export const API_ERR_CRON_INVALID_SIGNATURE = 'Invalid signature'

/** Sentry API へのリクエストが非 2xx 応答だったときに返す英語メッセージ。 */
export const ERR_SENTRY_API_STATUS = (status: number) => `Sentry API: ${status}`

/** Usage API (`/api/admin/usage`) の外部プロバイダ認証情報未設定エラー */
export const ERR_USAGE_FLYIO_TOKEN_MISSING = 'FLY_API_TOKEN が未設定'
export const ERR_USAGE_RESEND_API_KEY_MISSING = 'RESEND_API_KEY が未設定'

/** Sentry 管理 API (`/api/admin/sentry`) のエラー / 案内文 */
export const ERR_SENTRY_TOKEN_MISSING = 'SENTRY_API_TOKEN が未設定'
export const HELP_SENTRY_TOKEN_SETUP =
  'Internal Integrationでトークンを作成し、SENTRY_API_TOKENに設定してください'
export const HELP_SENTRY_TOKEN_FORBIDDEN =
  'トークンの権限不足です。Internal Integrationで作成してください。'
export const HELP_SENTRY_TOKEN_UNAUTHORIZED =
  'トークンが無効です。設定を確認してください。'
export const HELP_SENTRY_BAD_REQUEST = 'リクエストエラーが発生しました。'
export const HELP_SENTRY_PROJECT_NOT_FOUND =
  'プロジェクトが見つかりません。設定を確認してください。'

/** 使用量 API (`/api/admin/usage`) のエラー */
export const ERR_USAGE_FETCH_FAILED = '取得中にエラーが発生'
export const ERR_USAGE_FETCH_FAILED_DETAIL = 'データの取得に失敗しました'
export const ERR_USAGE_S3_CONNECTION = 'S3 API接続エラーが発生しました'

/** 全文検索インフラ (`/api/admin/search/setup`) のエラー */
export const ERR_SEARCH_INVALID_ACTION = '不正なアクションです'
export const ERR_SEARCH_STATUS_FAILED = '検索ステータスの取得に失敗しました'
export const ERR_SEARCH_SETUP_FAILED = 'セットアップに失敗しました'
export const ERR_SEARCH_EXTENSION_ENABLED = 'pg_trgm拡張を有効化しました'
export const ERR_SEARCH_EXTENSION_FAILED = 'pg_trgm拡張の有効化に失敗しました。データベース管理者に連絡してください。'
export const ERR_SEARCH_FULL_SETUP_OK = '全文検索のセットアップが完了しました'
export const ERR_SEARCH_FULL_SETUP_FAILED = '全文検索のセットアップ中にエラーが発生しました'
