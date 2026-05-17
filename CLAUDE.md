---
description:
alwaysApply: true
---

# CLAUDE.md

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3000)
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動
npm run lint     # ESLint実行

# Prisma
npx prisma generate    # Prismaクライアント生成
npx prisma db push     # スキーマをDBに反映（開発用）
npx prisma migrate dev # マイグレーション作成・実行
npx prisma studio      # DB管理GUI起動

# Docker
docker compose up -d postgres  # PostgreSQLのみ起動（推奨）
docker compose down            # 停止
docker compose down -v         # 停止 + データ削除

# テスト
npm test              # ユニットテスト
npm run test:coverage # カバレッジ付き
npm run test:e2e      # E2Eテスト
npm run test:all      # 全テスト実行
```

## CI/CD（GitHub Actions）

| ジョブ | 内容 | 実行タイミング |
|--------|------|--------------|
| lint | ESLint + TypeScript型チェック | 常時 |
| test | ユニットテスト | 常時 |
| build | ビルド確認 | 常時 |
| e2e | E2Eテスト（Playwright） | mainのみ |

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router) / React 19 / TypeScript (strict)
- **スタイリング**: Tailwind CSS 4 + shadcn/ui
- **状態管理**: React Query (サーバー状態) + useState/Context (クライアント状態)
- **ORM**: Prisma 6 + PostgreSQL (開発: Docker / 本番: Supabase)
- **認証**: NextAuth.js v5 (JWT戦略)
- **ストレージ**: Cloudflare R2 / **キャッシュ**: Upstash Redis
- **メール**: Resend / **決済**: Stripe / **監視**: Sentry
- **地図**: Leaflet + OpenStreetMap / **画像処理**: Sharp

## 核心ルール

1. **デフォルトはServer Component** — `'use client'`はHooks/イベント/ブラウザAPI使用時のみ
2. **Server ActionsはActionResult型で返却** — `types/action-result.ts` の `actionSuccess`/`actionError` を使用
3. **全Actionで認証→Zodバリデーション→レート制限の順** — `requireActiveNonGuestUser()` → `schema.safeParse` → `enforceUserRateLimit(userId, action)`
4. **リスト取得はカーソルベースページネーション** — offset不使用
5. **エラーメッセージは `lib/constants/errors.ts` の定数を使用** — インライン文字列禁止
6. **通知は `@/lib/services/notification-core` の `createNotification()` 経由** — `prisma.notification.create` 直接呼び出し禁止。`'use server'` ファイルから公開しない
7. **マジックナンバー禁止** — 数値・文字列リテラルは `lib/constants/` の定数を使用（制限値は `limits/`、ルートは `routes.ts`）
8. **`any` / `as` キャスト禁止** — 型ガードか Zod で安全に絞り込む。strict mode を維持
9. **既存ヘルパーを再利用** — 新コード追加前に `lib/actions/utils.ts`, `lib/utils/`, `lib/constants/` を確認し、同等機能があればそれを使う
10. **新機能・バグ修正にはテストを伴う** — カバレッジ閾値（branches 80%, functions/lines/statements 85%）を下回らない

## アーキテクチャ

```
app/
├── (auth)/        # 認証ページ (login, register, password-reset, verify-email)
├── (main)/        # メインアプリ (feed, posts, users, search, shops, events, notifications, messages, bonsai, settings, analytics, drafts, pesticides, fertilizers, dictionary)
├── (legal)/       # プライバシー, 利用規約, 特商法
├── (public)/      # about, contact, help
├── admin/         # 管理者ダッシュボード (28サブディレクトリ)
└── api/           # Route Handlers (21エンドポイント)
components/        # 30サブディレクトリ (ads, auth, bonsai, comment, common, event, feed, post, shop, ui, user 等)
lib/
├── actions/       # Server Actions (85ファイル)
├── auth.ts        # NextAuth設定
├── db.ts          # Prismaシングルトン
├── cache.ts       # unstable_cache
├── rate-limit.ts  # Redisレート制限
└── constants/     # エラーメッセージ, 制限値, ルート定数
types/             # ActionResult, analytics, next-auth.d.ts
hooks/             # useFollowAction, useKeyboardShortcuts, useMediaUpload, useToast 等
prisma/schema.prisma  # 90モデル, 24 enum
```

## 機能制約

- 投稿: 1日20件, 文字数500(無料)/2000(プレミアム), 画像4(6)枚, 動画1(3)本
- コメント: 1投稿100件, 1日制限あり
- ジャンル: 投稿に最大3つ（松柏類, 雑木類, 草もの, 用品・道具, 施設・イベント, その他）
- レビュー: 星5段階 + テキスト + 画像3枚

## UI/UXガイドライン

- 和風・落ち着いた色調（緑, 茶, ベージュ系）
- デスクトップ: 3カラム（左ナビ, 中央コンテンツ, 右サイドバー）
- モバイル: 1カラム + ボトムナビ

## パスエイリアス

`@/*` でプロジェクトルートからインポート: `import { prisma } from '@/lib/db'`

## 環境変数

```bash
DATABASE_URL, DIRECT_URL                          # Supabase PostgreSQL
NEXTAUTH_URL, NEXTAUTH_SECRET                     # NextAuth.js
NEXT_PUBLIC_APP_URL                               # アプリURL
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  # Redis
STORAGE_PROVIDER, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL  # R2
RESEND_API_KEY                                    # メール
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # Stripe
SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN                # Sentry
TWO_FACTOR_ENCRYPTION_KEY                         # 2FA (32バイトhex)
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET            # Google OAuth
```

## 詳細ルール

機能別の詳細なパターン・規約は `.claude/rules/` に分割:

| ルールファイル | 適用対象 |
|--------------|---------|
| `architecture.md` | レイヤ分離・actions/services 判断基準 |
| `nextjs-components.md` | ページ・コンポーネント作成 |
| `nextjs-data-fetching.md` | データ取得・キャッシュ |
| `server-actions.md` | Server Action実装 |
| `nextjs-api-routes.md` | APIルート |
| `nextjs-proxy.md` | proxy.ts |
| `nextjs-performance.md` | パフォーマンス最適化 |
| `nextjs-error-handling.md` | エラーハンドリング |
| `prisma-database.md` | DB・Prisma |
| `auth-nextauth.md` | 認証 |
| `pesticide-validation.md` | 農薬データ検証 |
| `testing.md` | テスト |
| `setup-docker.md` | Docker開発環境 |
| `comments.md` | コメント規約・WHY/WHAT判断基準 |
