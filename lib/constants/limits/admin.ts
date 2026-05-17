/**
 * 管理者機能の制限値・閾値定数
 *
 * @module lib/constants/limits/admin
 */

/** 一括モデレーション操作の最大件数 */
export const BULK_MODERATION_MAX = 500

/** 一括投稿削除の最大件数 */
export const BULK_DELETE_POSTS_MAX = 500

/** 一括ユーザー停止の最大件数 */
export const BULK_SUSPEND_USERS_MAX = 200

/** 1時間あたりのいいね数閾値（超過で不審行動フラグ） */
export const SUSPICIOUS_LIKES_PER_HOUR = 50

/** 1日あたりの投稿数閾値（超過で不審行動フラグ） */
export const SUSPICIOUS_POSTS_PER_DAY = 30

/** 累計通報件数閾値（超過で不審行動フラグ） */
export const SUSPICIOUS_REPORTS_THRESHOLD = 5

/** 1時間あたりのフォロー数閾値（超過で不審行動フラグ） */
export const SUSPICIOUS_FOLLOWS_PER_HOUR = 30

/** 有効なお知らせの最大表示件数 */
export const ACTIVE_ANNOUNCEMENTS_LIMIT = 5

/**
 * 管理画面のお知らせ一覧の最大表示件数。
 * ページネーションではなく一覧を一括表示する想定で、通常運用では十分な件数を確保する。
 */
export const ADMIN_ANNOUNCEMENTS_PAGE_LIMIT = 100

/** CMSバージョン履歴の表示件数 */
export const CMS_VERSION_HISTORY_LIMIT = 10

/** 農薬データ更新履歴の表示件数 */
export const PESTICIDE_HISTORY_LIMIT = 20

/** 農薬詳細ページの更新履歴表示件数 */
export const PESTICIDE_DETAIL_HISTORY_LIMIT = 20

/** コンテンツ分析: トップジャンルの表示件数 */
export const ADMIN_TOP_GENRES_LIMIT = 10

/** コンテンツ分析: トップハッシュタグの表示件数 */
export const ADMIN_TOP_HASHTAGS_LIMIT = 20

/** 複数アカウント検出のSQL結果上限 */
export const MULTI_ACCOUNT_DETECTION_LIMIT = 50

/** 複数アカウント検出: 同一IPから関連付けられたユニークユーザー数の最小閾値（これ以上で疑義あり扱い） */
export const MULTI_ACCOUNT_MIN_THRESHOLD = 2

/** セキュリティダッシュボードの失敗IPトップ件数 */
export const TOP_FAILED_IPS_LIMIT = 10

/** CSVエクスポートの最大行数 */
export const CSV_EXPORT_MAX_ROWS = 5000

/** コホート分析の最大レコード取得数（OOM防止） */
export const COHORT_ANALYSIS_MAX_RECORDS = 50000

/** アクティビティプレビュー文字数上限 */
export const ACTIVITY_PREVIEW_LENGTH = 50

/** アクティビティID表示文字数 */
export const ACTIVITY_ID_PREVIEW_LENGTH = 8

/** 通知一括作成のバッチサイズ */
export const NOTIFICATION_BATCH_SIZE = 5000

/** 分析のデフォルト期間（日数） */
export const ANALYTICS_DAYS_RANGE = 30

/** コホート分析のデフォルト月数 */
export const COHORT_MONTHS_DEFAULT = 6

/** NGワードログ出力時のプレビュー文字数 */
export const NG_WORD_LOG_PREVIEW_LENGTH = 20

/** NGワードの最大文字数 */
export const NG_WORD_MAX_LENGTH = 100

/** NGワード正規表現の最大文字数 */
export const NG_WORD_REGEX_MAX_LENGTH = 100

/** NGワードキャッシュTTL（秒） */
export const NG_WORDS_CACHE_TTL_SECONDS = 300

/** CMSスラッグの許可パターン */
export const CMS_SLUG_PATTERN = /^[a-z0-9][a-z0-9\-_]*$/

/** CMSスラッグの予約語 */
export const CMS_SLUG_RESERVED = ['admin', 'api', 'auth', 'feed', 'login', 'register', 'settings']

/** ヘルスチェック ping の TTL（秒） */
export const HEALTH_CHECK_PING_TTL_SECONDS = 60

/** Redis レイテンシが「degraded」と判定される閾値（ミリ秒） */
export const REDIS_LATENCY_DEGRADED_THRESHOLD_MS = 500

/** プレミアム手動付与のデフォルト日数 */
export const DEFAULT_PREMIUM_GRANT_DAYS = 30

/** プレミアム手動付与・延長の最小日数 (1 日未満を弾く)。 */
export const MIN_PREMIUM_GRANT_DAYS = 1

/** プレミアム手動付与・延長の最大日数 (1 年で UI 上の保護的上限)。 */
export const MAX_PREMIUM_GRANT_DAYS = 365

/**
 * 管理者がコンテンツ削除・ユーザー停止時に記録する理由文字列の最大長。
 * adminLog.details の JSON に格納されるため、ログ肥大化と濫用入力を抑止する保護的上限。
 */
export const MAX_ADMIN_REASON_LENGTH = 1000

/**
 * CMS ページのタイトル / コンテンツの最大文字数。
 * Markdown 含む長文を許容しつつ、極端な肥大化を防ぐ。
 */
export const MAX_CMS_TITLE_LENGTH = 200
export const MAX_CMS_CONTENT_LENGTH = 100000

/**
 * CMS / 警告などのカテゴリ文字列の最大長 (slug 同等の保護的上限)。
 */
export const MAX_CMS_CATEGORY_LENGTH = 50

/**
 * 警告の理由フィールド最大文字数。長文の事案説明にも耐える保護的上限。
 */
export const MAX_WARNING_REASON_LENGTH = 5000

/**
 * セグメント名 / 説明の最大文字数。
 */
export const MAX_SEGMENT_NAME_LENGTH = 100
export const MAX_SEGMENT_DESCRIPTION_LENGTH = 500

/**
 * 管理者ダッシュボードのアクセス推移グラフ表示期間（日数）の許容値。
 *
 * `?range=` クエリで切替可能な期間の閉じた集合。許可リスト方式で
 * 不正な値（任意の数値、極端に長い期間によるDB負荷増、SQLi の入力経路化等）
 * を一律に弾く。順序はそのまま UI の並び順となる。
 */
export const ADMIN_VISITORS_DAYS_RANGES = [30, 90, 180] as const

/**
 * `ADMIN_VISITORS_DAYS_RANGES` の要素を表すユニオン型（30 | 90 | 180）。
 */
export type AdminVisitorsDaysRange = (typeof ADMIN_VISITORS_DAYS_RANGES)[number]

/**
 * `?range=` 未指定時に使用する管理者ダッシュボードのアクセス推移期間（日数）。
 */
export const ADMIN_VISITORS_DEFAULT_DAYS: AdminVisitorsDaysRange = 30
