/**
 * @module worker
 *
 * Cloudflare Workers のエントリポイント。
 * `@opennextjs/cloudflare` が build 時に `.open-next/worker.js` を生成するが、
 * Hyperdrive binding を `lib/db.ts` の同期評価パスから参照可能にするため、
 * 各 fetch / scheduled 呼び出しの直前に `installCloudflareContext()` で
 * `globalThis.__BON_LOG_HYPERDRIVE_CONNECTION_STRING__` をセットする必要がある。
 *
 * このファイルは `wrangler.toml` の `main` から参照される。
 * `import handler from '.open-next/worker.js'` で OpenNext が生成した handler を
 * ラップし、context 注入処理を挟む。
 *
 * Why this wrapper exists:
 *   OpenNext の生成 worker は env を Next.js runtime に渡すが、Prisma の Pool は
 *   モジュール評価時 (= worker fetch handler が呼ばれる前) に DATABASE_URL を必要とする。
 *   `getCloudflareContext()` は async / per-request 取得しか提供しないため、
 *   handler の最初の呼び出しで env を globalThis に焼き付けるラッパーを挟む。
 *
 * NOTE: このファイル自体は wrangler.toml の `main` を `worker.ts` に向けてビルドツール
 *  (esbuild) でバンドルする必要がある。OpenNext の `worker.js` を main にすると本ラッパーが
 *  入口にならないため、Phase 4 で wrangler.toml の `main` をこのファイルに変更する。
 *
 *  あるいは OpenNext の middleware フックで同等のことを行える場合は本ファイルは不要。
 *  詳細は docs/CFW-MIGRATION.md / OpenNext docs を参照。
 */

import { installCloudflareContext } from '@/lib/cloudflare-context'

/**
 * Workers fetch / scheduled / queue handler の type 定義 (簡易)。
 * `@cloudflare/workers-types` の `ExportedHandler` を使う方が型安全だが、
 * `.open-next/worker.js` が export する形に依存するため Phase 4 で OpenNext の
 * 実出力を見て調整する。
 */
interface OpenNextHandler {
  fetch?: (request: Request, env: unknown, ctx: unknown) => Promise<Response>
  scheduled?: (event: unknown, env: unknown, ctx: unknown) => Promise<void>
}

// Phase 4 で OpenNext が生成する handler に差し替える:
//   import openNextHandler from '../.open-next/worker.js'
// 暫定では fallback の 503 ハンドラを置く (build 通過用)。
const openNextHandler: OpenNextHandler = {
  async fetch() {
    return new Response('OpenNext worker handler not wired yet (Phase 4)', { status: 503 })
  },
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    installCloudflareContext(env as Parameters<typeof installCloudflareContext>[0])
    if (!openNextHandler.fetch) {
      return new Response('No fetch handler', { status: 500 })
    }
    return openNextHandler.fetch(request, env, ctx)
  },

  async scheduled(event: unknown, env: unknown, ctx: unknown): Promise<void> {
    installCloudflareContext(env as Parameters<typeof installCloudflareContext>[0])
    if (openNextHandler.scheduled) {
      await openNextHandler.scheduled(event, env, ctx)
    }
  },
}
