/**
 * @module open-next.config
 *
 * @opennextjs/cloudflare の設定ファイル。
 * Next.js 16 アプリを Cloudflare Workers 向けにビルド・パッケージングする。
 *
 * Phase 1 時点では最小構成。Phase 2 以降で incremental cache / queue / tag cache を追加予定。
 *
 * 参考: https://opennext.js.org/cloudflare/get-started
 */

import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'

export default defineCloudflareConfig({
  // ISR / SSG のキャッシュを R2 に保存。
  // 本番では既存の R2 バケットを共有 (uploads と同じバケット内で path 分離) する想定。
  incrementalCache: r2IncrementalCache,

  // Tag Cache (revalidateTag 対応) は Phase 2 後半で追加検討。
  // tagCache: dOQueueAndTagCache,

  // Queue (revalidate on stale) は Phase 2 後半で追加検討。
  // queue: dOQueueAndTagCache,
})
