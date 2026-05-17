/**
 * @module lib/cloudflare-context
 *
 * Cloudflare Workers の env binding (`Hyperdrive` / `R2` 等) を Node 互換コード
 * (`lib/db.ts` / `lib/storage/*` 等) から参照可能にするためのブリッジ。
 *
 * Why globalThis に格納する:
 *   `getCloudflareContext()` (`@opennextjs/cloudflare`) は async / per-request 取得が前提だが、
 *   `lib/db.ts` の Prisma シングルトンは module 評価時に Pool を作る同期コードのため
 *   per-request binding に直接アクセスできない。
 *
 *   OpenNext の fetch handler は各リクエスト先頭で env を渡してくれるので、
 *   入口でこのヘルパーを呼んで globalThis に必要な値を bag のように格納する。
 *
 * 影響:
 *   - 単一 Worker isolate 内で同一 env を共有 (isolate 間は干渉しない)
 *   - PII / secret を含む値は格納しない (接続文字列のみ)
 *
 * 使用箇所:
 *   - `lib/db.ts` の `resolveConnectionString()` で参照
 *   - 将来 R2 binding を直接使う際は別 key で追加予定
 */

interface CloudflareEnv {
  HYPERDRIVE?: {
    connectionString: string
  }
  R2_BUCKET?: unknown
  [key: string]: unknown
}

/**
 * Workers fetch handler の入口で 1 度だけ呼ぶ。
 *
 * OpenNext がラップする `fetch` handler 内で実行されることを想定。
 * 通常の Node.js (next dev / vitest / CLI スクリプト) では env が undefined なので
 * 何もしない。
 */
export function installCloudflareContext(env: CloudflareEnv | undefined): void {
  if (!env) return
  if (env.HYPERDRIVE?.connectionString) {
    (globalThis as unknown as {
      __BON_LOG_HYPERDRIVE_CONNECTION_STRING__?: string
    }).__BON_LOG_HYPERDRIVE_CONNECTION_STRING__ = env.HYPERDRIVE.connectionString
  }
}

/**
 * グローバルから現在の接続文字列を読み出す (debug 用)。
 */
export function getInstalledHyperdriveConnectionString(): string | undefined {
  return (globalThis as unknown as {
    __BON_LOG_HYPERDRIVE_CONNECTION_STRING__?: string
  }).__BON_LOG_HYPERDRIVE_CONNECTION_STRING__
}
