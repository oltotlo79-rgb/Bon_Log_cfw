/**
 * ページネーション・データ取得件数の制限値
 *
 * @module lib/constants/limits/pagination
 */

/** デフォルトのページ取得件数 */
export const DEFAULT_PAGE_LIMIT = 20

/** 管理画面ログのページ取得件数 */
export const ADMIN_LOGS_PAGE_LIMIT = 50

/** ユーザー向けセキュリティ活動（ログイン履歴）の表示件数 */
export const SECURITY_ACTIVITY_LIMIT = 20

/** おすすめユーザーの取得件数 */
export const RECOMMENDED_USERS_LIMIT = 5

/** 空フィードのオンボーディングで表示するおすすめユーザー件数 */
export const ONBOARDING_RECOMMENDED_USERS_LIMIT = 5

/** Explore ページの各セクション表示件数 */
export const EXPLORE_RECOMMENDED_USERS_LIMIT = 10
export const EXPLORE_TRENDING_GENRES_LIMIT = 10
export const EXPLORE_TRENDING_HASHTAGS_LIMIT = 10

/** トレンドジャンルの取得件数 */
export const TRENDING_GENRES_LIMIT = 5

/** RSSフィードの取得件数 */
export const RSS_FEED_LIMIT = 50

/** cronバッチサイズ */
export const CRON_BATCH_SIZE = 50

/** サイトマップ: ユーザー取得件数 */
export const SITEMAP_USERS_LIMIT = 1000

/** サイトマップ: 投稿取得件数 */
export const SITEMAP_POSTS_LIMIT = 5000

/** サイトマップ: イベント取得件数 */
export const SITEMAP_EVENTS_LIMIT = 1000

/** サイトマップ: 盆栽園取得件数 */
export const SITEMAP_SHOPS_LIMIT = 500

/** サイトマップ: 辞典用語取得件数 */
export const SITEMAP_DICTIONARY_LIMIT = 500

/** サイトマップ: 農薬製品取得件数 */
export const SITEMAP_PESTICIDES_LIMIT = 500

/** サイトマップ: 病害虫取得件数 */
export const SITEMAP_DISEASE_PESTS_LIMIT = 500

/** サイトマップ: 盆栽記録取得件数 */
export const SITEMAP_BONSAI_LIMIT = 1000

/** サイトマップ: 農薬コラム取得件数 */
export const SITEMAP_PESTICIDE_COLUMNS_LIMIT = 500

/** サイトマップ: 有効成分取得件数 */
export const SITEMAP_ACTIVE_INGREDIENTS_LIMIT = 500

/** サイトマップ: 展着剤タイプ取得件数 */
export const SITEMAP_SPREADER_TYPES_LIMIT = 100

/** サイトマップ: 肥料コラム取得件数 */
export const SITEMAP_FERTILIZER_COLUMNS_LIMIT = 500

/** サイトマップ: 栄養素取得件数 */
export const SITEMAP_FERTILIZER_NUTRIENTS_LIMIT = 100

/** サイトマップ: 樹種別施肥計画取得件数 */
export const SITEMAP_TREE_SPECIES_LIMIT = 200

/** サイトマップ: 植物ホルモン取得件数 */
export const SITEMAP_HORMONE_TYPES_LIMIT = 100

/** サイトマップ: ホルモンコラム取得件数 */
export const SITEMAP_HORMONE_COLUMNS_LIMIT = 500

/** ISR再検証: マスタデータ（辞典・農薬等）の秒数 */
export const REVALIDATE_MASTER_DATA = 3600

/** ISR再検証: 一覧ページ（イベント・盆栽園等）の秒数 */
export const REVALIDATE_LIST_PAGE = 300

/** プロフィール: 最近の投稿取得件数 */
export const PROFILE_RECENT_POSTS_LIMIT = 10

/** 管理画面: ユーザー詳細の最近の投稿 */
export const ADMIN_USER_RECENT_POSTS_LIMIT = 5

/** 管理画面: ユーザー詳細の最近の活動 */
export const ADMIN_USER_RECENT_ACTIVITY_LIMIT = 10

/** メンション候補の最大表示数 */
export const MAX_MENTION_SUGGESTIONS = 8

/** 投稿プレビューの切り捨て文字数 */
export const POST_PREVIEW_LENGTH = 150

/** 投稿プレビューの切り捨て行数（タイムライン表示用） */
export const POST_PREVIEW_MAX_LINES = 3

/** コメントプレビューの切り捨て文字数 */
export const COMMENT_PREVIEW_LENGTH = 50

/** カレンダー1日あたりのイベント表示数 */
export const CALENDAR_EVENTS_PER_DAY = 3

/** 引用リストの表示上限 */
export const QUOTE_DISPLAY_LIMIT = 10

/** 盆栽園の最大ジャンル数 */
export const MAX_SHOP_GENRES = 5

/** インメモリソート（rating）時に取得する盆栽園の最大件数 */
export const MAX_SHOPS_FOR_MEMORY_SORT = 500

/** メッセージ一覧のページ取得件数 */
export const MESSAGES_PAGE_LIMIT = 50

/** リプライのページ取得件数 */
export const REPLIES_PAGE_LIMIT = 10

/** レビューのページ取得件数 */
export const REVIEWS_PAGE_LIMIT = 10

/** イベント一覧のデフォルト取得件数 */
export const UPCOMING_EVENTS_LIMIT = 10

/** 人気タグの取得件数 */
export const POPULAR_TAGS_LIMIT = 10

/** ハッシュタグ取得のデフォルト件数（トレンド・サジェスト用） */
export const DEFAULT_HASHTAG_LIMIT = 10

/** ハッシュタグ取得件数の上限（巨大 limit 直渡しによる DB 過負荷を防ぐ） */
export const MAX_HASHTAG_LIMIT = 50

/** ハッシュタグ・サジェスト検索クエリの最大長（過大入力を防ぐ） */
export const MAX_HASHTAG_QUERY_LENGTH = 50

/** グローバル検索のカテゴリ別取得件数 */
export const GLOBAL_SEARCH_PER_CATEGORY_LIMIT = 5

/** 管理画面プレミアム検索の取得件数 */
export const ADMIN_PREMIUM_SEARCH_LIMIT = 10

/** メンション候補検索のデフォルト取得件数 */
export const MENTION_SEARCH_LIMIT = 10

/** メンション分析の対象投稿数 */
export const MENTION_ANALYSIS_LIMIT = 50

/** 「最近メンションしたユーザー」UI のデフォルト表示件数 */
export const RECENT_MENTIONED_USERS_LIMIT = 5

/** 分析: 投稿一覧取得件数 */
export const ANALYTICS_POSTS_LIMIT = 50

/** 決済履歴の取得件数 */
export const PAYMENT_HISTORY_LIMIT = 10

/** 管理画面非表示コンテンツのフォールバック件数 */
export const HIDDEN_CONTENT_FALLBACK_LIMIT = 10

/** イベント一覧の最大取得件数（unboundedクエリ防止） */
export const MAX_EVENTS_LIMIT = 500

/** 盆栽園一覧の最大取得件数（unboundedクエリ防止） */
export const MAX_SHOPS_LIMIT = 300

/** 盆栽園詳細のレビュー最大取得件数 */
export const MAX_REVIEWS_PER_SHOP = 50

/** 農薬関連一覧の最大取得件数（unboundedクエリ防止） */
export const MAX_PESTICIDE_LIST_LIMIT = 500

/**
 * フォロー・ブロック・ミュート等のリレーションID一括取得上限。
 *
 * ## なぜ上限が必要か
 * - 数十万件のリレーションを単一クエリで取得するとメモリ・転送ともに肥大化する
 * - in-memory `notIn` フィルタ用に取得するため、配列サイズが直接性能に影響する
 *
 * ## 値の根拠（50,000）
 * - 旧値 2,000 はパワーユーザー（フォロー多数）を取りこぼし、ブロック対象が
 *   フィード等にリークする潜在バグがあった
 * - 50,000 は実運用上の P99 を吸収しつつ、配列処理・転送コストの許容範囲内
 *
 * ## TODO（長期改善）
 * 真の解決は Prisma の relational filter
 * (`where: { user: { NOT: { blockedBy: { some: { blockerId: me } } } } }`)
 * へ移行し、in-memory フィルタ自体を廃すること。
 * 移行までは {@link RELATION_FETCH_WARN_THRESHOLD} で上限到達を観測する。
 */
export const MAX_RELATION_FETCH = 50000

/**
 * リレーション取得が上限に近づいたことを警告する閾値。
 * `take` の戻り値件数がこの値を超えた場合は logger.warn でアラートし、
 * 上限到達による silent truncation を可視化する。
 */
export const RELATION_FETCH_WARN_THRESHOLD = 40000

/** 盆栽一覧の最大取得件数（my-bonsai用） */
export const MAX_BONSAI_LIST_LIMIT = 200

/** メッセージ会話一覧の最大取得件数 */
export const MAX_CONVERSATIONS_LIMIT = 100

/** メンション通知対象のフォロー取得上限 */
export const MAX_MENTION_FOLLOWERS_FETCH = 5000

/** 辞書用語一覧の最大取得件数 */
export const MAX_DICTIONARY_TERMS_LIMIT = 500

/** 盆栽タイムラインの取得件数 */
export const BONSAI_TIMELINE_LIMIT = 50

/** 盆栽詳細ページの初期表示成長記録件数（古い記録は getBonsaiRecords で追加ロード） */
export const BONSAI_DETAIL_RECORDS_LIMIT = 50

/** メンション候補検索クエリの最大文字数 */
export const MAX_MENTION_SEARCH_QUERY_LENGTH = 50

/** ページネーションlimitパラメータの最大値 */
export const MAX_PAGE_LIMIT = 100

/** メタ説明文のプレビュー文字数 */
export const META_DESCRIPTION_PREVIEW_LENGTH = 120

/** UI上の説明文プレビュー文字数 */
export const DESCRIPTION_UI_PREVIEW_LENGTH = 300

/** 管理画面のID短縮表示文字数 */
export const ADMIN_ID_DISPLAY_LENGTH = 8

/** 管理画面のID表示文字数（長め） */
export const ADMIN_ID_DISPLAY_LONG_LENGTH = 12

/** コラム説明文のOGプレビュー文字数 */
export const COLUMN_OG_DESCRIPTION_LENGTH = 200
