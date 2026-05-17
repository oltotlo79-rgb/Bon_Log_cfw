/**
 * Build / build-time runtime で DB アクセスを意図的にスキップすべきかの判定。
 *
 * SKIP_DB_CONNECTION の動作モデル:
 *  - Vercel: build env と runtime env が分離可能なので、CI build にだけ env を設定する運用で問題なかった。
 *  - Cloudflare Workers: env が build / runtime 共通のため、`SKIP_DB_CONNECTION=true` を
 *    Production scope に置くと **runtime でも DB アクセスがスキップされる事故**になる。
 *
 * これを防ぐため、本ヘルパーは **build phase でのみ env を尊重** する。
 *  - `NEXT_PHASE === 'phase-production-build'` (next build 中): SKIP_DB_CONNECTION 有効
 *  - それ以外 (runtime / dev): SKIP_DB_CONNECTION の値は無視、DATABASE_URL 妥当性のみで判定
 *
 * これにより Cloudflare の Production scope に `SKIP_DB_CONNECTION=true` を入れっぱなしでも
 * runtime での DB クエリは正常実行される。
 *
 * @module lib/build/db-availability
 */

import 'server-only'

const DUMMY_DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
const NEXT_BUILD_PHASE = 'phase-production-build'

/**
 * 現在が `next build` 実行中 (build phase) かどうか。
 * Cloudflare Workers の runtime fetch handler 評価時は false になる。
 */
function isNextBuildPhase(): boolean {
  return process.env.NEXT_PHASE === NEXT_BUILD_PHASE
}

/**
 * Build 中の DB アクセスを skip すべきか。
 * `loadStaticParams` や build 経由で呼ばれる cache query から参照する。
 *
 * 判定:
 *  - `NEXT_PHASE === 'phase-production-build'` (build 中):
 *    - SKIP_DB_CONNECTION=true → skip
 *    - DATABASE_URL 未設定 or ダミー → skip
 *  - それ以外 (runtime):
 *    - DATABASE_URL 未設定 or ダミー → skip (Pool 作成失敗を避ける safety net)
 *    - SKIP_DB_CONNECTION の値は無視
 */
export function shouldSkipBuildTimeDbAccess(): boolean {
  const dbUrl = process.env.DATABASE_URL
  const dbUrlMissing = !dbUrl || dbUrl === DUMMY_DATABASE_URL

  if (isNextBuildPhase()) {
    return process.env.SKIP_DB_CONNECTION === 'true' || dbUrlMissing
  }

  // runtime: env による強制 skip は受け付けない (誤設定で全機能死亡を防ぐ)
  return dbUrlMissing
}
