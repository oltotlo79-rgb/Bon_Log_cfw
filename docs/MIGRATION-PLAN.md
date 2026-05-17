# Cloudflare Workers 移行プロジェクト計画 (2026-05-17)

作成日: 2026-05-17
対象: `bonnsa-sns` を Vercel から Cloudflare Workers に切り替える
方針: **既存リポジトリは無傷で残し、別プロジェクトとして並行構築 → 動作確認 → DNS 切替で本番カットオーバー**
DB・外部 API (Supabase / Upstash Redis / R2 / Resend / Stripe / Sentry / Google OAuth) は既存のものをそのまま流用

---

## ⚠️ 事前に読むべきもの

このプロジェクトは Vercel + Node.js ランタイム前提で書かれており、CFW 移行には主に以下 5 つの技術課題があります。本プランは **これらを Cloudflare Hyperdrive + nodejs_compat_v2 + OpenNext で解決する前提**で組み立てています。

| 課題 | 解決策 |
|------|--------|
| Prisma + `pg` の TCP 接続 | **Cloudflare Hyperdrive** (DB 接続プロキシ) を経由させて Workers から TCP 経由で Supabase に接続 |
| Node.js ランタイム依存 (`fs`/`Buffer`/`crypto`) | **`nodejs_compat_v2` + `compatibility_date >= 2024-09-23`** で Node API の大半をサポート |
| Next.js 16 と Vercel の密結合 | **`@opennextjs/cloudflare`** アダプタで Workers 向けに変換 |
| `@sentry/nextjs` の Node SDK 依存 | **`@sentry/cloudflare`** に置換 (Workers ネイティブ) |
| Vercel Cron / `maxDuration=300` の seed バッチ | **`wrangler.toml` の `[triggers]`** に移植。長時間ジョブは **Cloudflare Workflows** または既存 Vercel 環境を seed 専用に残置 |

> **重要な現実確認**: 既存 15,195 ユニットテストと 60 E2E spec は **Vercel/Node 前提で書かれている**。CFW での挙動差は本番運用前にステージングで実地検証する必要があります。

---

## 全体タイムライン (推定)

| Phase | 内容 | 推定工数 | あなたの作業時間 |
|-------|------|---------|-----------------|
| 0 | 意思決定・アカウント準備 | 1 日 | 2〜3 時間 |
| 1 | 新規プロジェクト雛形作成 | 2 日 | 3〜4 時間 |
| 2 | コード移植 (Phase 2a〜2g) | 10〜15 日 | 5〜10 時間 |
| 3 | ローカル動作確認 | 3 日 | 4〜6 時間 |
| 4 | CFW Preview デプロイ | 2 日 | 3〜5 時間 |
| 5 | ステージング環境構築 & E2E | 5 日 | 5〜10 時間 |
| 6 | 本番カットオーバー (DNS 切替) | 1 日 | 2〜3 時間 |
| 7 | Vercel 環境の停止・後片付け | 2 日 | 2 時間 |
| **合計** | | **26〜31 日** | **26〜43 時間** |

---

## アーキテクチャ図

```
                       ┌─────────────────────────────────────────┐
                       │  ユーザー (ブラウザ)                     │
                       └────────────────┬────────────────────────┘
                                        │ HTTPS
                                        ↓
              ┌─────────────────────────────────────────┐
              │  Cloudflare DNS (Proxied)               │
              │  bon-log.com → Workers Route            │
              └────────────────┬────────────────────────┘
                               ↓
              ┌─────────────────────────────────────────┐
              │  Cloudflare Workers (Edge)              │
              │  ├─ @opennextjs/cloudflare runtime     │
              │  ├─ Next.js 16 (App Router)            │
              │  ├─ React Server Components            │
              │  ├─ Server Actions                     │
              │  └─ Static Assets (Workers Static Assets) │
              └────┬────────────────┬──────────────────┘
                   │                │
       ┌───────────┘                └───────────────────┐
       ↓                                                 ↓
┌─────────────────┐                          ┌────────────────────┐
│ Hyperdrive      │                          │ KV / R2 Bindings  │
│ (DB connection  │                          │ (R2 = 直接 bind可) │
│  pooler)        │                          └────────────────────┘
└────────┬────────┘
         ↓                                    既存サービス (現状のまま)
┌─────────────────┐                          ┌─────────────────────┐
│ Supabase        │                          │ Upstash Redis (REST)│
│ PostgreSQL      │                          │ Resend / Stripe    │
└─────────────────┘                          │ Sentry / Google OAuth│
                                             └─────────────────────┘
```

---

## Phase 0: 意思決定・アカウント準備

### 0.1 私（実装担当）が決めること

以下を **このプラン承認時に明示**してください:

1. **新規プロジェクト名**: 例 `bonnsa-sns-cfw` / `bon-log-edge` / `bon-log-workers`
2. **新規リポジトリ戦略**:
   - Option A: **別 Git リポジトリ** (`git clone` ベース、独立履歴) ← **推奨**
   - Option B: 既存リポジトリの新規ブランチ (履歴共有、衝突リスク)
3. **検証用ステージングドメイン**: 例 `staging.bon-log.com` / `cfw.bon-log.com` (Cloudflare に NS 委譲済みドメインのサブドメイン)
4. **DB 戦略**:
   - Option A: **Supabase をそのまま Hyperdrive で接続** ← **推奨** (DB 移行ゼロ)
   - Option B: Neon に移行して `@prisma/adapter-neon` 利用 (DB データ移行が必要)
5. **本番切替方式**:
   - Option A: **DNS の段階的カットオーバー** (Cloudflare Load Balancer で重み付けトラフィック分割) ← **推奨**
   - Option B: 一発切替 (低トラフィック時間帯にプロキシ ON)

### 0.2 あなた（オーナー）が行う事前準備

#### ① Cloudflare アカウント

- [ ] **Cloudflare アカウント作成** (もしなければ): https://dash.cloudflare.com/sign-up
- [ ] **Workers Paid プラン契約 (月 $5)**:
  - 理由: Free プランは CPU 10ms 制限で `bcryptjs` ログインがタイムアウトする (実測 100-300ms)
  - 場所: Cloudflare Dashboard → Workers & Pages → Plans → Workers Paid ($5/月)
- [ ] **Wrangler CLI のインストール** (ローカル):
  ```powershell
  npm install -g wrangler
  wrangler --version  # 3.80+ を推奨
  wrangler login      # ブラウザで認証
  ```
- [ ] **本番ドメインを Cloudflare DNS に委譲済みか確認**:
  - Dashboard → Websites → `bon-log.com` を選択
  - 「Active」と表示されているか
  - **委譲してない場合**: ドメインレジストラで NS レコードを Cloudflare 提示の 2 つに変更 (反映まで最大 48h)

#### ② Supabase 側の確認

- [ ] **Direct Connection 用の認証情報を取得**:
  - Supabase Dashboard → Settings → Database → **Connection string** → **URI** タブ
  - `postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres` 形式 (Port **5432** の direct、6543 の PgBouncer ではない)
  - Hyperdrive は内部でプールするため direct 接続を使用
- [ ] **DB のリージョンを確認**: Tokyo (ap-northeast-1) のはず
- [ ] **CA 証明書のダウンロード**:
  - Supabase Dashboard → Settings → Database → SSL configuration → `prod-ca-2021.crt` をダウンロード
  - 既存 `SUPABASE_CA_CERT` で使用済みなのでそれを再利用可

#### ③ Cloudflare R2 (既に使用中)

- [ ] 既存の R2 バケット (`R2_BUCKET_NAME` で指定) はそのまま使えます
- [ ] **Worker からの直接 binding に切り替えるなら** R2 API トークンは不要になる (バインディング経由でゼロコストアクセス)。後で検討。

#### ④ その他外部サービス側でやっておくこと

- [ ] **Stripe Webhook の設定確認**: 現在のエンドポイント URL (Vercel の `/api/webhooks/stripe`) は Phase 5 でステージング側に追加し、Phase 6 で本番側のみに残します。**両方への重複送信は冪等性で吸収されますが、Phase 5 では検証用に追加してください**
- [ ] **Google OAuth リダイレクト URI**: `https://staging.bon-log.com/api/auth/callback/google` を Google Cloud Console に追加 (Phase 4 で必要)

---

## Phase 1: 新規プロジェクト雛形作成

### 1.1 リポジトリの初期化

```powershell
# 既存リポジトリの隣に新規ディレクトリを作る
cd C:\Users\oltot\Documents\git-projects
mkdir bonnsa-sns-cfw
cd bonnsa-sns-cfw

# 既存リポジトリを clone (推奨: --depth 1 で履歴を切り離す)
git clone --depth 1 https://github.com/<your-org>/bonnsa-sns.git .
rm -rf .git
git init
git add .
git commit -m "chore: 既存リポジトリからの初期化 (Vercel 版 commit 4f24d485 起点)"
```

> **重要**: 履歴を切り離すのは、既存リポジトリと並行開発する間に意図せぬ cross-merge を防ぐためです。

### 1.2 OpenNext for Cloudflare の導入

```powershell
# Cloudflare 用アダプタ追加
npm install --save-dev @opennextjs/cloudflare wrangler @cloudflare/workers-types
npm install @prisma/adapter-pg pg  # 既に入っているが念のため
```

### 1.3 `wrangler.toml` の作成

プロジェクトルートに以下を作成 (**あなたは値を埋めるだけ、生成は実装担当が行います**):

```toml
name = "bon-log-cfw"  # Worker 名 (実装担当が決定)
main = ".open-next/worker.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat_v2"]

# Static Assets (画像・CSS・JS など)
[assets]
directory = ".open-next/assets"
binding = "ASSETS"

# Hyperdrive (Supabase Postgres 接続)
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<Phase 2 で作成する Hyperdrive の ID>"
localConnectionString = "postgresql://postgres:postgres@localhost:5432/bonsai_sns"  # ローカル開発用

# R2 binding (画像ストレージ)
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "<既存の R2_BUCKET_NAME と同じ>"

# Cron Triggers (Vercel Cron の代替)
[triggers]
crons = [
  "*/5 * * * *",   # publish-scheduled
  "0 1 * * *",     # check-subscriptions
  "0 0 1 * *",     # cleanup-events
]

# 本番環境
[env.production]
name = "bon-log-cfw-prod"
route = { pattern = "bon-log.com/*", zone_name = "bon-log.com" }
# ↑ ただし Phase 6 まではこの route はコメントアウトしておくこと

# ステージング環境
[env.staging]
name = "bon-log-cfw-staging"
route = { pattern = "staging.bon-log.com/*", zone_name = "bon-log.com" }
```

### 1.4 `open-next.config.ts` の作成

```typescript
// open-next.config.ts (プロジェクトルート)
import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import cache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'

export default defineCloudflareConfig({
  incrementalCache: cache,  // ISR/SSG キャッシュを R2 に保存
})
```

### 1.5 `package.json` の scripts 修正

実装担当が以下を追加します:

```json
{
  "scripts": {
    "preview:cf": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy:cf:staging": "opennextjs-cloudflare build && wrangler deploy --env staging",
    "deploy:cf:production": "opennextjs-cloudflare build && wrangler deploy --env production",
    "wrangler:tail:staging": "wrangler tail --env staging",
    "wrangler:tail:production": "wrangler tail --env production"
  }
}
```

---

## Phase 2: コード移植

> 以下の Phase 2a〜2g は **実装担当 (Claude/エンジニア) が新規プロジェクト内で行う作業**です。あなたは進捗確認のみで OK。

### 2a. `lib/db.ts` を Hyperdrive 対応に書き換え

`pg` の `Pool` は維持しつつ、`connectionString` を `env.HYPERDRIVE.connectionString` から取るようにします。Workers の env binding にアクセスするため、リクエストコンテキストから取得するヘルパーを追加。

### 2b. `proxy.ts` → `middleware.ts` への移植

OpenNext は Next.js の `middleware.ts` 規約をサポート (`proxy.ts` は Next.js 16 独自規約)。

- `proxy.ts` を `middleware.ts` にリネーム
- `export default auth((req) => {...})` の中身はそのまま動作
- `@sentry/nextjs` の import を `@sentry/cloudflare` に置換

### 2c. `@sentry/nextjs` → `@sentry/cloudflare` への置換

該当ファイル (調査済み):
- `next.config.ts` (`withSentryConfig` を削除)
- `sentry.server.config.ts` (削除)
- `sentry.edge.config.ts` (削除)
- `instrumentation.ts` (Workers の `fetch` handler から `Sentry.init` する形に変更)
- `proxy.ts` → `middleware.ts` の `Sentry.captureMessage`
- `app/global-error.tsx` / `components/common/PageError.tsx` (Sentry SDK 呼び出し)
- `lib/logger.ts` / `lib/client-logger.ts`

### 2d. AES-256-GCM 暗号化を Web Crypto に書き換え

`lib/two-factor.ts` (`encryptSecret` / `decryptSecret`) を **`crypto.subtle.encrypt({ name: 'AES-GCM' }, ...)`** に書換。
**ただし**、既存 DB に格納済みの 2FA シークレットは Node `crypto` の AES-256-GCM 形式で暗号化されているため、**バイト形式は互換** (IV + ciphertext + authTag 同じ並び)。デコード側で同じ並びを Web Crypto で復号できるようにすれば移行可能。

該当ファイル:
- `lib/two-factor.ts`
- `__tests__/lib/two-factor*` (テスト書き直し)

### 2e. `web-push` の Web Crypto 対応 fork に置換

`lib/web-push.ts` の `webPush.sendNotification` は Node `crypto` 依存。
代替: **`@block65/webcrypto-web-push`** または手書き実装 (`P-256` 鍵で ECDH + AES-128-GCM)。

### 2f. Stripe webhook async 検証に書換

`app/api/webhooks/stripe/route.ts:75` の同期版 `stripe.webhooks.constructEvent` を **`constructEventAsync`** に置換 (Web Crypto 経由)。

### 2g. Vercel Cron → Cloudflare Cron Triggers への移植

`wrangler.toml` に `[triggers] crons = [...]` を定義 (上記 1.3 で記述済み)。
**ハンドラ側**: Worker は `scheduled(event, env, ctx)` ハンドラで cron を受ける。OpenNext がこれを `/api/cron/*` ルートに転送する仕組みを追加実装。

### 2h. `maxDuration=300` の seed/migration ジョブの扱い

**選択肢**:
- **A. 残置案 (推奨)**: `app/api/admin/seed*` と `app/api/admin/apply-migration` だけは **Vercel 環境を残してそちらで実行**。CFW 本体には含めない (`app/api/admin/` を除外する vendor ビルドルールを追加)。
- **B. Workflows 移行**: Cloudflare Workflows で長時間ジョブを再実装 (実装コスト大)。

### 2i. `lib/storage/local-provider.ts` の扱い

開発用なので残すが、CFW では `fs` が使えないため `STORAGE_PROVIDER=local` は **CFW 環境では使用不可** (production では r2 を強制)。コード自体は残しておいて環境変数で分岐。

### 2j. テスト戦略

- ユニットテスト (15,195 件): Vitest はそのまま動く (Node 環境)。CFW 本番挙動とは別物として扱う。
- E2E (Playwright 60 spec): **staging.bon-log.com** に対して実行できるよう `playwright.config.ts` の `baseURL` を環境変数化。

---

## Phase 3: ローカル動作確認

### 3.1 あなたが行う作業

```powershell
cd C:\Users\oltot\Documents\git-projects\bonnsa-sns-cfw

# 環境変数の準備
cp .env.local.example .env.local
# .env.local を編集: 既存 Vercel 環境のものをそのままコピーで OK
# (DATABASE_URL, NEXTAUTH_*, STRIPE_*, RESEND_API_KEY, UPSTASH_*, R2_*, SENTRY_*)

# 開発実行
npm install
npm run dev
# → http://localhost:3000 で動くか確認 (Next.js 標準の dev サーバー)

# OpenNext での Worker エミュレーション
npm run preview:cf
# → Wrangler の miniflare 経由で http://localhost:8787 で動くか確認
# こちらが「本番 CFW に近い挙動」になる
```

### 3.2 確認すべきポイント

| チェック項目 | 期待値 | NG だった時 |
|-------------|-------|------------|
| `npm run dev` でログイン可能 | Vercel 版と同じ動作 | NextAuth / Prisma の import パスを確認 |
| `npm run preview:cf` でログイン可能 | bcrypt 比較で 200ms 程度 | nodejs_compat_v2 が効いているか確認 |
| 投稿一覧が表示される | Server Component で Prisma クエリ動作 | Hyperdrive ローカル設定確認 |
| 画像アップロード成功 | R2 への presigned PUT | `s3-sign.ts` の crypto 互換性確認 |
| 2FA セットアップ動作 | QR コード生成 + TOTP 検証 | `two-factor.ts` の Web Crypto 移行確認 |
| Stripe webhook (Stripe CLI で疑似配信) | 200 OK + DB 反映 | `constructEventAsync` 動作確認 |

---

## Phase 4: CFW Preview デプロイ

### 4.1 あなたが行う作業

#### ① Hyperdrive の作成

```powershell
# Wrangler 経由で Hyperdrive を作成
wrangler hyperdrive create bon-log-hyperdrive `
  --connection-string="postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# 出力される ID を控える (wrangler.toml の hyperdrive.id に貼る)
# 例: id = "abc123def456..."
```

`wrangler.toml` の `[[hyperdrive]] id` を実値に更新。

#### ② Secrets の登録

Cloudflare はセキュアな環境変数を `wrangler secret` で別管理します:

```powershell
cd C:\Users\oltot\Documents\git-projects\bonnsa-sns-cfw

# 以下を staging / production の両方に対して実行 (--env で指定)
wrangler secret put NEXTAUTH_SECRET --env staging
# → プロンプトで値を貼り付け (Vercel 環境のものをそのまま使う)

wrangler secret put DATABASE_URL --env staging
wrangler secret put DIRECT_URL --env staging
wrangler secret put SUPABASE_CA_CERT --env staging
wrangler secret put NEXTAUTH_URL --env staging  # https://staging.bon-log.com
wrangler secret put GOOGLE_CLIENT_ID --env staging
wrangler secret put GOOGLE_CLIENT_SECRET --env staging
wrangler secret put STRIPE_SECRET_KEY --env staging
wrangler secret put STRIPE_WEBHOOK_SECRET --env staging
wrangler secret put STRIPE_PRICE_ID_MONTHLY --env staging
wrangler secret put STRIPE_PRICE_ID_YEARLY --env staging
wrangler secret put RESEND_API_KEY --env staging
wrangler secret put EMAIL_FROM --env staging
wrangler secret put UPSTASH_REDIS_REST_URL --env staging
wrangler secret put UPSTASH_REDIS_REST_TOKEN --env staging
wrangler secret put R2_ACCOUNT_ID --env staging
wrangler secret put R2_ACCESS_KEY_ID --env staging
wrangler secret put R2_SECRET_ACCESS_KEY --env staging
wrangler secret put R2_BUCKET_NAME --env staging
wrangler secret put R2_PUBLIC_URL --env staging
wrangler secret put SENTRY_DSN --env staging
wrangler secret put NEXT_PUBLIC_SENTRY_DSN --env staging
wrangler secret put SENTRY_AUTH_TOKEN --env staging
wrangler secret put TWO_FACTOR_ENCRYPTION_KEY --env staging
wrangler secret put VAPID_PRIVATE_KEY --env staging
wrangler secret put NEXT_PUBLIC_VAPID_PUBLIC_KEY --env staging
wrangler secret put VAPID_SUBJECT --env staging
wrangler secret put CRON_SECRET --env staging
wrangler secret put NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY --env staging
wrangler secret put NEXT_PUBLIC_APP_URL --env staging  # https://staging.bon-log.com
wrangler secret put SEED_PESTICIDE_SECRET --env staging  # 残置する場合は不要
```

> **コツ**: 同じ Vercel プロジェクトから一括取得するなら `vercel env pull .env.staging` でファイル化 → スクリプトでループ登録すると速い。

#### ③ DNS レコードの作成 (ステージング用)

Cloudflare Dashboard:
- Websites → bon-log.com → DNS → Records
- **Add record**:
  - Type: `AAAA`
  - Name: `staging`
  - Content: `100::` (Workers は擬似 IPv6 を使う特殊な仕様)
  - Proxy status: **Proxied (オレンジ雲)**
  - TTL: Auto

#### ④ 初回デプロイ

実装担当が以下を実行:

```powershell
npm run deploy:cf:staging
```

#### ⑤ 動作確認

ブラウザで `https://staging.bon-log.com` を開いてアクセス:

- [ ] トップページ表示
- [ ] ログイン (既存アカウントで)
- [ ] タイムライン表示
- [ ] 投稿作成 (テキストのみ)
- [ ] 投稿作成 (画像 1 枚)
- [ ] コメント
- [ ] いいね
- [ ] フォロー
- [ ] 通知
- [ ] メッセージ送信
- [ ] 盆栽記録作成
- [ ] 検索 (タイムライン / ユーザー)
- [ ] 2FA セットアップ → 検証
- [ ] パスワードリセット (メール受信確認)
- [ ] Stripe 月額契約 (テストモード)
- [ ] 管理者ダッシュボード (admin 権限で)

### 4.2 トラブルシューティング

| 症状 | 対処 |
|------|-----|
| `Error: failed to fetch query_compiler_bg.wasm` | Prisma の wasm が bundle に入っていない → `wrangler.toml` の `[build] command` で wasm をコピーする処理を追加 |
| `connect ECONNREFUSED` (Hyperdrive 経由) | Hyperdrive ID 誤り or Supabase 接続文字列の password 誤り → `wrangler hyperdrive list` で確認 |
| CPU 制限到達 (`Worker exceeded CPU limit`) | bcrypt が遅い → cost を 11 まで下げる (現在 12) or 別の hash 関数に変更 |
| `crypto.createCipheriv is not a function` | nodejs_compat_v2 が効いていない → `compatibility_date >= 2024-09-23` 確認 |
| `Error: bindings has no key R2_BUCKET` | `wrangler.toml` の binding 名と `process.env` の参照名が不一致 |
| Server Action で 500 | CFW logs (`wrangler tail --env staging`) で詳細確認 |

---

## Phase 5: ステージング環境での E2E 検証

### 5.1 あなたが行う作業

#### ① E2E テスト用ユーザーの準備

既存 E2E は `npm run e2e:delete-test-users` でクリーンアップする規約。staging DB は本番と同じなので、テスト用 prefix (`e2e-test-*@example.com`) のユーザーを使うこと。

#### ② Playwright を staging に向ける

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://staging.bon-log.com"
npm run test:e2e
```

#### ③ 並行運用での確認項目

- [ ] **Vercel 版と staging で同一データを表示することを確認**
   - 同じ投稿 ID を `https://bon-log.com/posts/<id>` と `https://staging.bon-log.com/posts/<id>` で開く
- [ ] **書き込みが両方で反映されることを確認**
   - staging で投稿作成 → Vercel 版でリロード → 表示される
- [ ] **Stripe webhook の重複処理問題なし**:
   - 既存 Vercel に届く webhook はそのまま処理される
   - Phase 5 では staging には webhook を**追加配信しない** (Phase 6 で切替)
- [ ] **Sentry に staging のエラーがちゃんと届くか**
- [ ] **Lighthouse / Core Web Vitals の比較**:
   - `npx lighthouse https://bon-log.com --view`
   - `npx lighthouse https://staging.bon-log.com --view`
   - Performance スコアが Vercel 比 ±10 以内ならOK

### 5.2 負荷テスト (推奨)

```powershell
# 簡易負荷テスト (k6 や Artillery)
npx artillery quick --count 10 --num 50 https://staging.bon-log.com/feed
```

CFW は Workers Paid プランで CPU 30 秒、リクエスト数は実質無制限ですが、**Hyperdrive 経由の Supabase 接続数**には注意してください。Supabase Free プランは 60 接続上限です。

### 5.3 1 週間のソーク観察

ステージングで **1 週間程度ソーク (放置観察)** することを強く推奨。発見しがちな問題:
- 24h 超のキャッシュ無効化タイミング
- Cron Triggers の実行漏れ
- メモリリーク (Workers は 128MB 上限)
- Hyperdrive の cold start レイテンシ

---

## Phase 6: 本番カットオーバー

### 6.1 事前準備 (D-1)

- [ ] **メンテナンスお知らせ**: 本番アプリ (`/admin/announcements`) で「20XX 年 X 月 X 日 X:XX〜X:XX サーバーメンテナンス」を表示
- [ ] **DB バックアップ**: Supabase Dashboard → Database → Backups → On-demand backup
- [ ] **本番用 Worker secrets 登録**:
  - 上記 Phase 4.1 ② のコマンドを `--env production` で再実行
  - `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` は `https://bon-log.com` に
- [ ] **Stripe webhook の本番側追加**:
  - Stripe Dashboard → Developers → Webhooks → Add endpoint
  - URL: `https://bon-log.com/api/webhooks/stripe` (まだ Vercel に向いている)
  - これは Phase 6 で「両方」設定状態にして冗長化する手順
- [ ] **Google OAuth リダイレクト URI 確認**: `https://bon-log.com/api/auth/callback/google` (既存と同じ)

### 6.2 カットオーバー手順 (D-Day)

#### Step 1: 本番 Worker を deploy (まだトラフィックは流れない)

```powershell
cd C:\Users\oltot\Documents\git-projects\bonnsa-sns-cfw
npm run deploy:cf:production
```

この時点では `wrangler.toml` の `[env.production].route` を **コメントアウトしておく**。Worker は登録されるが trafifc は無し。

#### Step 2: ヘルスチェック

```powershell
# Worker の direct URL でアクセスできることを確認
curl https://bon-log-cfw-prod.<your-account>.workers.dev/api/health
# → 200 OK が返ること
```

#### Step 3: DNS の段階的切替 (推奨)

**A. 重み付きトラフィック分割 (Cloudflare Load Balancer)** 〜 余力があれば:

Cloudflare Dashboard → Traffic → Load Balancing → Pool を 2 つ作成:
- Pool 1: Vercel (weight 90 → 50 → 10 → 0)
- Pool 2: CFW Worker (weight 10 → 50 → 90 → 100)

1時間〜数日かけて段階的に CFW 側の比重を上げる。

**B. 一発切替** 〜 シンプル運用:

`wrangler.toml` の `[env.production].route` のコメントを外し、再デプロイ:

```powershell
# wrangler.toml 編集
# route = { pattern = "bon-log.com/*", zone_name = "bon-log.com" }
# のコメントアウトを外す

npm run deploy:cf:production
```

直後から `bon-log.com` への全リクエストは CFW Worker が受け始めます。Vercel に元々向いていた DNS レコードは **Cloudflare Proxy のルーティングルールで上書きされる**ため、削除する必要はありません (戻し用に残しておく方が安全)。

#### Step 4: 動作確認 (5〜10 分)

- [ ] トップページが Cloudflare Worker から配信されているか
  ```powershell
  curl -I https://bon-log.com/
  # → cf-ray ヘッダーがあれば Cloudflare 経由
  # → server: cloudflare が出ているか
  ```
- [ ] ログイン → タイムライン → 投稿 → コメント の golden path
- [ ] Stripe webhook が届くか (Stripe Dashboard → Webhooks → Send test webhook で確認)

#### Step 5: 異常時のロールバック

切替後 1 時間以内に問題があれば即ロールバック:

```powershell
# wrangler.toml の route をコメントアウトして再デプロイ
# → DNS は元の Vercel に戻る
npm run deploy:cf:production
```

または Cloudflare Dashboard → DNS → bon-log.com の A レコードを Vercel の Origin に向ける。

---

## Phase 7: Vercel 環境の停止・後片付け

### 7.1 観察期間 (1〜2 週間)

切替後 **1〜2 週間は Vercel 環境を停止せず維持**。緊急ロールバックの保険。

### 7.2 旧 Vercel 環境の停止

問題なく安定運用できたら:

1. **Stripe webhook の Vercel URL を停止** (Stripe Dashboard で disable)
2. **Vercel Cron を停止** (CFW の Cron Triggers と二重実行になっているはず): Vercel Dashboard → Settings → Cron Jobs で disable
3. **Vercel プロジェクトを Pause** (まだ削除しない): Vercel Dashboard → Settings → General → Pause
4. **3 ヶ月後に削除** (バックアップとして残しておく価値あり)

### 7.3 既存リポジトリ (`bonnsa-sns`) の扱い

- Option A: **アーカイブ化** (Read-only にして残す): GitHub repo settings → Archive this repository
- Option B: **新プロジェクト `bonnsa-sns-cfw` を `bonnsa-sns` にリネーム** (履歴は別物として、旧 repo は別名にリネームしてアーカイブ): 推奨される運用

---

## リスク・既知の制約マトリクス

| 項目 | リスク | 対策 |
|------|--------|------|
| Hyperdrive レイテンシ | 初回接続で 50-100ms 追加 | Hyperdrive の region (ap-northeast-1) を Supabase と合わせる |
| Workers の CPU 30 秒制限 | Stripe 一括 webhook 処理が timeout | `app/api/cron/check-subscriptions` のバッチサイズを小さく |
| 256 MB バンドルサイズ制限 | Next.js + Prisma で肥大化 | `optimizePackageImports` と outputFileTracingExcludes を活用 |
| `bcryptjs` 速度 | ログインで 200-500ms | salt rounds を 12→11 に下げ検討 (セキュリティは要評価) |
| Stripe webhook 同期処理 | `constructEvent` の sync 版が使えない | `constructEventAsync` への置換が必須 (Phase 2f) |
| 既存 2FA データ復号 | AES-256-GCM 形式の互換性 | Web Crypto で同じ並びの IV/AuthTag を扱う実装にする |
| Cron `maxDuration=300` | seed/migration が CFW で動かない | Vercel に seed 専用環境を残す or Workflows へ |
| OpenNext の成熟度 | 未対応 Next.js 16 機能の可能性 | 最新版を使用し issue tracker をウォッチ |
| pg_trgm / pg_bigm | Supabase に既存設定があれば問題なし | DB 移行しない前提なら影響なし |
| Sentry の Vercel deep integration | Source map upload が変わる | `@sentry/cloudflare-wrangler-plugin` 利用 |

---

## あなたの作業チェックリスト (全 Phase 通し)

### 事前準備

- [ ] このプランを読み、Phase 0.1 の意思決定 6 項目を回答
- [ ] Cloudflare アカウント作成 + Workers Paid 契約 ($5/月)
- [ ] Wrangler CLI インストール + `wrangler login`
- [ ] Cloudflare DNS にドメインが「Active」表示されている確認
- [ ] Supabase の direct connection 文字列を取得
- [ ] Google OAuth コンソールでステージングドメインの追加 (Phase 4 までに)
- [ ] Stripe webhook URL の本番 + ステージング 2 つの設定準備

### Phase 1〜2 (実装担当主導、進捗確認のみ)

- [ ] 新規プロジェクトディレクトリの存在確認 (`bonnsa-sns-cfw`)
- [ ] `wrangler.toml`, `open-next.config.ts`, `package.json` scripts の追加確認

### Phase 3 (ローカル動作確認)

- [ ] `.env.local` を作成 (既存 Vercel の値をコピー)
- [ ] `npm install` → エラーなし
- [ ] `npm run dev` → http://localhost:3000 でログイン可能
- [ ] `npm run preview:cf` → http://localhost:8787 でログイン可能
- [ ] 主要機能 6 項目の動作確認

### Phase 4 (Staging デプロイ)

- [ ] `wrangler hyperdrive create` で Hyperdrive 作成 → ID を `wrangler.toml` に反映
- [ ] `wrangler secret put` で staging に 25+ 個の secret を登録
- [ ] Cloudflare DNS に `staging` AAAA レコード追加 (Proxied)
- [ ] `npm run deploy:cf:staging` 成功
- [ ] `https://staging.bon-log.com` で Phase 4.1 ⑤ の 17 項目すべて動作

### Phase 5 (Staging 検証)

- [ ] Playwright E2E を staging に対して実行 → 60 spec 通る
- [ ] Vercel 本番と staging で同一データを参照できる
- [ ] Sentry に staging のエラーが届く
- [ ] Lighthouse スコアが Vercel 比 ±10 以内
- [ ] **1 週間ソーク**観察 → メモリリーク・Cron 漏れなし

### Phase 6 (本番カットオーバー)

- [ ] D-1: メンテナンス告知をアプリ内に表示
- [ ] D-1: Supabase で on-demand backup 実行
- [ ] D-1: production 用 secret を `--env production` で全部登録
- [ ] D-Day: `npm run deploy:cf:production` (route コメントアウトのまま)
- [ ] D-Day: `https://bon-log-cfw-prod.<account>.workers.dev` で動作確認
- [ ] D-Day: `wrangler.toml` の `[env.production].route` をコメントアウト解除 + 再 deploy
- [ ] D-Day +5 分: `curl -I https://bon-log.com/` で `server: cloudflare` 確認
- [ ] D-Day +10 分: ログイン→投稿→Stripe webhook の golden path 確認

### Phase 7 (片付け)

- [ ] +1 週間: Vercel 環境を Pause
- [ ] +1 ヶ月: 旧リポジトリをアーカイブ化
- [ ] +3 ヶ月: Vercel プロジェクトを削除

---

## 失敗時のロールバック手順 (Phase 6 以降)

### ケース 1: デプロイ直後に異常発生 (5〜10 分以内に検知)

```powershell
# wrangler.toml の [env.production].route を再びコメントアウト
npm run deploy:cf:production
# → DNS は Vercel に戻る (CF Proxy の Workers ルーティングが無効化される)
```

### ケース 2: 数時間運用後に異常発生 (DB 整合性問題等)

1. **書き込み停止のためメンテナンスモードを有効化**:
   - Redis に直接 `SET maintenance_mode_enabled true` (Upstash REST API でも可)
   - 全ユーザーが `/maintenance` にリダイレクトされる (既存 `proxy.ts` ロジック)
2. ロールバック手順 (ケース 1 と同じ) を実施
3. Vercel 側で動作確認
4. Redis の `maintenance_mode_enabled` を `false` に戻す

### ケース 3: 数日後に異常発生 (DB スキーマ変更後など)

ロールバックは難しくなる可能性あり。**マイグレーション戦略**:
- DB スキーマ変更は **両環境で動く形** (旧カラムを残す → 新カラム追加 → 旧カラム削除を別リリース) を採る
- カットオーバー後 2 週間はスキーマ変更しない

---

## コスト見積もり (Cloudflare 側)

| サービス | プラン | 月額 |
|---------|-------|------|
| Workers Paid | 必須 | $5 |
| Workers Requests | 10M 含む、超過は $0.50/1M | 想定 5M req/月 → $0 |
| Workers CPU | 30M ms 含む、超過は $0.02/1M ms | 想定 50M ms/月 → $0.40 |
| Hyperdrive | Free (現時点) | $0 |
| KV Storage | 100K read 含む、$0.50/1M | 想定 50K → $0 |
| R2 (既存) | 10GB Free | $0 (既存従量課金は変わらず) |
| **合計** | | **約 $5.40/月** |

参考: Vercel Pro プランは **$20/月** (1 ユーザー)。Cloudflare 移行で **約 75% コスト削減**。

> ただしこれは「動く」前提のコスト試算で、移行工数 (人件費換算 50〜100 万円相当) を含めると初年度はトントン以上。長期運用で見ると確実に CF 側が安い。

---

## このプランの承認後にあなたが私に伝えること

以下を回答していただければ、Phase 1 から実装作業を開始できます:

1. **新規プロジェクト名**: `bonnsa-sns-cfw` / その他 (希望) — どれにしますか？
2. **リポジトリ戦略**: 別 Git リポジトリ (推奨) / 既存リポジトリの新規ブランチ — どちらにしますか？
3. **検証用ステージングドメイン**: `staging.bon-log.com` / 別 — どれにしますか？
4. **DB 戦略**: Supabase + Hyperdrive (推奨) / Neon 移行 — どちらにしますか？
5. **本番切替方式**: 段階的トラフィック分割 (推奨) / 一発切替 — どちらにしますか？
6. **seed/migration ジョブ**: Vercel に残す (推奨) / Workflows に移行 — どちらにしますか？
7. **想定スケジュール**: いつまでに完了したいですか？(これによって並行作業の優先度が変わります)
8. **Cloudflare Workers Paid プラン**: 契約済 / 未契約 — どちらですか？(未契約なら Phase 4 までに必要)

---

## 補足情報

### CFW でしか出ない可能性のあるバグへの備え

- 各種 fetch / Web API の挙動が Node.js とわずかに異なる可能性
- Hyperdrive 経由の `pg` ドライバが想定外のエラーを返す可能性
- OpenNext がまだベータ機能を含む (RSC streaming, Suspense 周り)

**保険として**: ステージング検証を **最低 5 営業日**は確保すること。

### 参考リンク

- OpenNext for Cloudflare: https://opennext.js.org/cloudflare
- Cloudflare Hyperdrive (Postgres): https://developers.cloudflare.com/hyperdrive/
- Workers nodejs_compat: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Workers Routes (custom domain): https://developers.cloudflare.com/workers/configuration/routing/
- Sentry for Cloudflare Workers: https://docs.sentry.io/platforms/javascript/guides/cloudflare/

---

最終更新: 2026-05-17
