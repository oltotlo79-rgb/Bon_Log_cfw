# Cloudflare Workers 移行ノート

このリポジトリ (`Bon_Log_cfw`) は [`bonnsa-sns`](https://github.com/oltotlo79-rgb/bonnsa-sns) の Cloudflare Workers 移行版です。

## 移行の進め方

詳細な移行計画は本リポジトリの [`docs/MIGRATION-PLAN.md`](MIGRATION-PLAN.md) を参照してください。
(同ファイルは bonnsa-sns/docs/plans/cloudflare-workers-migration-2026-05-17.md からコピー。bonnsa-sns 側は `.gitignore` で `/docs/plans/` を対象外にしているため push されない。)

このファイルは本リポジトリ固有の状況・差分・既知の問題を記録します。

## オリジナルとの差分管理

| 領域 | bonnsa-sns (Vercel) | Bon_Log_cfw (CFW) | 状態 |
|------|---------------------|-------------------|------|
| `lib/db.ts` | `pg.Pool` + `process.env.DATABASE_URL` | `pg.Pool` + Hyperdrive binding (globalThis 経由) | ✅ Phase 2a |
| `proxy.ts` | Next.js 16 規約 | そのまま維持 (Next.js 16 標準) | ✅ rename 不要と判断 |
| Sentry | `@sentry/nextjs` (11 ファイル) | `lib/sentry-shim.ts` no-op (本実装は後続 Phase) | ✅ Phase 2c (一時 stub) |
| 2FA AES-GCM | Node `crypto.createCipheriv` | Web Crypto `crypto.subtle` | ⏳ Phase 2d |
| Web Push | `web-push` (Node 依存) | Web Crypto ベースの fork or 自前実装 | ⏳ Phase 2e |
| Stripe webhook | `constructEvent` (sync) | `constructEventAsync` (Web Crypto) | ✅ Phase 2f |
| Cron Triggers | `vercel.json` | `wrangler.toml [triggers]` (Phase 6 で有効化) | ⏳ Phase 2g |
| seed/migration | `app/api/admin/seed*` (maxDuration=300) | Vercel 環境に残置 (CFW 非対応) | ⏳ Phase 2h |
| `next.config.ts` | `withSentryConfig` + Vercel 専用最適化 | OpenNext config | ✅ Phase 2 |
| Workers エントリ | (Vercel が自動生成) | `worker.ts` で `installCloudflareContext` を挟む | ✅ Phase 2 |
| Static assets | Vercel CDN | Workers Static Assets (`[assets]`) | ⏳ Phase 2 |
| Image optimization | Vercel `next/image` | Cloudflare Images (検討中) | ⏳ Phase 2 |

## このリポジトリで触らないもの

以下は **bonnsa-sns と完全同一** で運用します。CFW 移行で書き換える必要がありません:

- Prisma schema (`prisma/schema.prisma`)
- すべての Server Action のビジネスロジック (`lib/actions/`)
- React コンポーネント (`components/`, `app/`)
- 既存ユニットテスト (`__tests__/`)
- E2E テスト (`e2e/`)
- ドキュメント (`docs/` 配下、本ファイル以外)
- 既存の `.claude/rules/` (CLAUDE.md ガイドライン)
- 定数 (`lib/constants/`)
- Zod schemas (`lib/validations/`, 各 action 内 schemas)

## 同期戦略 (オリジナルとの cherry-pick)

bonnsa-sns で機能追加 / バグ修正があった場合、本リポジトリには **手動 cherry-pick** で取り込みます。

### 手順 (オリジナルから cherry-pick する場合)

```powershell
cd C:\Users\oltot\Documents\git-projects\Bon_Log_cfw

# 元リポジトリを upstream remote として追加 (初回のみ)
git remote add upstream https://github.com/oltotlo79-rgb/bonnsa-sns.git

# 最新の master を fetch
git fetch upstream master

# 特定 commit を cherry-pick
git cherry-pick <commit-sha>

# CFW 固有の差分でコンフリクトが起きやすいファイル:
# - lib/db.ts
# - proxy.ts (CFW 側は middleware.ts)
# - next.config.ts
# - app/api/webhooks/stripe/route.ts
# - lib/two-factor.ts
# - lib/web-push.ts
```

### cherry-pick 不要なもの

以下 commit は CFW 側に取り込まない (環境固有):
- `vercel.json` の変更
- `.github/workflows/` の Vercel 関連変更
- `next.config.ts` の Vercel 専用最適化

## 既知の制約

| 制約 | 影響 | 対策 |
|------|------|------|
| Workers CPU 30s 上限 (Paid) | 大量 batch / seed job が動かない | seed 系は Vercel 環境に残置 |
| Workers Bundle 10MB 上限 | Prisma WASM + Sharp で肥大化 | Sharp 削除 (build script 専用)、Prisma WASM は必要分のみ |
| Hyperdrive Postgres 接続 | cold start +50-100ms | キャッシュ TTL を調整 |
| 既存 2FA データの復号 | AES-256-GCM バイト形式互換 | Web Crypto で IV+CT+AuthTag 並びを再現 |
| 既存 Vercel cron job との二重実行 | check-subscriptions が両方で走る危険 | Phase 6 まで CFW 側 cron は disable |

## 開発時の注意事項

### nodejs_compat_v2 の必須化

`wrangler.toml` には以下が必須:

```toml
compatibility_date = "2024-12-01"  # 以降
compatibility_flags = ["nodejs_compat_v2"]
```

これがないと `Buffer`、`fs/promises`、`crypto` 関連で実行時エラーになります。

### Hyperdrive のローカル開発

Wrangler dev では `localConnectionString` を使用:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<production-id>"
localConnectionString = "postgresql://postgres:postgres@localhost:5432/bonsai_sns"
```

これにより本番では Hyperdrive (Cloudflare 側で接続プール) 経由、ローカルでは直接 Postgres に接続されます。

### `process.env` の扱い

Workers では `process.env` は `nodejs_compat_v2` 経由で利用可能ですが、**Worker bindings は `process.env` ではなく env arg で受け取る**点に注意:

```typescript
// Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    // env.HYPERDRIVE, env.R2_BUCKET, env.SECRETS...
  }
}
```

OpenNext のラッパーが既存の `process.env.X` 参照を env binding にブリッジしてくれますが、**Hyperdrive のような binding は明示的アクセスが必要**な場合があります。

## 当面の TODO

- [ ] Phase 0: アカウント準備 (Cloudflare / Wrangler / DNS)
- [ ] Phase 1: wrangler.toml の確定 + open-next.config.ts
- [ ] Phase 2a〜2h: コード移植
- [ ] Phase 3: ローカル動作確認
- [ ] Phase 4: staging デプロイ
- [ ] Phase 5: E2E 検証 + 1 週間ソーク
- [ ] Phase 6: 本番カットオーバー
- [ ] Phase 7: Vercel 環境停止

各 Phase の詳細手順は本リポジトリの [`docs/MIGRATION-PLAN.md`](MIGRATION-PLAN.md) を参照。
