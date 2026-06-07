/**
 * 外部サービス・インフラ関連の制限値
 *
 * @module lib/constants/limits/external
 */

/** 使用量: 警告しきい値（%） */
export const USAGE_WARNING_THRESHOLD = 70

/** 使用量: 危険しきい値（%） */
export const USAGE_DANGER_THRESHOLD = 90

/** 使用量: エラーしきい値（%） */
export const USAGE_ERROR_THRESHOLD = 100

/** S3 ListObjectsV2の1回あたり最大キー数 */
export const S3_LIST_OBJECTS_MAX_KEYS = 1000

/** 1GB（バイト、10進法: Cloudflare/S3の課金基準） */
export const BYTES_PER_GB = 1_000_000_000

/** Supabase無料プランの制限値 */
export const SUPABASE_FREE_TIER_LIMITS = {
  dbSizeGB: 0.5,
  storageSizeGB: 1,
  egressGB: 5,
  mau: 50000,
} as const

/** Supabase無料プラン: ストレージ容量（GB） */
export const SUPABASE_FREE_TIER_GB = 10

/** Supabase: ストレージ超過料金（USD/GB） */
export const SUPABASE_PRICE_PER_GB = 0.015

/** Supabase Pro: デフォルトディスク容量（GB） */
export const SUPABASE_PRO_DISK_GB = 8

/** Cloudflare R2: バケット制限 */
export const R2_BUCKET_LIMIT = 100

/** Resend: 日次メール制限 */
export const RESEND_DAILY_EMAIL_LIMIT = 100

/** Resend: 月次メール制限 */
export const RESEND_MONTHLY_EMAIL_LIMIT = 3000

/** Resend API: メール一覧1リクエストあたりの取得件数 */
export const RESEND_EMAILS_PAGE_SIZE = 100

/** Sentry Issues APIのデフォルト取得件数 */
export const SENTRY_DEFAULT_ISSUES_LIMIT = 10

/** プレミアム月額料金（円・表示用） */
export const PREMIUM_PRICE_MONTHLY_JPY = 350

/** プレミアム年額料金（円・表示用） */
export const PREMIUM_PRICE_YEARLY_JPY = 3500

/** 1ユーザーあたりのプッシュ購読数上限（デバイス数） */
export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 5

/** プッシュ通知送信のTTL（秒）: 24時間 */
export const PUSH_NOTIFICATION_TTL_SECONDS = 86400

/** プッシュ通知送信の並列数上限 */
export const PUSH_SEND_CONCURRENCY = 10

/** プッシュ通知エンドポイントのログ出力時プレビュー文字数 */
export const PUSH_ENDPOINT_LOG_PREVIEW_LENGTH = 50

/** Open-Meteo API ベースURL */
export const WEATHER_API_BASE_URL = 'https://api.open-meteo.com/v1/forecast'

/** 天気キャッシュTTL（秒）: 2時間 */
export const WEATHER_CACHE_TTL_SECONDS = 7200

/** 緯度経度の丸め精度（小数第2位 = 約1km格子） */
export const WEATHER_COORD_PRECISION = 2

/** Cronバッチサイズ */
export const WEATHER_CRON_BATCH_SIZE = 50

/** アドバイス最大表示件数 */
export const WEATHER_MAX_ADVICE_COUNT = 3

/** 強風しきい値（m/s） */
export const WEATHER_WIND_THRESHOLD = 10

/** 猛暑しきい値（℃） */
export const WEATHER_HEAT_THRESHOLD = 35

/** 低温しきい値（℃） */
export const WEATHER_COLD_THRESHOLD = 5

/** UV危険しきい値 */
export const WEATHER_UV_THRESHOLD = 8

/** 天気アドバイス非表示期間（ミリ秒）: 3時間 */
export const WEATHER_DISMISS_DURATION_MS = 3 * 60 * 60 * 1000

/** 天気アドバイス非表示状態のlocalStorageキー */
export const WEATHER_DISMISS_STORAGE_KEY = 'weather-advice-dismissed-at'

/** 大雨しきい値（mm/h） */
export const WEATHER_HEAVY_RAIN_THRESHOLD = 15

/** 高湿度しきい値（%） */
export const WEATHER_HUMIDITY_THRESHOLD = 85

/** 高湿度＋高温しきい値（℃） */
export const WEATHER_HUMIDITY_TEMP_THRESHOLD = 25

/** 水切れ注意: 連続晴天日数 */
export const WEATHER_DRY_CONSECUTIVE_DAYS = 3

/** 水切れ注意: 高温日数（25℃以上） */
export const WEATHER_DRY_HOT_DAYS = 2

/** 国土地理院 住所検索API ベースURL */
export const GSI_ADDRESS_SEARCH_URL = 'https://msearch.gsi.go.jp/address-search/AddressSearch'

/** 水切れ注意: 高温しきい値（℃） */
export const WEATHER_DRY_HOT_THRESHOLD = 25

/** 長雨注意: 連続降水日数 */
export const WEATHER_WET_CONSECUTIVE_DAYS = 3

/** 長雨注意: 降水しきい値（mm/日） */
export const WEATHER_WET_RAIN_THRESHOLD = 1

/** プレミアム期限のフォールバック日数 */
export const PREMIUM_FALLBACK_DAYS = 30

/** サブスクリプション期限切れ警告日数 */
export const SUBSCRIPTION_EXPIRY_WARNING_DAYS = 3

/**
 * サブスクリプション関連メールの一括送信バッチサイズ。
 * プレミアム会員が増えた際に全件を一度に Promise.allSettled すると Resend のレート制限・
 * メモリにスパイクが出るため、チャンクごとに送る (WEATHER_CRON_BATCH_SIZE と同方針)。
 */
export const SUBSCRIPTION_EMAIL_BATCH_SIZE = 50

/** プレミアム期限切れ警告日数 */
export const PREMIUM_EXPIRING_WARN_DAYS = 7

/** 使用量取得: 最大ページ数 */
export const USAGE_MAX_FETCH_PAGES = 5

/** R2オブジェクト一覧取得の最大ページ数 */
export const USAGE_R2_MAX_FETCH_PAGES = 10

/** イベント保持期間（月） */
export const EVENT_RETENTION_MONTHS = 6

/**
 * Webhook 冪等性レコード（`webhook_events`）の保持期間（日）。
 * Stripe 等のリトライ window はおおむね 14 日以内なので、30 日経過した
 * イベントは安全に削除できる。
 */
export const WEBHOOK_EVENT_RETENTION_DAYS = 30

/** 署名付きURLの有効期限（秒） */
export const PRESIGNED_URL_EXPIRY_SECONDS = 3600

/** Server Actionsのボディサイズ上限 */
export const SERVER_ACTION_BODY_SIZE_LIMIT = '10mb'

/** 住所検索APIのタイムアウト（ミリ秒） */
export const ADDRESS_SEARCH_TIMEOUT_MS = 5000

/** 住所・住所候補クエリの最大文字数 */
export const MAX_ADDRESS_LENGTH = 200

/** 住所検索の最小文字数 */
export const MIN_ADDRESS_SEARCH_LENGTH = 2

/** 住所候補の最大表示件数 */
export const MAX_ADDRESS_SUGGESTIONS = 5

/** 一般的な検索クエリの最小文字数 */
export const MIN_SEARCH_QUERY_LENGTH = 2

/** 日付バリデーションの最小年 */
export const MIN_VALID_YEAR = 2000

/** ユーザー登録最小年（盆栽開始年のフォールバック） */
export const USER_BONSAI_START_MIN_YEAR = 1900

/** お問い合わせ回答目安最小営業日数 */
export const CONTACT_RESPONSE_MIN_DAYS = 2

/** お問い合わせ回答目安最大営業日数 */
export const CONTACT_RESPONSE_MAX_DAYS = 3
