/**
 * Next.js `generateStaticParams` 用の DB ロード wrapper。
 *
 * Why:
 *   - 本番 build / CI では DB エラーを `catch { return [] }` で握りつぶすと
 *     真の設定ミスを見逃すため、failure を伝播させて build を止める。
 *   - Docker build 等で `DATABASE_URL` が未設定 / dummy のケースは
 *     静的生成を意図的にスキップしたい (実 DB 接続不要なローカル/CI 用 build)。
 *
 * 振り分けは `shouldSkipBuildTimeDbAccess()` に集約。
 *   - true → 警告ログ + 空配列
 *   - false → loader をそのまま実行し、失敗は throw して build を止める
 *
 * @module lib/build/static-params
 */

import 'server-only'

import logger from '@/lib/logger'
import { shouldSkipBuildTimeDbAccess } from '@/lib/build/db-availability'

/**
 * @deprecated Use {@link shouldSkipBuildTimeDbAccess} from `@/lib/build/db-availability`.
 * 後方互換のための旧名エイリアス。新規コードは `shouldSkipBuildTimeDbAccess` を使う。
 */
export const isStaticParamsBuildSkippable = shouldSkipBuildTimeDbAccess

/**
 * `generateStaticParams` 用の DB ロード wrapper。
 *
 * @param loader - 静的生成対象のキー配列を返す async 関数
 * @param context - ログに付ける任意のコンテキスト (例: ページパス)
 */
export async function loadStaticParams<T>(
  loader: () => Promise<T[]>,
  context?: string,
): Promise<T[]> {
  if (shouldSkipBuildTimeDbAccess()) {
    logger.warn('Skipping generateStaticParams (DB unavailable)', { context })
    return []
  }
  return loader()
}
