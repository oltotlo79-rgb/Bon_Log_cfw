/**
 * 分析関連の制限値
 *
 * @module lib/constants/limits/analytics
 */

/** 分析のデフォルト集計期間（日） */
export const DEFAULT_ANALYTICS_DAYS = 30

/**
 * 投稿 / プロフィール閲覧 beacon の dedupe TTL (秒)。
 * 同一閲覧者が短時間で再表示しても 1 view しか計上しないための間隔。
 */
export const VIEW_BEACON_DEDUPE_SECONDS = 30 * 60

/**
 * 1 投稿 / プロフィールに対する閲覧 beacon の rate limit (分間試行数)。
 * 同一閲覧者からの DoS / 連射的な記録を抑える。
 */
export const VIEW_BEACON_RATE_LIMIT_PER_MINUTE = 30

/**
 * 分析画面で許可する集計期間 (日)。リテラル順は表示順と一致する。
 */
export const ANALYTICS_PERIODS = [7, 30, 90] as const
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]

export function isAnalyticsPeriod(value: number): value is AnalyticsPeriod {
  return (ANALYTICS_PERIODS as readonly number[]).includes(value)
}

/** 分析: トップ投稿の表示件数 */
export const TOP_POSTS_LIMIT = 5

/** 分析: ジャンル別パフォーマンスの取得件数 */
export const GENRE_PERFORMANCE_LIMIT = 10

/** 分析: フォロワー推移の取得日数 */
export const FOLLOWER_GROWTH_DAYS = 90

/** 分析: トップキーワードの表示件数 */
export const TOP_KEYWORDS_LIMIT = 30

/** 分析: コンテンツプレビューの文字数 */
export const CONTENT_PREVIEW_LENGTH = 100

/** 分析: 引用プレビューの文字数 */
export const QUOTE_CONTENT_PREVIEW_LENGTH = 200

/** キーワード分析の最小文字数 */
export const MIN_KEYWORD_LENGTH = 2

/** 1週間（日数） */
export const WEEK_DAYS = 7

/**
 * コホート分析: リテンション率に応じた背景色の段階しきい値（%）。
 *
 * 値ごとに緑のグラデーションを濃くする。
 * 例: rate < 10 → bg-green-50, rate < 20 → bg-green-100, …
 *
 * しきい値以上は最も濃い色（bg-green-800）で表現する。
 */
export const RETENTION_RATE_THRESHOLDS = [10, 20, 30, 40, 50, 60, 70, 80] as const

/**
 * コホート分析: テキスト色を切り替えるしきい値（%）。
 * これ以上で白地、未満で濃い緑（背景色とのコントラスト確保）。
 */
export const RETENTION_TEXT_LIGHT_THRESHOLD = 50
