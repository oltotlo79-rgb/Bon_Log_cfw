# Cloudflare デプロイ トラブルシューティング

Phase 4 (staging) / Phase 6 (本番) で発生しがちな問題と対処法のリファレンス。

---

## 🔴 症状別チェックリスト

### 症状 1: `https://bon-log.oltotlo81.workers.dev/` で「Hello world」のみ表示

#### 原因と対処

| 原因 | チェック方法 | 対処 |
|------|------------|------|
| 直近の build が失敗してデプロイされていない | Dashboard → Deployments タブで Status 確認 | build log を見て該当エラーを修正 (このファイルの該当節へ) |
| build は成功したが wrangler.toml の `main` が誤っている | build log で `.open-next/worker.js` 生成を確認 | `wrangler.toml` の `main` を確認 |
| プロジェクト名と worker 名がズレている | Worker URL (`*.workers.dev` の前) と wrangler.toml の `name` を比較 | `name` を Worker URL に合わせる |
| 新 commit がまだ反映されていない | Deployments タブの最新 commit を確認 | Retry deployment / 空 commit を push |
| Cloudflare の build cache が古い | build log で `Restoring from dependencies cache` の後すぐ失敗 | Dashboard → Settings → Build cache → "Clear cache" |

### 症状 2: build が `npm ci` で失敗

エラー例:
```
npm error code EUSAGE
npm error Missing: typescript@5.9.3 from lock file
```

#### 対処
ローカルで lock 再生成 → commit:
```powershell
cd C:\Users\oltot\Documents\git-projects\Bon_Log_cfw
Remove-Item package-lock.json
npm install --no-audit --no-fund --ignore-scripts
git add package-lock.json
git commit -m "chore: regenerate package-lock.json"
git push
```

### 症状 3: build が peer dependency conflict で失敗

エラー例:
```
npm error ERESOLVE unable to resolve dependency tree
npm error peer wrangler@"^4.86.0" from @opennextjs/cloudflare
```

#### 対処
`package.json` の該当パッケージのバージョン制約を緩める。
例: `wrangler: ^3.95.0` → `^4.86.0` に変更して `npm install` で lock 更新。

### 症状 4: build が `NEXT_PUBLIC_APP_URL must be set` で失敗

#### 対処
Cloudflare Dashboard → Settings → Variables and Secrets で `NEXT_PUBLIC_APP_URL` を設定。
詳細は [`OPERATOR-SETUP.md`](OPERATOR-SETUP.md) Step 1.2 を参照。

### 症状 5: build 中に TypeScript エラー

エラー例:
```
./instrumentation-client.ts:31:9
Type error: 'event' is of type 'unknown'.
```

#### 対処
通常は code 修正が必要。私 (Claude) と相談して shim や型定義を更新。

### 症状 6: アクセスすると 500 Internal Server Error

#### 確認手順
```powershell
wrangler tail
```

別ターミナルで上記を起動してから、ブラウザで該当 URL にアクセス。ログにスタックトレースが出る。

#### よくある原因
| エラーメッセージ | 原因 | 対処 |
|-----------------|------|------|
| `DATABASE_URL must be set` | 環境変数未設定 | Cloudflare で `DATABASE_URL` を設定 |
| `Connection error to PostgreSQL` | DB SSL/接続失敗 | `SUPABASE_CA_CERT` 設定 + Hyperdrive 検討 |
| `RangeError: Maximum call stack` | ループ or 無限再帰 | コード調査 |
| `Cannot find module` | バンドル漏れ | OpenNext の externals 設定確認 |
| `crypto.X is not a function` | nodejs_compat 不足 | wrangler.toml の `compatibility_flags = ["nodejs_compat_v2"]` 確認 |

### 症状 7: ログイン後に「Invalid CSRF token」

#### 対処
- `NEXTAUTH_URL` の値が Worker URL と一致しているか確認
- `NEXTAUTH_SECRET` が build と runtime で同じ値か確認

### 症状 8: Google OAuth で `redirect_uri_mismatch`

#### 対処
Google Cloud Console → OAuth Client → 承認済みリダイレクト URI に追加:
```
https://bon-log.oltotlo81.workers.dev/api/auth/callback/google
```

### 症状 9: 画像が表示されない (404)

#### 確認
- ブラウザ DevTools → Network で画像 URL を確認
- URL のホスト名が `R2_PUBLIC_URL` と一致しているか

#### 対処
- `R2_PUBLIC_URL` を Vercel と同じ値で Cloudflare に設定
- `next.config.ts` の `images.remotePatterns` に該当ホストがあるか (CFW では `unoptimized: true` なので影響ないはず)

### 症状 10: Stripe webhook が来ない / 受け取っても 500

#### 対処
- Stripe Dashboard → Webhooks → endpoint URL が正しい staging URL か
- `STRIPE_WEBHOOK_SECRET` が **その endpoint 専用の `whsec_...`** になっているか (production と staging で別)
- ログに `Webhook signature verification failed` が出ていれば secret 不一致

---

## 🛠 ローカルから直接 deploy する fallback

GitHub 連携 build が動かない場合、PC から直接 deploy:

### 前提
```powershell
cd C:\Users\oltot\Documents\git-projects\Bon_Log_cfw
wrangler whoami  # 認証済み確認
```

### 手順
```powershell
# 1. 依存関係インストール (3〜5 分)
npm install

# 2. .dev.vars 作成 (Vercel の値をコピー)
Copy-Item .dev.vars.example .dev.vars
# .dev.vars を編集

# 3. OpenNext build (10〜15 分、Windows ARM64 では失敗するので Linux/Mac/WSL 推奨)
npm run build:cf

# 4. デプロイ
wrangler deploy
```

### 期待される出力

```
 ⛅️ wrangler 4.92.0
-----
Total Upload: XXX KiB / gzip: XXX KiB
Worker ID: bon-log
Worker Etag: xxx
Deployed bon-log triggers (1 routes):
  https://bon-log.oltotlo81.workers.dev
```

---

## 🔍 デバッグに役立つコマンド

### Cloudflare Workers 状態確認
```powershell
# 認証ユーザー
wrangler whoami

# Worker 一覧
wrangler whoami --json | jq

# 特定 Worker の deployments
wrangler deployments list

# Secret 一覧 (値は表示されない)
wrangler secret list

# Hyperdrive 一覧
wrangler hyperdrive list

# Runtime ログ
wrangler tail
```

### Cloudflare Dashboard 直リンク
- bon-log プロジェクト: https://dash.cloudflare.com/?to=/:account/workers/services/view/bon-log
- 環境変数: https://dash.cloudflare.com/?to=/:account/workers/services/view/bon-log/production/settings/variables-secrets

### ローカル diff
```powershell
# bonnsa-sns との差分
git diff <commit> -- <path>

# 最新 commit 確認
git log --oneline -5
```

---

## 🆘 困ったときに私 (Claude) に共有してほしい情報

1. **Cloudflare Dashboard の build log の最後 50 行** (失敗時)
2. **`wrangler tail` の出力** (runtime エラー時)
3. **ブラウザ DevTools → Console / Network の該当エラー**
4. **`wrangler.toml` の現在の内容** (誤って書き換えた場合)
5. **どの環境変数を設定したか** (Dashboard の Variables and Secrets スクショ、値は隠して OK)

---

最終更新: 2026-05-17 (Phase 2 進行中)
