# Operator (オーナー) 向けセットアップ手順書

このリポジトリ (`Bon_Log_cfw`) を Cloudflare Workers へデプロイするために、**あなた (オーナー) が手動で実施すべき作業**を順序立ててまとめます。

> 📍 **このファイルの保存場所**: `docs/OPERATOR-SETUP.md` (本リポジトリ内)
> 関連ドキュメント:
> - [`docs/MIGRATION-PLAN.md`](MIGRATION-PLAN.md) — Phase 0〜7 の全体計画
> - [`docs/CFW-MIGRATION.md`](CFW-MIGRATION.md) — リポジトリ固有の差分管理

---

## 全体進捗チェックリスト

```
[Phase 0: アカウント・契約]
  [ ] Cloudflare Workers Paid プラン契約 ($5/月)
  [ ] Wrangler CLI インストール + wrangler login
  [ ] bon-log.com を Cloudflare DNS に委譲済み確認

[Phase 4: Staging デプロイ準備]
  [ ] Cloudflare bon-log プロジェクトに環境変数 (build用) を設定 ← この手順書のメイン
  [ ] Supabase direct connection 文字列を取得
  [ ] Hyperdrive 作成 → ID を wrangler.toml に反映
  [ ] R2 バケット名を wrangler.toml に反映
  [ ] Cloudflare DNS に staging.bon-log.com の AAAA レコード追加
  [ ] Google OAuth に staging callback URL 追加
  [ ] Stripe webhook に staging URL を追加 (任意)
  [ ] scripts/register-cf-secrets.ps1 で runtime secrets 一括登録

[Phase 5: 検証]
  [ ] staging.bon-log.com で動作確認 (ログイン / 投稿 / 通知)
  [ ] Playwright E2E を staging に対して実行
  [ ] 1 週間ソーク観察

[Phase 6: 本番カットオーバー]
  [ ] D-1 メンテナンス告知
  [ ] Supabase バックアップ
  [ ] production 用 secrets 登録
  [ ] wrangler.toml の production route 有効化
  [ ] DNS 切替

[Phase 7: 旧 Vercel 環境停止]
  [ ] 1〜2 週間後に Vercel 環境 Pause
  [ ] 3 ヶ月後に Vercel プロジェクト削除
```

---

## 🔴 Step 1: Cloudflare 環境変数を設定 (build を通すため必須)

`https://github.com/oltotlo79-rgb/Bon_Log_cfw` から `bon-log` プロジェクトに deploy されている前提です。

### 1.1 設定画面に行く

1. https://dash.cloudflare.com にログイン
2. 左サイドバーから **「Workers & Pages」** をクリック
3. プロジェクト一覧から **`bon-log`** をクリック
4. 上部タブ **「Settings」** をクリック
5. 左の中段カラムまたは設定セクションから以下のいずれかを開く:
   - **「Variables and Secrets」** (新 UI)
   - または **「Environment Variables」** (旧 UI)
   - または **「Build」** ページの **「Build Variables」** セクション

### 1.2 build 必須環境変数 (これがないと build が失敗する)

⚠ **最低限以下 7 変数を「Production」スコープで登録してください**:

| # | Variable Name | Type | Value (例) | 説明 |
|---|---------------|------|-----------|------|
| 1 | `NEXT_PUBLIC_APP_URL` | **Plaintext** | **Phase 4 初期**: `https://bon-log.oltotlo81.workers.dev` (Worker の direct URL)<br/>**Phase 4 後半**: `https://staging.bon-log.com` (DNS 切替後)<br/>**Phase 6**: `https://www.bon-log.com` (本番カットオーバー時のみ) | canonical / sitemap / OG に焼き付くため**実際に使うアクセス URL** を設定。⚠ 本番ドメイン (www.bon-log.com) は **Vercel が運用中** のため Phase 6 まで設定不可 (OAuth callback 等が Vercel に流れる事故が起きる) |
| 2 | `NEXTAUTH_URL` | **Plaintext** | 上記と同じ値 | NextAuth コールバック検証 |
| 3 | `NEXTAUTH_SECRET` | **Secret** | 32 文字以上のランダム文字列 | JWT 署名キー。生成方法は次節を参照 |
| 4 | `DATABASE_URL` | **Secret** | (build 時) `postgresql://dummy:dummy@localhost:5432/dummy`<br/>(runtime) Supabase URL | Prisma 接続 |
| 5 | `DIRECT_URL` | **Secret** | 上記と同じ | Prisma migrate 用 |
| 6 | `TWO_FACTOR_ENCRYPTION_KEY` | **Secret** | 64 文字 hex (= 32 byte) | 2FA AES-256-GCM 鍵 |
| 7 | `SKIP_DB_CONNECTION` | **Plaintext** | `true` | build 中の DB 接続スキップ。**`NEXT_PHASE === 'phase-production-build'` の build 中のみ尊重され、runtime では自動的に無視される**ためそのままで OK |

### 1.2.0 `NEXTAUTH_SECRET` の生成方法

PowerShell で**インスタンス経由**にすること (静的 `GetBytes(int)` は PS 7+ / .NET 6+ のみ提供)。
PowerShell 5.x (Windows 標準) では下記いずれかを使用:

```powershell
# 方法 A: RNGCryptoServiceProvider (PS 5.x で確実に動く) ← 推奨
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()

# 方法 B: RandomNumberGenerator.Create() で abstract class のインスタンス取得 (5.x/7.x 両対応)
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()

# 方法 C: Node.js (パス通っていれば)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 方法 D: openssl (Git for Windows 付属)
openssl rand -base64 32
```

出力例 (44 文字、末尾 `=` 含む):
```
kQ8mP7xR2vN5bW9fJ3hL6tY4dA0cE1gI8kO7nQ2sU5w=
```

⚠ この値は PowerShell の履歴に残るので、登録後すぐにターミナルをクリアまたは閉じること。

### 1.2.1 ⚠ `NEXT_PUBLIC_APP_URL` の値はフェーズで変える

このプロジェクトのドメイン (`www.bon-log.com`) は **Phase 6 まで Vercel が運用中**。
CFW 側にもこの URL を設定すると以下の事故が起きます:

- canonical / sitemap が CFW 側で生成されるが Vercel のページにリンクしてしまう
- OAuth callback (Google ログイン) が `www.bon-log.com/api/auth/callback/google` → Vercel に飛ぶ
- Stripe redirect も Vercel に流れる

正しい段階別の値:

| Phase | NEXT_PUBLIC_APP_URL の値 | タイミング |
|-------|--------------------------|------------|
| Phase 4 初期 | `https://bon-log.oltotlo81.workers.dev` | Worker の direct URL。**今ここ** |
| Phase 4 後半 | `https://staging.bon-log.com` | DNS で staging サブドメインを CFW に向けた後 (Step 4 完了後) |
| Phase 6 | `https://www.bon-log.com` | 本番 DNS を CFW に切り替える瞬間 |

各 Phase 移行時は **`NEXT_PUBLIC_APP_URL` と `NEXTAUTH_URL` を同時に更新 + 再ビルド** が必要。

Worker の direct URL の確認方法:
1. Cloudflare Dashboard → Workers & Pages → bon-log
2. **「Settings」 → 「Domains & Routes」** または **「Triggers」**
3. `*.workers.dev` で終わる URL がそれ

**このプロジェクトの確認済み URL** (2026-05-17):
- Production: `https://bon-log.oltotlo81.workers.dev`
- Preview: `https://*-bon-log.oltotlo81.workers.dev` (ブランチごとに `*` が変わる)

⚠ Preview スコープは Phase 4 では設定不要 (Production のみ設定)。
Preview を使う場合は Google OAuth Console で wildcard callback URL を許可する必要があるが、
Cloudflare Workers の Preview URL は予測不能なため、Preview での OAuth は基本諦める運用。

### 1.3 登録手順 (1 件あたり 20 秒)

各変数につき:
1. **「Add variable」** ボタンをクリック
2. **「Variable name」** に名前を入力 (例: `NEXT_PUBLIC_APP_URL`)
3. **「Value」** に値を入力
4. **「Type」** を選択:
   - 機密でないもの → **「Plaintext」**
   - パスワード等 → **「Secret」** (暗号化保存)
5. **「Environment」**: **「Production」** にチェック
   - PR プレビュー機能を使うなら **「Preview」** にもチェック
6. **「Save」** で保存

### 1.4 retry deployment

7 変数登録後、Cloudflare Dashboard の **「Deployments」** タブから:
- 最新の失敗デプロイの **「Retry deployment」** をクリック
- または GitHub に空 commit を push (`git commit --allow-empty -m "trigger retry"` → push)

build が **`Success`** になれば次の Step へ。

### 1.5 build 成功直後の動作確認 (重要)

build 成功直後に、Worker URL にアクセスして runtime も動くか確認:

```
https://bon-log.oltotlo81.workers.dev/
```

**予想される結果と意味**:

| 結果 | 意味 | 次のアクション |
|------|------|---------------|
| 200 OK + ログイン画面表示 | 🎉 runtime も含めて動作 | Step 2 (機能別 env) へ |
| 500 Internal Server Error | DB 接続失敗の可能性大 | Step 2 で `SUPABASE_CA_CERT` を設定 → Step 3 (Hyperdrive 設定) へ進む |
| 真っ白画面 / 静的 chunk エラー | build artifact 配信問題 | wrangler tail でログ確認 → 共有 |
| `NEXT_PUBLIC_APP_URL` 関連エラー | env 値の typo | 値を再確認 (https:// プレフィックス必須) |
| **「Hello world」のみ表示** | (旧 commit で出ていた問題、`d4f53de` で解決) | 最新 commit が deploy されているか確認 → されていなければ Retry deployment |

**ログ監視** (別ターミナルで実行推奨):

```powershell
cd C:\Users\oltot\Documents\git-projects\Bon_Log_cfw
wrangler tail
```

ブラウザでアクセスするとリクエストごとにログが流れます。500 エラーの詳細スタックトレースもここに出ます。

---

## 🟡 Step 2: 機能別環境変数を設定 (機能を使う場合のみ必要)

### 2.1 Stripe (有料会員機能)

| 変数 | Type | Value (Vercel から) |
|------|------|---------------------|
| `STRIPE_SECRET_KEY` | Secret | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Secret | `whsec_...` |
| `STRIPE_PRICE_ID_MONTHLY` | Plaintext | `price_xxx` |
| `STRIPE_PRICE_ID_YEARLY` | Plaintext | `price_xxx` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Plaintext | `pk_live_...` |

### 2.2 Google OAuth

| 変数 | Type | Value |
|------|------|-------|
| `GOOGLE_CLIENT_ID` | Plaintext | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Secret | `GOCSPX-...` |

### 2.3 Email (Resend)

| 変数 | Type | Value |
|------|------|-------|
| `EMAIL_PROVIDER` | Plaintext | `resend` |
| `RESEND_API_KEY` | Secret | `re_...` |
| `EMAIL_FROM` | Plaintext | `BON-LOG <noreply@bon-log.com>` |

### 2.4 Redis (Upstash) — レート制限・キャッシュ

| 変数 | Type | Value |
|------|------|-------|
| `UPSTASH_REDIS_REST_URL` | Plaintext | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Secret | `xxx` |

### 2.5 Storage (Cloudflare R2)

| 変数 | Type | Value |
|------|------|-------|
| `STORAGE_PROVIDER` | Plaintext | `r2` |
| `R2_ACCOUNT_ID` | Plaintext | `xxx` |
| `R2_ACCESS_KEY_ID` | Secret | `xxx` |
| `R2_SECRET_ACCESS_KEY` | Secret | `xxx` |
| `R2_BUCKET_NAME` | Plaintext | `bon-log-uploads` |
| `R2_PUBLIC_URL` | Plaintext | `https://pub-xxx.r2.dev` |

### 2.6 Supabase SSL 証明書

| 変数 | Type | Value |
|------|------|-------|
| `SUPABASE_CA_CERT` | Secret | Base64 エンコード済 `prod-ca-2021.crt` (Vercel の値そのまま) |

### 2.7 Web Push (通知)

| 変数 | Type | Value |
|------|------|-------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Plaintext | `BJxxx...` |
| `VAPID_PRIVATE_KEY` | Secret | `xxx` |
| `VAPID_SUBJECT` | Plaintext | `mailto:noreply@bon-log.com` |

### 2.8 その他

| 変数 | Type | Value |
|------|------|-------|
| `CRON_SECRET` | Secret | Cron HMAC 認証用 (32+ chars ランダム) |
| `SEARCH_MODE` | Plaintext | `trgm` |
| `NEXT_PUBLIC_AD_PROVIDER` | Plaintext | `ninja` または `adsense` |
| `GUEST_PASSWORD` | Secret | ゲストログイン使う場合 |

### 2.9 任意 (Phase 2 では無効化されている / 後で有効化)

| 変数 | Type | Value | 用途 |
|------|------|-------|------|
| `SENTRY_DSN` | Secret | Sentry DSN | エラー監視 (現状 shim で no-op) |
| `NEXT_PUBLIC_SENTRY_DSN` | Plaintext | 同上 | クライアント側 Sentry |
| `BASIC_AUTH_ENABLED` | Plaintext | `true` | staging を限定公開する場合 |
| `BASIC_AUTH_USER` | Secret | ID | 同上 |
| `BASIC_AUTH_PASSWORD` | Secret | パスワード | 同上 |

---

## 🟢 Step 3: Wrangler CLI と Hyperdrive 設定

### 3.1 Wrangler CLI インストール

PowerShell で:

```powershell
npm install -g wrangler
wrangler login
```

ブラウザで Cloudflare に認証 → 認証完了後:

```powershell
wrangler whoami
```

email が表示されればOK。

### 3.2 Supabase direct connection 文字列を取得

1. Supabase Dashboard → プロジェクト → **Settings** → **Database**
2. **Connection string** → **URI** タブ
3. **Port: 5432** の方を選択 (PgBouncer 6543 ではない)
4. `[YOUR-PASSWORD]` 部分を実パスワードに置換
   - 例: `postgresql://postgres.abc123:RealPassword@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`

### 3.3 Hyperdrive 作成

```powershell
cd C:\Users\oltot\Documents\git-projects\Bon_Log_cfw
wrangler hyperdrive create bon-log-hyperdrive --connection-string="postgresql://postgres.abc123:RealPassword@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

成功すると以下のような出力:

```
✅ Created Hyperdrive 'bon-log-hyperdrive'
{
  "id": "abc123def456-...-xyz",
  ...
}
```

**この `id` の値をメモ**してください。

> ⚠ password に `@`, `:`, `?`, `#`, `/` 等の記号が含まれる場合は URL エンコードが必要 (`@` → `%40` 等)

### 3.4 wrangler.toml のプレースホルダーを実値に置換

エディタで `wrangler.toml` を開き、**3 箇所**ある placeholder を実値に置換:

| placeholder | 実値 |
|------------|------|
| `00000000-0000-0000-0000-000000000000` | 上で取得した Hyperdrive ID (例: `abc123def456-...-xyz`) |
| `bon-log-uploads-placeholder` | R2 バケット名 (Vercel `.env.local` の `R2_BUCKET_NAME` の値) |

3 セット (top-level / staging / production) すべて同じ値で OK。

### 3.5 commit & push

```powershell
git add wrangler.toml
git commit -m "chore: wrangler.toml の Hyperdrive ID と R2 バケット名を実値に反映"
git push
```

---

## 🔵 Step 4: DNS レコード追加 (ステージング用)

### 4.1 Cloudflare DNS

1. Cloudflare Dashboard → **Websites** → **bon-log.com** をクリック
2. 左サイドバー **DNS** → **Records**
3. **「Add record」** をクリック
4. 以下を入力:
   - **Type**: `AAAA`
   - **Name**: `staging`
   - **IPv6 address**: `100::`
   - **Proxy status**: **Proxied (橙色の雲)** ← 重要
   - **TTL**: Auto
5. **Save**

これで `staging.bon-log.com` が Cloudflare のエッジに向きます。

---

## 🟣 Step 5: Google OAuth 設定 (Phase 4 staging で必要)

### 5.1 staging callback URL を追加

1. https://console.cloud.google.com/apis/credentials
2. 既存の OAuth 2.0 Client ID をクリック
3. **「承認済みのリダイレクト URI」** に以下を追加:
   - `https://staging.bon-log.com/api/auth/callback/google`
4. **保存**

これがないと staging で Google ログインが失敗します。

---

## 🔷 Step 6: Stripe webhook 設定 (任意)

### 6.1 staging endpoint 追加

1. https://dashboard.stripe.com/webhooks
2. **「Add endpoint」**
3. **Endpoint URL**: `https://staging.bon-log.com/api/webhooks/stripe`
4. **Events to send**: 既存の本番 webhook と同じイベントを選択
5. **Add endpoint**
6. 作成後の **「Signing secret」** (`whsec_...`) を取得 → Cloudflare の `STRIPE_WEBHOOK_SECRET` を staging 用に更新

> 既存 production webhook はそのまま残す (Phase 6 まで Vercel 側も動く)

---

## ⚙ Step 7: scripts/register-cf-secrets.ps1 で runtime secrets 一括登録

GitHub 連携 build とは別に、wrangler 直接デプロイする場合は wrangler secret 経由で登録します。GitHub 連携 build を使っている場合は **Step 1〜2 (Cloudflare Dashboard) で代替** できるので、この Step はスキップ可。

### 7.1 スクリプトの値を埋める

`scripts/register-cf-secrets.ps1` をエディタで開き、各 `<<.env.local の XXX>>` を実値に書き換え。

### 7.2 実行

```powershell
.\scripts\register-cf-secrets.ps1 -Env staging
```

---

## ✅ Step 8: 動作確認

### 8.1 build 確認

Cloudflare Dashboard → bon-log → **「Deployments」** タブ
- 最新デプロイの Status が **`Success`** になっていること

### 8.2 ログ監視

```powershell
wrangler tail
```

別ターミナルで `https://bon-log.<account>.workers.dev` または `https://staging.bon-log.com` にアクセス → エラーログを確認

### 8.3 機能チェック

| 機能 | URL | 期待結果 |
|------|-----|---------|
| トップページ | `/` | 200 OK + HTML 表示 |
| ヘルスチェック | `/api/health` | 200 OK |
| ログイン | `/login` | ログイン画面表示 |
| 既存アカウントでログイン | (フォーム入力) | ログイン成功 |
| タイムライン | `/feed` | 投稿表示 (DB 接続 OK) |
| 投稿作成 | (Compose) | 作成成功 |
| 画像アップロード | (画像投稿) | R2 にアップロード成功 |

---

## 困った時のチェックポイント

| 症状 | 対処 |
|------|-----|
| build が `NEXT_PUBLIC_APP_URL must be set` で失敗 | Step 1.2 の Variable 7 件を登録したか確認 |
| build が `DATABASE_URL` 関連で失敗 | `SKIP_DB_CONNECTION=true` が設定されているか確認 |
| Workers ランタイムで `Cannot find module 'web-push'` 等 | `compatibility_flags = ["nodejs_compat_v2"]` が wrangler.toml にあるか確認 |
| ログインしようとすると 500 | Hyperdrive ID が実値に置換されているか確認 (`wrangler.toml` の 3 箇所) |
| Google ログインで `redirect_uri_mismatch` | Step 5.1 の callback URL を追加したか確認 |
| Stripe webhook が動かない | Step 6.1 で `STRIPE_WEBHOOK_SECRET` を staging 用に更新したか確認 |

---

## 質問・エラーが出た時

エラーメッセージ全文を共有してください。私 (Claude) の方で原因調査 → 修正 → push します。

特に共有が役立つもの:
- Cloudflare Dashboard の build log (deploy 失敗時)
- `wrangler tail` の runtime ログ (動作後のエラー)
- ブラウザ DevTools の Console / Network エラー

---

最終更新: 2026-05-17 (Phase 2 進行中)
