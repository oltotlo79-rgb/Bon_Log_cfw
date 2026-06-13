/**
 * 投稿・コメント・コンテンツ関連の制限値
 *
 * @module lib/constants/limits/post
 */

/** ニックネームの最大文字数 */
export const MAX_NICKNAME_LENGTH = 50

/** 名前の最大文字数 */
export const MAX_NAME_LENGTH = 50

/** メールアドレスの最大文字数 */
export const MAX_EMAIL_LENGTH = 100

/** 件名の最大文字数 */
export const MAX_SUBJECT_LENGTH = 100

/** 自己紹介の最大文字数 */
export const MAX_BIO_LENGTH = 200

/** 通報詳細の最大文字数 */
export const MAX_REPORT_DETAIL_LENGTH = 500

/** 投稿の最大文字数（無料プラン） */
export const MAX_POST_CONTENT_FREE = 500

/** お問い合わせメッセージの最大文字数 */
export const MAX_CONTACT_MESSAGE_LENGTH = 2000

/** お問い合わせメッセージの最小文字数 */
export const MIN_CONTACT_MESSAGE_LENGTH = 10

/** イベントタイトルの最大文字数 */
export const MAX_EVENT_TITLE_LENGTH = 100

/** 検索クエリの最大文字数 */
export const MAX_SEARCH_QUERY_LENGTH = 100

/**
 * URL スラッグの最大文字数。
 * パス経由で渡るカタログデータ（薬剤・肥料・ホルモン等）の slug 検証に使用。
 */
export const MAX_SLUG_LENGTH = 100

/**
 * 通知 ID の最大文字数（cuid は 25文字、uuid は 36文字）。
 */
export const MAX_NOTIFICATION_ID_LENGTH = 50

/**
 * PATCH /api/v1/notifications/read の ids 配列の最大件数。
 * 一括既読化は UI バッジ同期用途のため、過大なリクエストで DB をブロックしない範囲に収める。
 */
export const MAX_NOTIFICATION_READ_IDS = 100

/** 管理画面検索クエリの最小文字数 */
export const MIN_ADMIN_SEARCH_QUERY_LENGTH = 2

/** 居住地域の最大文字数 */
export const MAX_LOCATION_LENGTH = 100

/** 投稿あたりの最大ジャンル数 */
export const MAX_GENRES_PER_POST = 3

/** ジャンルカテゴリの表示順序 */
export const GENRE_CATEGORY_ORDER = ['松柏類', '雑木類', '草もの', '用品・道具', '施設・イベント', 'その他'] as const

/** コメントの最大文字数 */
export const MAX_COMMENT_LENGTH = 500

/** 1日のコメント上限数 */
export const DAILY_COMMENT_LIMIT = 100

/** メッセージの最大文字数 */
export const MAX_MESSAGE_LENGTH = 1000

/** 1日のメッセージ送信上限 */
export const DAILY_MESSAGE_LIMIT = 100

/** 評価の最小値 */
export const MIN_RATING = 1

/** 評価の最大値 */
export const MAX_RATING = 5

/** アンケート選択肢の最小数 */
export const MIN_POLL_OPTIONS = 2

/** アンケート選択肢の最大数 */
export const MAX_POLL_OPTIONS = 10

/** アンケート選択肢の最大文字数 */
export const MAX_POLL_OPTION_LENGTH = 50

/**
 * Pollオプション JSON 文字列 1 要素分のオーバーヘッド。
 * 例: 50 文字の選択肢が `"...50chars..."` + `,` のように 50 + 3 ≒ 53 に膨らむ余裕を見込んだ予約値。
 * Zod 側で JSON 文字列の長さを検証するため、実体（文字数）に対する上限の上限として使う。
 */
export const POLL_OPTION_JSON_OVERHEAD = 10

/**
 * Pollオプション JSON 文字列の配列括弧 + 余裕。
 * `[...]` 2 文字に加え、トランスポート途中の whitespace 等も吸収できる予約値。
 */
export const POLL_OPTIONS_JSON_BRACKET_OVERHEAD = 50

/**
 * Pollオプション JSON 文字列の最大長（Zod schema バリデーション用）。
 * MAX_POLL_OPTIONS × (MAX_POLL_OPTION_LENGTH + 1要素オーバーヘッド) + 配列括弧オーバーヘッド。
 *
 * 値: 10 × (50 + 10) + 50 = 650 文字。実体としての上限は
 * MAX_POLL_OPTIONS × MAX_POLL_OPTION_LENGTH = 500 文字なので、JSON シリアライズ後の
 * 自然な膨張を許容しつつ過大なペイロードは拒否できる。
 */
export const MAX_POLL_OPTIONS_JSON_LENGTH =
  MAX_POLL_OPTIONS * (MAX_POLL_OPTION_LENGTH + POLL_OPTION_JSON_OVERHEAD) +
  POLL_OPTIONS_JSON_BRACKET_OVERHEAD

/** 有効な投票期間（秒） */
export const VALID_POLL_DURATIONS = [3600, 21600, 43200, 86400, 259200, 604800] as const

/** アンケートのデフォルト投票期間（秒）: 1日 */
export const DEFAULT_POLL_DURATION_SECONDS = 86400

/** 予約投稿の最大予約日数 */
export const MAX_SCHEDULED_DAYS_AHEAD = 30

/** 予約投稿の最大件数 */
export const MAX_PENDING_SCHEDULED_POSTS = 10

/** プレミアムプラン: 投稿の最大文字数 */
export const MAX_POST_CONTENT_PREMIUM = 2000

/** プレミアムプラン: 投稿に添付可能な画像の最大枚数 */
export const MAX_POST_IMAGES_PREMIUM = 6

/** プレミアムプラン: 投稿に添付可能な動画の最大本数 */
export const MAX_POST_VIDEOS_PREMIUM = 1

/** プレミアムプラン: 1日の最大投稿数 */
export const MAX_DAILY_POSTS_PREMIUM = 40

/** 無料プラン: 1日の最大投稿数 */
export const MAX_DAILY_POSTS_FREE = 20

/** OG画像タイトルの最大文字数 */
export const OG_TITLE_MAX_LENGTH = 60

/** RSSフィードタイトルの最大文字数 */
export const RSS_TITLE_MAX_LENGTH = 50

/** 盆栽名の最大文字数 */
export const MAX_BONSAI_NAME_LENGTH = 100

/** 盆栽の樹種の最大文字数 */
export const MAX_BONSAI_SPECIES_LENGTH = 100

/** 盆栽説明文・育成記録の最大文字数 */
export const MAX_BONSAI_DESCRIPTION_LENGTH = 2000

/** 盆栽説明文のプレビュー文字数 */
export const BONSAI_DESCRIPTION_PREVIEW_LENGTH = 80

/** イベント説明文のプレビュー文字数 */
export const EVENT_DESCRIPTION_PREVIEW_LENGTH = 100

/** 管理画面: 類似イベントタイトルの切り詰め文字数 */
export const SIMILAR_EVENT_TITLE_LENGTH = 15

/** 管理画面: フィンガープリント表示文字数 */
export const FINGERPRINT_DISPLAY_LENGTH = 20

/** 予約投稿メディアプレビュー表示数 */
export const SCHEDULED_POST_MEDIA_PREVIEW_COUNT = 3

/** 下書きカードに並べるメディアサムネイルの表示数。これを超えたら `+N` 表記に切り替える。 */
export const DRAFT_CARD_MEDIA_PREVIEW_COUNT = 4

/** 盆栽開始年の最小値 */
export const BONSAI_START_MIN_YEAR = 1900

/** 1日の最大投稿アップロード制限 */
export const DAILY_UPLOAD_LIMIT = 50

/** 盆栽園情報の各フィールド最大文字数。schema 共通の保護的上限。 */
export const MAX_SHOP_NAME_LENGTH = 100
export const MAX_SHOP_ADDRESS_LENGTH = 200
export const MAX_SHOP_PHONE_LENGTH = 30
export const MAX_SHOP_URL_LENGTH = 500
export const MAX_SHOP_BUSINESS_HOURS_LENGTH = 200
export const MAX_SHOP_CLOSED_DAYS_LENGTH = 100

/** 盆栽園変更リクエストの理由フィールド最大文字数。 */
export const MAX_SHOP_CHANGE_REASON_LENGTH = 500
