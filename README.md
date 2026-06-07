# BON-LOG（ボンログ）

盆栽愛好家のためのソーシャルネットワークサービス

**本番URL**: https://www.bon-log.com

---

## 概要

BON-LOGは、盆栽愛好家が日々の管理記録・作品共有・情報交換を行えるSNSプラットフォームです。投稿・いいね・フォローなどの一般的なSNS機能に加え、盆栽特有の機能（成長記録・盆栽園マップ・病害虫データベース）を備えています。

### 主な機能

| 機能 | 説明 |
|---|---|
| 投稿 | テキスト + 画像4枚 or 動画1本、ハッシュタグ、投票 |
| 引用・リポスト | ツイッター的な投稿共有 |
| ソーシャル | フォロー / ブロック / ミュート / 非公開アカウント |
| 通知 | いいね・コメント・フォロー等15種 + Web Push |
| DM | ダイレクトメッセージ |
| 盆栽記録 | 樹種ごとの成長記録・写真管理 |
| 盆栽園マップ | Leaflet + OpenStreetMapによる店舗情報・レビュー |
| イベント | 展示会・催しのカレンダー表示 |
| 病害虫DB | 農薬・病害虫・有効成分・剤型・展着剤・コラム |
| 肥料ガイド | カテゴリ比較、栄養素、樹種別施肥スケジュール |
| 用語辞典 | 盆栽専門用語の検索・学習（読み仮名対応） |
| 盆栽手入れログ | カレンダービュー専用の構造化メモ（剪定・水やり・施肥等の記録） |
| 天気アドバイス | Open-Meteo連携、盆栽管理アドバイス自動生成 |
| 季節テーマ | 月に応じた水墨画バナー・背景アニメーション自動切替 |
| OGP | 水墨画ベースのOG画像（各ページで個別指定） |
| 植物ホルモンガイド | 五大ホルモン・技法影響・相互作用・年間カレンダー・シミュレーター |
| プレミアム | 月額350円 / 年額3,500円、予約投稿・アナリティクス・ゴールドフレーム |
| 管理者 | コンテンツモデレーション・ユーザー管理・監査ログ（28サブディレクトリ / 35画面） |

---

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI | React 19.2.3 + Tailwind CSS 4 + shadcn/ui (Radix UI primitives) |
| State | TanStack React Query 5.90.16 |
| ORM | Prisma 6.19.2 |
| Database | PostgreSQL (Supabase) |
| Auth | NextAuth.js v5 beta (Auth.js — `5.0.0-beta.31` を pinned、JWT戦略 + サーバーサイド2FA) |
| Validation | Zod 4 |
| Cache | Upstash Redis |
| Storage | Cloudflare R2 |
| Payment | Stripe |
| Email | Resend |
| Map | Leaflet + OpenStreetMap |
| Monitoring | Sentry |
| Testing | Vitest 4.0.18 + Playwright 1.57.0 |
| Deploy | fly.io（app `bon-log` / region `nrt`、Docker standalone）+ GitHub Actions（デプロイ・Cron） |

---

## 開発環境セットアップ

### 前提条件

- Node.js 20 LTS
- Docker Desktop（PostgreSQL用）

### 手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd bonsai-sns-project

# 2. 環境変数を設定
cp .env.local.example .env.local
# .env.local を編集（DATABASE_URL, NEXTAUTH_SECRET 等）

# 3. 依存関係インストール
npm install

# 4. PostgreSQL起動（Dockerのみ）
docker compose up -d postgres

# 5. DBスキーマ反映 + Prismaクライアント生成
npx prisma db push
npx prisma generate

# 6. シードデータ投入（任意）
npm run db:seed                # 基本シード（prisma/seed.ts）
# npm run db:seed-pesticide     # 農薬データのみ
# npm run db:seed-pesticide-all # 農薬関連全データ

# 7. 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 にアクセス。

### Docker で一括起動（PostgreSQL + Next.js）

```bash
docker compose --profile dev up -d
```

---

## 開発コマンド

```bash
npm run dev          # 開発サーバー起動（Webpack）
npm run build        # 本番ビルド（prisma generate + next build --webpack）
npm run start        # 本番サーバー起動
npm run lint         # ESLint実行

# Prisma
npx prisma studio    # DB管理GUI起動
npx prisma db push   # スキーマをDBに反映（開発用）
npx prisma migrate dev --name <name>  # マイグレーション作成
npx prisma generate  # Prismaクライアント再生成

# シード
npm run db:seed              # 基本シード
npm run db:seed-pesticide    # 農薬データ
npm run db:seed-pesticide-all # 農薬関連全データ

# テスト
npm test                # ユニットテスト
npm run test:coverage   # カバレッジ付き
npm run test:e2e        # E2Eテスト（Playwright）
npm run test:all        # 全テスト実行

# ヘルスチェック
curl http://localhost:3000/api/health
```

---

## 環境変数

`.env.local.example` を参考に `.env.local` を作成してください。

| 変数 | 説明 |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL接続URL |
| `DIRECT_URL` | Prisma migrate用直接接続URL |
| `NEXTAUTH_URL` | 認証コールバックURL |
| `NEXTAUTH_SECRET` | JWT署名キー（`openssl rand -base64 32` で生成） |
| `NEXT_PUBLIC_APP_URL` | フロントエンドのURL |
| `R2_ACCOUNT_ID` | Cloudflare R2 アカウントID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 アクセスキー |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 シークレット |
| `R2_BUCKET_NAME` | R2 バケット名 |
| `R2_PUBLIC_URL` | R2 パブリックURL |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis トークン |
| `RESEND_API_KEY` | Resend メールAPIキー |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhookシークレット |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 公開キー |
| `SENTRY_DSN` | Sentry DSN |
| `TWO_FACTOR_ENCRYPTION_KEY` | 2FA暗号化キー（32バイトhex、v1 鍵として扱われる後方互換用） |
| `TWO_FACTOR_ENCRYPTION_KEY_v1`, `_v2`, ... | 鍵バージョニング対応（無停止ローテーション用、任意） |
| `TWO_FACTOR_KEY_VERSION` | 暗号化に使う現行鍵のバージョン（既定 `v1`） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuthクレデンシャル |
| `CRON_SECRET` | Cron エンドポイント認証用シークレット（GitHub Actions の Bearer 認証 + HMAC 署名検証） |
| `AUTH_TRUST_HOST` | fly.io 等のリバースプロキシ配下で NextAuth がホストを信頼するため `true` 必須 |
| `PLAYWRIGHT_WORKERS` | E2E 並列ワーカー数（CI 既定 3、未指定なら自動） |

---

## プロジェクト構成

```
bonsai-sns-project/
├── app/
│   ├── (auth)/           # 認証ページ（ログイン・登録・パスワードリセット）
│   ├── (main)/           # メインアプリ（フィード・投稿・ユーザー・検索 等）
│   ├── (public)/         # 公開ページ（about, contact, help）
│   ├── (legal)/          # 利用規約・プライバシー・特商法・アクセシビリティ
│   ├── admin/            # 管理者ダッシュボード（28サブディレクトリ、35画面）
│   ├── auth/callback/    # NextAuth コールバック（Route Handler）
│   ├── maintenance/      # メンテナンス中ページ
│   ├── feed.xml/         # 公開投稿の RSS 2.0 フィード（Route Handler）
│   └── api/              # Route Handlers（24本: upload×4, cron×4, admin×6, webhooks/stripe, push/vapid-key, badges, ad-frame, og, auth/[...nextauth], analytics×2, health, maintenance/status）
├── components/           # 33サブディレクトリ
│   ├── post/             # 投稿関連（最大ディレクトリ）
│   ├── shop/             # 盆栽園
│   ├── ui/               # shadcn/ui + Radix UI 基本
│   ├── user/             # プロフィール・フォロー
│   ├── common/           # 共通コンポーネント
│   ├── bonsai/           # 盆栽記録 + 手入れログカレンダー
│   ├── comment/          # コメント
│   ├── analytics/        # アナリティクス
│   ├── seo/              # 構造化データ（JSON-LD 9種類）
│   ├── fertilizer/       # 肥料ガイド
│   ├── hormone/          # 植物ホルモン
│   ├── event/            # イベント
│   ├── search/, settings/, auth/, ads/, animation/, contact/, dictionary/, landing/, premium/, pwa/, report/, theme/, weather/, subscription/  # その他
│   ├── layout/           # ナビ・サイドバー
│   └── admin/            # 管理者UI
├── lib/
│   ├── actions/          # Server Actions（87ファイル: ルート 66 + admin/ 20 + schemas/ 1）。`'use server'` を持つ Server Action 公開モジュールは 73 本、残りは `'server-only'` の RSC データ取得 / 内部 helper（filter-helper, post-include, post-validation, prisma-filters, shared-includes, utils 等）
│   ├── services/         # サービス層（15ファイル: 通知バルク／コア、Webhook冪等性、認可、セキュリティイベント、ハッシュタグ同期 / 再計算、コメント通知 / スレッドミュート、メンション、利用統計、天気、アナリティクス記録／取得）
│   ├── shop/             # Shop ドメイン共有ユーティリティ（change-request.ts: 変更リクエストの型・schema・parser。旧 services/shop-change-helpers を layer-neutral 配置へ移動）
│   ├── security/         # セキュリティユーティリティ
│   ├── validations/      # Zodスキーマ
│   ├── email/            # メールテンプレート
│   ├── storage/          # ファイルアップロード
│   ├── constants/        # 定数・制限値（ルート 22 + limits/ 18 + errors/ 7、合計 47 ファイル。system-settings.ts で DB キーも定数化、limits/event.ts でイベント類似度閾値も集約、constants/dictionary.ts で辞典カテゴリ・配色を集約）
│   ├── utils/            # ユーティリティ（admin-cursor, avatar, calendar-grid, client-ip, fertilizer, form-data, json, pesticide, pesticide-badge, preserve-order, season, seo の 12 ファイル）
│   ├── auth.ts           # NextAuth.js設定
│   ├── db.ts             # Prismaクライアント
│   ├── env.ts            # 環境変数のゲートウェイ getter（getCronSecret / getBasicAuthConfig / isProduction 等）
│   ├── two-factor.ts     # 2FA（TOTP + 鍵バージョニング対応）
│   ├── rate-limit.ts     # Upstash Redisレート制限
│   ├── logger.ts         # Sentry連携ロガー（static import、開発はconsole・本番はSentryへ送信）
│   └── cache.ts          # unstable_cache ラッパ
├── prisma/
│   ├── schema.prisma     # DBスキーマ（90モデル, 24 enum）
│   ├── migrations/       # マイグレーション（38ディレクトリ + fulltext_search_indexes.sql + migration_lock.toml）
│   ├── validation/       # 農薬データMAFF突合バリデーション
│   ├── seed.ts           # シードエントリポイント
│   └── seed/             # ドメイン別シード（dictionary, e2e, fertilizer, genre, hormone, pesticide, shared）
├── __tests__/            # ユニット・コンポーネントテスト（Vitest, 825ファイル）
├── e2e/                  # E2Eテスト（Playwright, 60 spec, 8プロジェクト構成）
├── hooks/                # 共有Client Hooks（8ファイル: useFollowAction, useMediaUpload, useToast 等）
├── docs/                 # ドキュメント
├── scripts/              # 保守スクリプト（seed補助・PWAアイコン生成等）
├── proxy.ts              # 認証チェック・CSP nonce・HSTS・Origin/Referer 検証・メンテナンスゲート（Edge Runtime、セキュリティイベントは Sentry に送信）
└── next.config.ts        # Next.js設定
```

---

## テスト

```bash
npm test                  # ユニットテスト（1回実行 / vitest run）
npm run test:watch        # ユニットテスト（Watch モード）
npm run test:coverage     # カバレッジレポート生成
npm run test:e2e          # E2Eテスト（Playwright）
npm run test:all          # ユニット + E2E
```

### カバレッジ閾値と規模

| 項目 | 値 |
|---|---|
| プロバイダー | `@vitest/coverage-istanbul`（`vi.mock()` 多用環境の集計精度のため v8 から移行） |
| Branches（閾値） | 80% |
| Functions（閾値） | 85% |
| Lines（閾値） | 85% |
| Statements（閾値） | 85% |
| TypeScript strict 設定 | `strict: true` + `noUncheckedIndexedAccess: true` + `noImplicitOverride: true` |
| ユニット・コンポーネントテスト | 825ファイル（`.test.ts` + `.test.tsx`） |
| E2Eテスト | 60 specファイル（Playwright、8プロジェクト構成: setup + 5ブラウザ + chromium-noauth + teardown） |
| 主要分布 | components / lib / app / coverage-boost / prisma / hooks / types / その他 |

詳細は [`docs/TESTING.md`](docs/TESTING.md) を参照。

---

## CI/CD

GitHub Actions により PR・mainブランチへのプッシュ時に自動実行:

| ジョブ | 内容 |
|---|---|
| lint | ESLint + TypeScript型チェック |
| security | npm audit + CodeQL解析 |
| test | Vitestユニットテスト + カバレッジ |
| build | Next.jsビルド検証 |
| e2e | Playwright E2Eテスト（mainのみ） |

ワークフロー:

| ワークフロー | 内容 |
|---|---|
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | lint / security / test / build / e2e |
| [`.github/workflows/fly-deploy.yml`](.github/workflows/fly-deploy.yml) | master プッシュ時に fly.io へデプロイ |
| [`.github/workflows/cron.yml`](.github/workflows/cron.yml) | スケジュール実行の Cron ジョブ |

---

## デプロイ

本番は **fly.io**（app `bon-log` / primary region `nrt`＝東京）に Docker standalone イメージとしてデプロイされます。DB（Supabase）・Storage（R2）・Cache（Upstash）・Stripe・Resend・Sentry は外部サービスを継続利用します。

### デプロイ（GitHub Actions 経由）

`master` への push（または手動 `workflow_dispatch`）で [`fly-deploy.yml`](.github/workflows/fly-deploy.yml) が起動し、amd64 ランナー上で `flyctl deploy --local-only` を実行します（ローカル ARM での amd64 ビルド失敗・depot ビルダの OOM を回避するため）。

- 必要な GitHub Secret: `FLY_API_TOKEN`（`fly tokens create deploy -a bon-log`）
- 構成ファイル: [`fly.toml`](fly.toml)（`NEXT_PUBLIC_*` は `[build.args]` でビルド時 inline）, [`Dockerfile`](Dockerfile)（multistage standalone）
- `NextAuth` がプロキシ配下でホストを信頼するため `AUTH_TRUST_HOST=true` が必須

### Secrets 投入

秘匿値（`DATABASE_URL` 等）は `fly.toml` に書かず `fly secrets` で投入します。`.env.local` を一括取り込みするヘルパーを用意:

```bash
node scripts/fly-secrets-import.mjs   # .env.local をパースして fly secrets import に流す
```

### Cron

fly.io には組込 cron が無いため、[`cron.yml`](.github/workflows/cron.yml) が GitHub Actions の schedule で各 Cron エンドポイント（`/api/cron/*`）を `Authorization: Bearer $CRON_SECRET` で叩きます。

- 必要な GitHub Secret: `CRON_SECRET`（fly secrets の同名値と一致させる）
- 必要な GitHub Variable: `APP_URL`（既定 `https://www.bon-log.com`）

### マイグレーション

runner イメージは prisma CLI（devDependency）を含まないため、マイグレーションは release_command では行わずローカルから実行します:

```bash
npx dotenv -e .env.local -- npx prisma migrate deploy   # DIRECT_URL を使用
```

### ローカル Docker（本番相当の確認）

```bash
docker build -t bonsai-sns .
docker compose --profile prod up -d
```

---

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) + [`.claude/rules/`](.claude/rules/) | Claude Code向けプロジェクト指示書（機能別ルール分割） |
| [`docs/requirements.md`](docs/requirements.md) | 要件定義書 |
| [`docs/project-structure.md`](docs/project-structure.md) | ファイル構成詳細 |
| [`docs/api-spec.md`](docs/api-spec.md) | Route Handler仕様（`app/api/` 24ルート + `/feed.xml` + `/auth/callback`） + Server Actions一覧（90ファイル） |
| [`docs/TESTING.md`](docs/TESTING.md) | テスト戦略・パターン集 |
| [`docs/tutorial/`](docs/tutorial/) | 開発チュートリアル |
| [`docs/code-reference/`](docs/code-reference/) | コードリファレンス |
| [`docs/plans/`](docs/plans/) | 進行中の計画書（ローカル専用、gitignore対象） |

---

## ライセンス

Private — Copyright (c) 2026 BON-LOG. All rights reserved.
