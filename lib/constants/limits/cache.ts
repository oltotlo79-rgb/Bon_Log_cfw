/**
 * キャッシュ関連の制限値
 *
 * @module lib/constants/limits/cache
 */

/** ユーザーリレーション（フォロー/ブロック/ミュート）のRedisキャッシュTTL（秒）: 5分 */
export const REDIS_RELATIONS_TTL_SECONDS = 300

/** ジャンルキャッシュの有効期間（秒） */
export const CACHE_TTL_GENRES = 3600

/** トレンドジャンルキャッシュの有効期間（秒） */
export const CACHE_TTL_TRENDING = 300

/** 人気タグキャッシュの有効期間（秒） */
export const CACHE_TTL_POPULAR_TAGS = 300

/** トレンド集計期間（時間） */
export const TRENDING_HOURS = 48

/** 人気タグ集計期間（日） */
export const POPULAR_TAGS_DAYS = 7

/** 盆栽園レビュー評価キャッシュの有効期間（秒）: 5分。レビュー集約は高コストのため。 */
export const CACHE_TTL_SHOP_RATINGS = 300

/** トレンドジャンルのデフォルト取得件数 */
export const TRENDING_GENRES_DEFAULT_LIMIT = 5

/** 人気タグのデフォルト取得件数 */
export const POPULAR_TAGS_DEFAULT_LIMIT = 10

/** ランキング系 API の最大取得件数（DoS と読み出しコスト抑制のための clamp 上限）。 */
export const TRENDING_MAX_LIMIT = 50

/** ランキング系 API の最小取得件数（0 以下を弾く clamp 下限）。 */
export const TRENDING_MIN_LIMIT = 1

/** 管理者ダッシュボード統計キャッシュの有効期間（秒）: 5分。集計が高コストのため。 */
export const ADMIN_STATS_CACHE_TTL_SECONDS = 300

/** 使用量キャッシュの再検証間隔（秒） */
export const USAGE_CACHE_REVALIDATE_SECONDS = 300

/** RSSフィードのmax-age（秒） */
export const RSS_CACHE_MAX_AGE_SECONDS = 3600

/** ゲストユーザーID取得のキャッシュ再検証間隔（秒） */
export const GUEST_USER_CACHE_REVALIDATE_SECONDS = 3600

/** お問い合わせ統計のキャッシュ再検証間隔（秒） */
export const CONTACT_STATS_CACHE_REVALIDATE_SECONDS = 60

/** 公開中お知らせのキャッシュ再検証間隔（秒） */
export const ACTIVE_ANNOUNCEMENTS_REVALIDATE_SECONDS = 60

/** ミュートユーザーID一覧のRedisキャッシュTTL（秒） */
export const MUTED_IDS_CACHE_TTL_SECONDS = 60

/** InMemoryStoreのクリーンアップ閾値 */
export const IN_MEMORY_CLEANUP_THRESHOLD = 1000

/**
 * メンテナンスモード状態の Edge Middleware 内インメモリキャッシュTTL（ミリ秒）。
 * 30秒。proxy.ts は全リクエストで実行されるため、毎回 Upstash Redis に問い合わせず
 * 短い TTL で抑制する。メンテナンス切替の即時性は要件外（最大30秒の遅延を許容）。
 */
export const MAINTENANCE_CACHE_TTL_MS = 30_000

/**
 * /api/og 動的 OG 画像の CDN キャッシュ秒数。
 *
 * title param が同じなら同じ画像が生成されるため、決定的にキャッシュ可能。
 * 1時間 fresh / 1日 stale-while-revalidate で OG クローラ・CDN 双方の負荷を抑える。
 */
export const OG_CACHE_MAX_AGE_SECONDS = 3600
export const OG_CACHE_SWR_SECONDS = 86400

/**
 * サイトマップ動的 DB クエリの unstable_cache 再検証間隔（秒）: 1時間。
 *
 * `export const dynamic = 'force-dynamic'` でルート自体は常に動的に実行されるが、
 * 内部の DB クエリをキャッシュすることで 1 リクエストごとの DB 負荷を抑える。
 */
export const SITEMAP_REVALIDATE_SECONDS = 3600
