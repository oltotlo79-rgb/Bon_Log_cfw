/**
 * Build / build-time runtime で DB アクセスを意図的にスキップすべきかの判定。
 *
 * - `SKIP_DB_CONNECTION=true` を明示的にセット (Docker / CI でも厳格に使う)
 * - `DATABASE_URL` 未設定
 * - `DATABASE_URL` がダミー値
 *
 * いずれの場合も DB に依存する処理 (`generateStaticParams` / build 中に評価される
 * cache query 等) は空配列 / 既定値で安全に skip する。
 *
 * 通常 runtime では DB は接続可能であることが前提のため、この helper は build/SSG 用途。
 *
 * @module lib/build/db-availability
 */

import 'server-only'

const DUMMY_DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'

/**
 * Build 中の DB アクセスを skip すべきか。
 * `loadStaticParams` や build 経由で呼ばれる cache query から参照する。
 */
export function shouldSkipBuildTimeDbAccess(): boolean {
  return (
    process.env.SKIP_DB_CONNECTION === 'true'
    || !process.env.DATABASE_URL
    || process.env.DATABASE_URL === DUMMY_DATABASE_URL
  )
}
