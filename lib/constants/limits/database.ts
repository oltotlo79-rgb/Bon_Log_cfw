/**
 * @module lib/constants/limits/database
 *
 * Prisma / pg pool のチューニング定数。
 * Why: `lib/db.ts` に直書きしていたマジック値 (idleTimeout 30000 など) を集約し、
 * Supabase pooler 側の設定と整合させたい時に変更点を 1 箇所にまとめる。
 */

/** デフォルトのプール最大同時接続数。`DB_POOL_MAX` 環境変数で上書き可能。 */
export const DB_POOL_MAX_DEFAULT = 5

/** idle 接続を切断するまでの待機時間 (ms)。Supabase pooler のアイドルタイムアウトより短く保つ。 */
export const DB_POOL_IDLE_TIMEOUT_MS = 30_000

/** 新規接続の確立タイムアウト (ms)。リージョン跨ぎでも十分許容できる値。 */
export const DB_POOL_CONNECTION_TIMEOUT_MS = 10_000
