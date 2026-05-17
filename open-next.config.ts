/**
 * @module open-next.config
 *
 * @opennextjs/cloudflare の設定ファイル。
 * Next.js 16 アプリを Cloudflare Workers 向けにビルド・パッケージングする。
 *
 * Phase 2 時点では incremental cache を OpenNext のデフォルト (in-worker memory) に任せ、
 * 追加の R2/KV binding を要求しない最小構成にする。Phase 5 以降で本番運用に必要なら
 * `@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache` 等に差し替える
 * (その場合 wrangler.toml に `NEXT_INC_CACHE_R2_BUCKET` binding が追加で必要)。
 *
 * 参考: https://opennext.js.org/cloudflare/get-started
 */

import { defineCloudflareConfig } from '@opennextjs/cloudflare'

export default defineCloudflareConfig({
  // Phase 2: 全 override をデフォルトに委ねる (binding 追加不要、最速で deploy 通す)
  // Phase 5 で本番運用前に以下を検討:
  //   - incrementalCache: r2IncrementalCache (R2 binding 必要)
  //   - tagCache: dOQueueAndTagCache (Durable Object 必要)
  //   - queue: dOQueueAndTagCache
})
