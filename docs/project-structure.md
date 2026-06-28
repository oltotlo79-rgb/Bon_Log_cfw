# プロジェクト構成一覧

各ファイル・フォルダの役割を記載する。

---

## ルートディレクトリ

```
bonsai-sns-project/
```

| ファイル | 役割 |
|---------|------|
| `.dockerignore` | Dockerビルド時に除外するファイルの定義 |
| `.env` | 環境変数（本番/共通） |
| `.env.local` | ローカル開発用環境変数（Git管理外） |
| `.env.local.example` | `.env.local`のテンプレート |
| `.gitignore` | Git管理から除外するファイルの定義 |
| `.mcp.json` | MCP（Model Context Protocol）サーバー設定 |
| `CLAUDE.md` | Claude Code向けのプロジェクト指示書 |
| `README.md` | プロジェクト概要・セットアップ手順 |
| `components.json` | shadcn/uiの設定ファイル |
| `docker-compose.yml` | Docker Compose定義（PostgreSQL、Next.js） |
| `Dockerfile` | 本番用Dockerイメージ定義（fly.io デプロイ用） |
| `Dockerfile.dev` | 開発用Dockerイメージ定義 |
| `fly.toml` | fly.io デプロイ設定（app `bon-log`、リージョン nrt/東京。本番のコンピュート基盤） |
| `eslint.config.mjs` | ESLint設定 |
| `instrumentation.ts` | Next.js Instrumentation（Sentry サーバー側初期化） |
| `instrumentation-client.ts` | Next.js Instrumentation（Sentry クライアント側初期化） |
| `instrumentation.test.ts` | Instrumentation のユニットテスト（register / onRequestError） |
| `vitest.config.ts` | Vitestテスト設定 |
| `vitest.setup.tsx` | Vitestセットアップ（モック等） |
| `jest.d.ts` | Jest互換TypeScript型定義 |
| `proxy.ts` | Next.js Proxy（認証チェック、リダイレクト、セキュリティヘッダー、CSP nonce 生成 + strict-dynamic、HSTS、Origin / Referer 検証、Basic 認証、メンテナンスゲート、Sentry セキュリティイベント送信ヘルパー `reportSecurityEvent`）。Next.js 16 の proxy として実装、Edge Runtime |
| `next-env.d.ts` | Next.js TypeScript型定義（自動生成） |
| `next.config.ts` | Next.js設定（画像ドメイン、セキュリティヘッダー等） |
| `package.json` | npm依存関係・スクリプト定義 |
| `package-lock.json` | npm依存関係ロックファイル |
| `playwright.config.ts` | Playwright E2Eテスト設定 |
| `postcss.config.mjs` | PostCSS設定（Tailwind CSS用） |
| `prisma.config.ts` | Prisma設定ファイル |
| `sentry.client.config.ts` | Sentryクライアント側設定 |
| `sentry.edge.config.ts` | Sentry Edge Runtime設定 |
| `sentry.server.config.ts` | Sentryサーバー側設定 |
| `tsconfig.json` | TypeScript設定 |
| `tsconfig.check.json` | CI用型チェック設定（`__tests__` およびスクリプト・検証用TSを除外） |
| `tsconfig.tsbuildinfo` | TypeScriptビルド情報キャッシュ（自動生成） |
| `vercel.json` | Vercel 互換の cron 定義（残存）。実際の定期実行は fly.io 移行に伴い GitHub Actions（`.github/workflows/cron.yml`）で行う |
| `.lighthouserc.json` | Lighthouse CI設定 |

---

## app/ — Next.js App Routerページ・レイアウト

```
app/
├── (auth)/           # 認証ページ
├── (legal)/          # 法務・規約ページ（5ページ）
├── (main)/           # メインアプリケーション（19機能エリア）
├── (public)/         # 公開ページ
├── admin/            # 管理者ダッシュボード（28サブディレクトリ）
├── api/              # APIルート（100 ハンドラ: route.ts 99 + og/route.tsx 1。Web 用 + モバイル API v1 `/api/v1/*` 75 本）
├── auth/             # 特殊認証ページ（NextAuth コールバック）
├── maintenance/      # メンテナンスページ
└── feed.xml/         # RSSフィード（Route Handler）
```

| ファイル | 役割 |
|---------|------|
| `error.tsx` | ルートレベルのエラー表示 |
| `favicon.ico` | ファビコン |
| `feed.xml/route.ts` | RSSフィード生成（XML形式） |
| `global-error.tsx` | ルートレベルのエラーバウンダリ |
| `globals.css` | グローバルCSS（Tailwind CSS読み込み） |
| `icon.png` | アプリアイコン |
| `layout.tsx` | ルートレイアウト（html/body、プロバイダー設定） |
| `not-found.tsx` | ルート404ページ（存在しないURL・notFound()時に表示、トップへ/タイムラインへリンク） |
| `page.tsx` | ホームページ（ランディングページ） |
| `providers.tsx` | クライアントプロバイダー群（SessionProvider、ThemeProvider、ServiceWorkerRegistration等） |
| `robots.ts` | robots.txt動的生成 |
| `sitemap.ts` | サイトマップ動的生成 |

### app/(auth)/ — 認証ページ（ログイン・登録・パスワードリセット）

| ファイル | 役割 |
|---------|------|
| `layout.tsx` | 認証ページ共通レイアウト |
| `loading.tsx` | 認証ページローディング表示 |
| `login/page.tsx` | ログインページ |
| `register/page.tsx` | ユーザー登録ページ |
| `register/verify-email-sent/page.tsx` | 確認メール送信完了ページ（登録後） |
| `password-reset/page.tsx` | パスワードリセット要求ページ |
| `password-reset/confirm/page.tsx` | パスワードリセット実行ページ |
| `verify-email/page.tsx` | メールアドレス確認ページ（トークン検証） |

### app/(main)/ — メインアプリケーション（認証必須・19機能エリア）

> 機能エリア: analytics, bonsai, bookmarks, dictionary, drafts, events, explore, feed, fertilizers, hormones, messages, notifications, onboarding, pesticides, posts, search, settings, shops, users（+ 共通 layout/loading）

| ファイル | 役割 |
|---------|------|
| `layout.tsx` | 3カラムレイアウト（サイドバー、コンテンツ、右サイドバー） |
| `loading.tsx` | メインエリア共通ローディング |

> モバイル（iOS/Android）クライアントは `/api/v1/*`（Bearer JWT 認証の Route Handler）経由でアクセスする。Web 用の Server Component / Server Action とロジックを共有しつつ、認可・レスポンス形式はモバイル合意仕様に統一（`lib/api/v1/` 基盤）。

#### app/(main)/analytics/ — アナリティクス

| ファイル | 役割 |
|---------|------|
| `page.tsx` | アナリティクスダッシュボード（プレミアム機能） |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |

#### app/(main)/bonsai/ — 盆栽成長記録

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 盆栽一覧ページ |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |
| `new/page.tsx` | 盆栽新規登録ページ |
| `[id]/page.tsx` | 盆栽詳細ページ |
| `[id]/error.tsx` | エラー表示 |
| `[id]/loading.tsx` | ローディング表示 |
| `[id]/edit/page.tsx` | 盆栽編集ページ |

#### app/(main)/bookmarks/ — ブックマーク

| ファイル | 役割 |
|---------|------|
| `page.tsx` | ブックマーク一覧ページ |
| `BookmarkPostList.tsx` | ブックマーク投稿リストコンポーネント |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |

#### app/(main)/dictionary/ — 盆栽用語辞典

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 盆栽用語辞典一覧ページ |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |
| `[slug]/page.tsx` | 用語詳細ページ |
| `[slug]/error.tsx` | エラー表示 |

#### app/(main)/drafts/ — 下書き

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 下書き一覧ページ |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |
| `[id]/edit/page.tsx` | 下書き編集ページ |

#### app/(main)/events/ — イベント

| ファイル | 役割 |
|---------|------|
| `page.tsx` | イベント一覧ページ（カレンダー表示） |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |
| `new/page.tsx` | イベント新規作成ページ |
| `[id]/page.tsx` | イベント詳細ページ |
| `[id]/DeleteEventButton.tsx` | イベント削除ボタン |
| `[id]/edit/page.tsx` | イベント編集ページ |
| `[id]/error.tsx` | エラー表示 |
| `[id]/loading.tsx` | ローディング表示 |

#### app/(main)/explore/ — 発見（おすすめ・トレンド）

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 発見ページ（おすすめユーザー・トレンド・人気投稿） |

#### app/(main)/feed/ — タイムライン

| ファイル | 役割 |
|---------|------|
| `page.tsx` | タイムラインページ |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |

#### app/(main)/fertilizers/ — 肥料ガイド

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 肥料ガイドトップページ |
| `layout.tsx` | 肥料ガイドレイアウト |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |
| `absorption/page.tsx` | 養分吸収の仕組みページ |
| `categories/page.tsx` | 肥料カテゴリ一覧ページ |
| `columns/page.tsx` | 肥料コラム一覧ページ |
| `columns/[slug]/page.tsx` | 肥料コラム詳細ページ |
| `nutrients/page.tsx` | 栄養素一覧ページ |
| `nutrients/[slug]/page.tsx` | 栄養素詳細ページ |
| `products/page.tsx` | 肥料製品一覧ページ |
| `schedules/page.tsx` | 施肥スケジュール一覧ページ |
| `schedules/[slug]/page.tsx` | 樹種別施肥スケジュール詳細ページ |
| `soil/page.tsx` | 用土・土壌ページ |
| `symptoms/page.tsx` | 栄養障害の症状ページ |
| `troubles/page.tsx` | 施肥トラブル対処ページ |
| `watering/page.tsx` | 水やり管理ページ |

#### app/(main)/hormones/ — 植物ホルモンガイド

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 植物ホルモンガイドトップページ |
| `layout.tsx` | 植物ホルモンガイドレイアウト |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |
| `[slug]/page.tsx` | ホルモン詳細ページ |
| `techniques/page.tsx` | 盆栽技法×ホルモンマッピングページ（9技法: 摘芯・剪定・針金掛け・植替え・葉刈り・取り木・挿し木・水やり管理・日照管理） |
| `diagram/page.tsx` | ホルモン相互作用ダイアグラム（ノードグラフ可視化） |
| `calendar/page.tsx` | 年間ホルモン活性カレンダー（月別変動チャート） |
| `simulator/page.tsx` | ホルモンバランスシミュレーター（技法選択で変動を可視化） |
| `interactions/page.tsx` | ホルモン相互作用ページ |
| `columns/page.tsx` | ホルモンコラム一覧ページ |
| `columns/[slug]/page.tsx` | ホルモンコラム詳細ページ |

#### app/(main)/messages/ — ダイレクトメッセージ

| ファイル | 役割 |
|---------|------|
| `page.tsx` | メッセージ一覧ページ |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |
| `[conversationId]/page.tsx` | 会話詳細ページ |
| `[conversationId]/error.tsx` | エラー表示 |
| `[conversationId]/loading.tsx` | ローディング表示 |

#### app/(main)/notifications/ — 通知

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 通知一覧ページ |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |

#### app/(main)/onboarding/ — オンボーディング

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 新規ユーザー向けオンボーディングフロー（初回プロフィール設定・おすすめフォロー等） |

#### app/(main)/pesticides/ — 農薬・病害虫（ログインユーザー向け、ゲストはオーバーレイで制限）

| ファイル | 役割 |
|---------|------|
| `layout.tsx` | 農薬エリア用レイアウト（ゲストは GuestRestrictionOverlay で制限） |
| `error.tsx` | エラー表示 |
| `page.tsx` | 農薬・病害虫トップ（検索・病害虫グリッド・結果表示） |
| `PesticideSearchForm.tsx` | 薬剤検索フォーム（キーワード・タイプ絞り） |
| `PesticideAllList.tsx` | 全薬剤一覧表示 |
| `PesticideResults.tsx` | 薬剤検索結果一覧 |
| `SpreaderResults.tsx` | 展着剤一覧表示（Client Component、分類リンク付き） |
| `DiseasePestGrid.tsx` | 病害虫から探すグリッド |
| `products/page.tsx` | 薬剤一覧ページ（薬剤タブ／展着剤タブ `?tab=spreaders`） |
| `products/ProductsPageTabs.tsx` | 薬剤・展着剤タブ切替UI |
| `products/ProductSearchForm.tsx` | 薬剤一覧用検索フォーム |
| `products/[slug]/page.tsx` | 薬剤製品詳細ページ（効果のある病害虫は病害虫図鑑へのリンク） |
| `diseases-pests/page.tsx` | 病害虫図鑑一覧 |
| `diseases-pests/DiseasePestList.tsx` | 病害虫リスト |
| `diseases-pests/[slug]/page.tsx` | 病害虫詳細（効く薬剤表示） |
| `ingredients/page.tsx` | 原体一覧ページ |
| `ingredients/IngredientSearchForm.tsx` | 原体検索フォーム |
| `ingredients/[slug]/page.tsx` | 原体詳細ページ |
| `formulations/page.tsx` | 剤型の違い（剤型クリックで `?formulation=CODE` の薬剤一覧） |
| `spreaders/page.tsx` | 展着剤（型一覧、型クリックで `?type=slug` の展着剤一覧） |
| `spreaders/[slug]/page.tsx` | 展着剤詳細。製品slugは `/pesticides/products/[slug]` へリダイレクト |
| `columns/page.tsx` | コラム一覧 |
| `columns/[slug]/page.tsx` | コラム詳細 |
| `dilution-calculator/page.tsx` | 希釈倍率計算ツール |
| `mixing-checker/page.tsx` | 混用可否チェッカー |
| `spray-guide/page.tsx` | 散布ガイドページ |

#### app/(main)/posts/ — 投稿

| ファイル | 役割 |
|---------|------|
| `[id]/page.tsx` | 投稿詳細ページ |
| `[id]/error.tsx` | エラー表示 |
| `[id]/loading.tsx` | ローディング表示 |
| `[id]/not-found.tsx` | 投稿が見つからない場合の404ページ |
| `scheduled/page.tsx` | 予約投稿一覧ページ |
| `scheduled/error.tsx` | エラー表示 |
| `scheduled/loading.tsx` | ローディング表示 |
| `scheduled/new/page.tsx` | 予約投稿作成ページ |
| `scheduled/[id]/page.tsx` | 予約投稿詳細ページ |
| `scheduled/[id]/edit/page.tsx` | 予約投稿編集ページ |

#### app/(main)/search/ — 検索

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 検索ページ |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |

#### app/(main)/settings/ — 設定

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 設定メニューページ |
| `error.tsx` | エラー表示 |
| `account/page.tsx` | アカウント設定（メール変更、パスワード変更、アカウント削除） |
| `account/loading.tsx` | ローディング表示 |
| `blocked/page.tsx` | ブロック一覧ページ |
| `blocked/loading.tsx` | ローディング表示 |
| `follow-requests/page.tsx` | フォローリクエスト管理ページ |
| `follow-requests/FollowRequestsClient.tsx` | フォローリクエストクライアントコンポーネント |
| `follow-requests/loading.tsx` | ローディング表示 |
| `muted/page.tsx` | ミュート一覧ページ |
| `muted/loading.tsx` | ローディング表示 |
| `notifications/page.tsx` | 通知設定ページ |
| `profile/page.tsx` | プロフィール編集ページ |
| `profile/loading.tsx` | ローディング表示 |
| `security/page.tsx` | セキュリティ設定ページ（2段階認証） |
| `security/loading.tsx` | ローディング表示 |
| `subscription/page.tsx` | プレミアム会員管理ページ |
| `subscription/loading.tsx` | ローディング表示 |

#### app/(main)/shops/ — 盆栽園マップ

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 盆栽園マップページ |
| `ShopSearchForm.tsx` | 盆栽園検索フォーム |
| `error.tsx` | エラー表示 |
| `loading.tsx` | ローディング表示 |
| `new/page.tsx` | 盆栽園新規登録ページ |
| `[id]/page.tsx` | 盆栽園詳細ページ |
| `[id]/error.tsx` | エラー表示 |
| `[id]/loading.tsx` | ローディング表示 |
| `[id]/edit/page.tsx` | 盆栽園編集ページ |

#### app/(main)/users/ — ユーザープロフィール

| ファイル | 役割 |
|---------|------|
| `[id]/page.tsx` | ユーザープロフィールページ |
| `[id]/error.tsx` | エラー表示 |
| `[id]/loading.tsx` | ローディング表示 |
| `[id]/followers/page.tsx` | フォロワー一覧ページ |
| `[id]/following/page.tsx` | フォロー中一覧ページ |
| `[id]/likes/page.tsx` | いいねした投稿一覧ページ |
| `[id]/posts/page.tsx` | ユーザーの投稿一覧ページ |

### app/(public)/ — 公開ページ（認証不要）

| ファイル | 役割 |
|---------|------|
| `layout.tsx` | 公開ページ共通レイアウト |
| `about/page.tsx` | BON-LOGについてページ |
| `contact/page.tsx` | お問い合わせページ |
| `help/page.tsx` | ヘルプページ |

### app/(legal)/ — 法務・規約ページ

| ファイル | 役割 |
|---------|------|
| `layout.tsx` | 法務ページ共通レイアウト |
| `error.tsx` | 法務ページエラー表示 |
| `accessibility/page.tsx` | アクセシビリティページ |
| `account-deletion/page.tsx` | アカウント削除のご案内（Google Play デベロッパーポリシー要件。ログイン不要・クロール可能、設定からの削除手順とログインなし削除依頼・削除/保持データを案内） |
| `privacy/page.tsx` | プライバシーポリシー |
| `terms/page.tsx` | 利用規約 |
| `tokushoho/page.tsx` | 特定商取引法に基づく表記 |

### app/admin/ — 管理者ダッシュボード（28サブディレクトリ + ダッシュボード）

| ファイル | 役割 |
|---------|------|
| `layout.tsx` | 管理者レイアウト（権限チェック、管理者ナビゲーション） |
| `loading.tsx` | ローディング表示 |
| `page.tsx` | 管理者ダッシュボード（統計概要 + アクセス推移グラフ 30/90/180 日切替） |
| `error.tsx` | エラー表示 |
| `SentryErrors.tsx` | Sentryエラー表示コンポーネント |
| `DailyVisitorsChart.tsx` | 日次訪問者推移グラフ（`next/dynamic` で SSR 回避、recharts エリアチャート、ライト/ダーク対応） |
| `DailyVisitorsChartInner.tsx` | グラフの実体（Client Component） |

#### app/admin/analytics/ — アナリティクス

| ファイル | 役割 |
|---------|------|
| `cohort/page.tsx` | コホート分析ページ |
| `cohort/CohortTable.tsx` | コホートテーブルコンポーネント |
| `cohort/loading.tsx` | ローディング表示 |
| `content/page.tsx` | コンテンツアナリティクスページ |
| `content/ContentAnalyticsClient.tsx` | コンテンツ分析クライアントコンポーネント |
| `content/loading.tsx` | ローディング表示 |

#### app/admin/announcements/ — お知らせ管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | お知らせ管理ページ |
| `AnnouncementList.tsx` | お知らせリストコンポーネント |
| `loading.tsx` | ローディング表示 |

#### app/admin/backups/ — バックアップ管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | バックアップ管理ページ |
| `loading.tsx` | ローディング表示 |

#### app/admin/blacklist/ — ブラックリスト管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | ブラックリスト管理ページ |
| `BlacklistTabs.tsx` | メール/デバイスブラックリストタブ切替 |

#### app/admin/contact/ — お問い合わせ管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | お問い合わせ一覧ページ |
| `ContactActionsDropdown.tsx` | お問い合わせアクションメニュー |
| `[id]/page.tsx` | お問い合わせ詳細ページ |
| `[id]/ContactDetailActions.tsx` | 詳細ページアクション |

#### app/admin/content-management/ — CMS管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | CMS管理ページ |
| `CmsPageList.tsx` | CMSページリストコンポーネント |
| `loading.tsx` | ローディング表示 |

#### app/admin/events/ — イベント管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | イベント管理一覧ページ |
| `loading.tsx` | ローディング表示 |
| `EventActionsDropdown.tsx` | イベントアクションメニュー |
| `import/page.tsx` | イベントCSVインポートページ |
| `import/EventImportClient.tsx` | インポートクライアントコンポーネント |

#### app/admin/hidden/ — 非表示コンテンツ管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 非表示コンテンツ一覧ページ |
| `AdminNotificationBanner.tsx` | 管理者通知バナー |
| `HiddenContentList.tsx` | 非表示コンテンツリスト |

#### app/admin/ip-management/ — IP管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | IP管理ページ |
| `IpManagementClient.tsx` | IP管理クライアントコンポーネント |
| `loading.tsx` | ローディング表示 |

#### app/admin/logs/ — 管理者ログ

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 管理者操作ログ一覧ページ |

#### app/admin/maintenance/ — メンテナンスモード

| ファイル | 役割 |
|---------|------|
| `page.tsx` | メンテナンスモード管理ページ |
| `MaintenanceForm.tsx` | メンテナンス設定フォーム |

#### app/admin/moderation-queue/ — モデレーションキュー

| ファイル | 役割 |
|---------|------|
| `page.tsx` | モデレーションキューページ |
| `ModerationQueueList.tsx` | モデレーションキューリストコンポーネント |
| `loading.tsx` | ローディング表示 |

#### app/admin/monitoring/ — 監視

| ファイル | 役割 |
|---------|------|
| `page.tsx` | システム監視ページ |

#### app/admin/ng-words/ — NGワード管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | NGワード管理ページ |
| `NgWordList.tsx` | NGワードリストコンポーネント |
| `loading.tsx` | ローディング表示 |

#### app/admin/pesticide-data/ — 農薬データ管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 農薬データ管理ページ |
| `PesticideTable.tsx` | 農薬テーブルコンポーネント |
| `loading.tsx` | ローディング表示 |
| `[id]/page.tsx` | 農薬データ詳細ページ |

#### app/admin/posts/ — 投稿管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 投稿管理一覧ページ |
| `loading.tsx` | ローディング表示 |
| `PostActionsDropdown.tsx` | 投稿アクションメニュー（削除等） |

#### app/admin/premium/ — プレミアム会員管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | プレミアム会員一覧ページ |
| `PremiumActionsDropdown.tsx` | プレミアム会員アクションメニュー |
| `GrantPremiumPanel.tsx` | 任意ユーザーへのプレミアム会員権付与UI（ユーザー検索 → 期間指定で付与） |

#### app/admin/reports/ — 通報管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 通報一覧ページ |
| `loading.tsx` | ローディング表示 |
| `ReportActionsDropdown.tsx` | 通報アクションメニュー（ステータス変更等） |

#### app/admin/reviews/ — レビュー管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | レビュー管理一覧ページ |
| `ReviewActionsDropdown.tsx` | レビューアクションメニュー |

#### app/admin/roles/ — ロール管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | ロール管理ページ |
| `RolesTable.tsx` | ロールテーブルコンポーネント |
| `loading.tsx` | ローディング表示 |

#### app/admin/security/ — セキュリティ管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | セキュリティ管理ページ |
| `SecurityEventList.tsx` | セキュリティイベントリストコンポーネント |
| `loading.tsx` | ローディング表示 |

#### app/admin/segments/ — ユーザーセグメント

| ファイル | 役割 |
|---------|------|
| `page.tsx` | ユーザーセグメントページ |
| `SegmentBuilder.tsx` | セグメントビルダーコンポーネント |
| `loading.tsx` | ローディング表示 |

#### app/admin/shop-requests/ — 盆栽園変更リクエスト管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 変更リクエスト一覧ページ |
| `ShopRequestActions.tsx` | リクエスト承認/拒否アクション |

#### app/admin/shops/ — 盆栽園管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 盆栽園管理一覧ページ |
| `loading.tsx` | ローディング表示 |
| `ShopActionsDropdown.tsx` | 盆栽園アクションメニュー |

#### app/admin/stats/ — 統計

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 統計ダッシュボードページ |
| `StatsCharts.tsx` | 統計グラフコンポーネント |
| `StatsChartsWrapper.tsx` | 統計グラフラッパー（動的インポート） |

#### app/admin/usage/ — システム利用統計

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 利用統計ページ |
| `UsageCards.tsx` | 利用統計カード表示 |

#### app/admin/users/ — ユーザー管理

| ファイル | 役割 |
|---------|------|
| `page.tsx` | ユーザー管理一覧ページ |
| `loading.tsx` | ローディング表示 |
| `UserActionsDropdown.tsx` | ユーザーアクションメニュー（停止/削除等） |
| `[id]/page.tsx` | ユーザー詳細ページ |
| `[id]/UserDetailActions.tsx` | ユーザー詳細アクション |
| `[id]/activity/page.tsx` | ユーザー活動履歴ページ |

#### app/admin/warnings/ — ユーザー警告

| ファイル | 役割 |
|---------|------|
| `page.tsx` | 警告管理ページ |
| `WarningsList.tsx` | 警告リストコンポーネント |
| `IssueWarningDialog.tsx` | 警告発行ダイアログ |
| `loading.tsx` | ローディング表示 |

### app/api/ — APIルート（合計 100 ハンドラ: `route.ts` 99 + `og/route.tsx` 1 + 別途 `/feed.xml` の RSS ルート）

トップレベルグループ: `ad-frame`, `admin`, `analytics`, `auth`, `badges`, `cron`, `health`, `maintenance`, `og`, `push`, `upload`, `v1`（モバイル API・75 route）, `webhooks`。`upload/_shared/` に共有ヘルパー 3 本（Next.js ルート対象外）。モバイル v1 の共有基盤は `lib/api/`（旧記述にあった `app/api/_shared` は存在しない）。

#### Web 用 API（`/api/v1` 以外、25 route + 共有ヘルパー 3）

| ファイル | 役割 |
|---------|------|
| `auth/[...nextauth]/route.ts` | NextAuth.js認証エンドポイント |
| `upload/route.ts` | 汎用ファイルアップロード（`_shared/validate-upload-file.ts` で検証順序を共通化） |
| `upload/avatar/route.ts` | アバター画像アップロード（`_shared/profile-image-upload.ts` 経由） |
| `upload/header/route.ts` | ヘッダー画像アップロード（同上） |
| `upload/presigned/route.ts` | R2 presigned URL発行（フォルダ ホワイトリスト検証付き） |
| `upload/_shared/profile-image-upload.ts` | アバター / ヘッダー処理の共有ロジック（Next.js ルート対象外） |
| `upload/_shared/validate-upload-file.ts` | アップロードファイル検証の共有ヘルパー（MIME / マジックバイト / サイズ。検証順序を統一） |
| `upload/_shared/require-upload-user.ts` | upload 系 Route Handler のユーザー認証 / 認可ガードの共有ヘルパー（`requireActiveNonGuestUser` で認証 + 停止 + 非ゲストを確認。未認証 401 / 停止・ゲスト 403 を `NextResponse` で返す。Next.js ルート対象外） |
| `cron/publish-scheduled/route.ts` | 予約投稿の自動公開（Cron） |
| `cron/check-subscriptions/route.ts` | サブスクリプション状態確認（Cron） |
| `cron/cleanup-events/route.ts` | 終了イベント自動クリーンアップ（Cron） |
| `cron/update-weather/route.ts` | 天気データ更新（Open-Meteo連携、盆栽管理アドバイス生成） |
| `webhooks/stripe/route.ts` | Stripe Webhook受信（署名検証 + 冪等性ガード） |
| `webhooks/revenuecat/route.ts` | RevenueCat Webhook受信（モバイル課金。共有シークレットの `timingSafeEqual` 検証 + IP レート制限 + `webhook_events` 冪等性ガード。`lib/services/revenuecat.ts` で isPremium/期限を更新） |
| `health/route.ts` | ヘルスチェック |
| `maintenance/status/route.ts` | メンテナンスモード状態確認 |
| `badges/route.ts` | 未読通知数・未読メッセージ数（直近200会話で概算、messagesCapReachedで200+表示用） |
| `ad-frame/route.ts` | AdSense広告用iframeレンダリング |
| `og/route.tsx` | OG画像動的生成（`next/og` の `ImageResponse`、Next.js 16 デフォルトの Node.js ランタイム） |
| `push/vapid-key/route.ts` | Web Push VAPID公開鍵取得 |
| `analytics/track/route.ts` | 日次の実訪問者ログ記録（HttpOnly Cookie の opaque UUID で識別、PII 非格納、`daily_visitors` テーブルへ upsert） |
| `analytics/view/route.ts` | 投稿 / プロフィール閲覧 beacon の受信口（Server Component から書き込みを分離）。`lib/services/analytics-recording.ts` 経由で `user_analytics` を集計。Zod discriminated union + Redis dedupe + block / 非公開ガード |
| `admin/sentry/route.ts` | Sentryエラー情報取得（管理者用） |
| `admin/usage/route.ts` | システム利用統計API |
| `admin/seed-pesticide/route.ts` | 農薬・病害虫シードデータ投入API（管理者用、Bearer 認証 + maxDuration=300） |
| `admin/seed/route.ts` | 薬剤以外（ジャンル / 辞典 / 肥料 / ホルモン / ゲスト）の統合シード投入API（管理者用、Bearer 認証 + maxDuration=300、`{ domain }` リクエスト） |
| `admin/apply-migration/route.ts` | 一回限りのマイグレーション適用バックドア（管理者用、Bearer 認証、allowlist 内 SQL のみ実行可、すべて `IF NOT EXISTS` で冪等） |
| `admin/search/setup/route.ts` | 検索（FTS）セットアップAPI（管理者用） |

#### モバイル API v1（`/api/v1/*`、75 route）

iOS/Android アプリ向けの Route Handler 群。`lib/api/v1/` の基盤（Bearer JWT 認証 `requireBearerUser`、統一エラーレスポンス `apiError`、`{ items, nextCursor }` ページネーション）を共有し、ドメインロジックは Web と同じ `lib/services/` を再利用する。proxy.ts の保護対象外のため各 route 内で fail-closed の認証・認可を実施する。

| ディレクトリ | 役割 |
|---------|------|
| `v1/auth/login`, `auth/register`, `auth/logout`, `auth/refresh` | メール/パスワード認証・登録・ログアウト・アクセストークン更新（トークンペア発行） |
| `v1/auth/2fa/verify` | ログイン 2 段階目（TOTP）検証。`lib/api/v1/mobile-2fa-ticket.ts` の一時チケットを消費 |
| `v1/auth/google` | Google OAuth（ID トークン）ログイン |
| `v1/auth/password-reset/request`, `password-reset/confirm` | パスワードリセット要求・実行 |
| `v1/auth/verify-email/resend` | メール確認トークン再送 |
| `v1/feed` | タイムライン取得 |
| `v1/posts`, `posts/[id]` | 投稿の作成・一覧・取得・更新・削除 |
| `v1/posts/[id]/like`, `posts/[id]/bookmark` | 投稿のいいね・ブックマーク |
| `v1/posts/[id]/comments`, `posts/[id]/comments/[commentId]` | コメントの一覧・作成・取得・削除 |
| `v1/explore/posts`, `explore/trending-hashtags`, `explore/trending-genres`, `explore/recommended-users` | 発見（人気投稿・トレンドタグ/ジャンル・おすすめユーザー） |
| `v1/search/posts`, `search/users` | 投稿・ユーザー検索 |
| `v1/users/[id]`, `users/me` | ユーザープロフィール取得・自プロフィール取得/更新 |
| `v1/users/[id]/follow`, `users/[id]/block`, `users/[id]/mute` | フォロー・ブロック・ミュート |
| `v1/users/me/blocks`, `users/me/mutes`, `users/me/bookmarks` | 自分のブロック/ミュート/ブックマーク一覧 |
| `v1/users/me/follow-requests`, `follow-requests/[id]/approve`, `follow-requests/[id]/reject` | フォローリクエスト一覧・承認・拒否 |
| `v1/users/me/notification-settings` | 通知設定の取得・更新 |
| `v1/notifications`, `notifications/unread-count`, `notifications/read` | 通知一覧・未読件数・既読化 |
| `v1/devices`, `devices/[token]` | モバイル Push デバイス（Expo トークン）の登録・削除 |
| `v1/bonsai`, `bonsai/[id]`, `bonsai/[id]/records`, `bonsai/[id]/records/[recordId]` | 盆栽 CRUD・成長記録 |
| `v1/bonsai/care-logs`, `care-logs/[logId]` | 盆栽手入れログ |
| `v1/events`, `events/[id]` | イベント一覧・詳細 |
| `v1/shops`, `shops/[id]`, `shops/[id]/reviews` | 盆栽園一覧・詳細・レビュー |
| `v1/scheduled-posts`, `scheduled-posts/[id]`, `scheduled-posts/[id]/cancel` | 予約投稿の一覧・CRUD・キャンセル |
| `v1/reports` | 通報 |
| `v1/upload/presigned`, `upload/image` | R2 presigned URL 発行・画像アップロード |
| `v1/genres` | ジャンルマスタ |
| `v1/dictionary`, `dictionary/[slug]` | 盆栽用語辞典 |
| `v1/fertilizers/categories`, `fertilizers/nutrients`, `nutrients/[slug]`, `fertilizers/tree-species`, `tree-species/[slug]/schedule` | 肥料ガイド |
| `v1/hormones`, `hormones/[slug]` | 植物ホルモンガイド |
| `v1/pesticides/products`, `products/[slug]`, `disease-pests`, `disease-pests/[slug]`, `ingredients`, `ingredients/[slug]` | 農薬・病害虫図鑑 |
| `v1/analytics/summary` | アナリティクスサマリー（プレミアム） |
| `v1/legal`, `legal/[slug]` | 法務文書（規約・プライバシー等） |

### app/auth/ — 特殊認証ページ

| ファイル | 役割 |
|---------|------|
| `callback/route.ts` | 認証コールバック処理 |

### app/maintenance/ — メンテナンスページ

| ファイル | 役割 |
|---------|------|
| `page.tsx` | メンテナンス中表示ページ |
| `logout-button.tsx` | メンテナンス中のログアウトボタン |

---

## components/ — Reactコンポーネント（283ファイル: .tsx 268 / .ts 15、35サブディレクトリ）

> サブディレクトリ: admin, ads, analytics, animation, auth, bonsai, comment, common, contact, dictionary, draft, event, feed, fertilizer, help, hormone, landing, layout, message, notification, onboarding, pesticide, post, premium, pwa, report, search, seo, settings, shop, subscription, theme, ui, user, weather

### components/ ルートファイル

| ファイル | 役割 |
|---------|------|
| `SakuraAnimation.tsx` | 季節背景アニメーション（桜・紅葉・雪・綿毛・雨・水面の波紋、デフォルトは季節自動切替） |

### components/admin/ — 管理画面共通

| ファイル | 役割 |
|---------|------|
| `CursorPagination.tsx` | 管理者一覧のカーソルベースページネーションUI |

### components/ads/ — 広告

| ファイル | 役割 |
|---------|------|
| `AdBanner.tsx` | フィード内インフィード広告バナー |
| `AdProvider.tsx` | 広告プロバイダー（スクリプト読み込み管理） |
| `GoogleAdSense.tsx` | Google AdSense汎用広告コンポーネント |
| `InFeedAdSlot.tsx` | タイムライン挿入用インフィード広告スロット |
| `NinjaAdMax.tsx` | 忍者AdMax広告コンポーネント |
| `index.ts` | エクスポートまとめ |

### components/analytics/ — アナリティクス

| ファイル | 役割 |
|---------|------|
| `AnalyticsDashboard.tsx` | アナリティクスダッシュボード全体 |
| `BestTimeCard.tsx` | ベスト投稿時間帯カード |
| `FollowerGrowthChart.tsx` | フォロワー推移グラフ |
| `GenreChart.tsx` | ジャンル分布チャート |
| `KeywordCloud.tsx` | キーワードクラウド表示 |
| `LikeChart.tsx` | いいね数推移グラフ |
| `PeriodFilter.tsx` | 期間フィルター |
| `QuoteList.tsx` | 引用投稿一覧 |
| `StatCard.tsx` | 統計値カード |
| `TimeHeatmap.tsx` | 投稿時間帯ヒートマップ |
| `TopPostsList.tsx` | 人気投稿一覧 |
| `WebVitals.tsx` | Core Web Vitals計測コンポーネント |

### components/animation/ — アニメーション

| ファイル | 役割 |
|---------|------|
| `particle-factory.ts` | パーティクル生成ファクトリ |
| `particle-renderers.ts` | パーティクルレンダラー群 |

### components/auth/ — 認証

| ファイル | 役割 |
|---------|------|
| `LoginForm.tsx` | ログインフォーム（メール/パスワード + Googleソーシャルログイン） |
| `LogoutButton.tsx` | ログアウトボタン |
| `PasswordResetConfirmForm.tsx` | パスワードリセット実行フォーム |
| `PasswordResetForm.tsx` | パスワードリセット要求フォーム |
| `PasswordResetStates.tsx` | パスワードリセット状態表示コンポーネント |
| `PasswordVisibilityToggle.tsx` | パスワード表示/非表示トグル |
| `RegisterForm.tsx` | ユーザー登録フォーム（メール/パスワード + Googleソーシャルログイン） |
| `TwoFactorStep.tsx` | ログイン 2 段階目（TOTP コード入力）ステップUI |

### components/bonsai/ — 盆栽成長記録

| ファイル | 役割 |
|---------|------|
| `BonsaiActions.tsx` | 盆栽操作メニュー（編集/削除） |
| `BonsaiForm.tsx` | 盆栽登録/編集フォーム |
| `BonsaiListClient.tsx` | 盆栽一覧クライアントコンポーネント |
| `BonsaiRecordForm.tsx` | 成長記録追加フォーム |
| `BonsaiSearch.tsx` | 盆栽検索フォーム |
| `BonsaiTimeline.tsx` | 成長記録タイムライン表示 |

### components/comment/ — コメント

| ファイル | 役割 |
|---------|------|
| `CommentActions.tsx` | コメント操作メニュー（削除等） |
| `CommentCard.tsx` | コメント表示カード |
| `CommentContent.tsx` | コメント本文表示 |
| `CommentForm.tsx` | コメント入力フォーム |
| `CommentHeader.tsx` | コメントヘッダー（ユーザー名・日時） |
| `CommentLikeButton.tsx` | コメントいいねボタン |
| `CommentList.tsx` | コメント一覧 |
| `CommentReplySection.tsx` | コメントリプライセクション |
| `CommentThread.tsx` | コメントスレッド（リプライチェーン）表示 |
| `DeletedCommentPlaceholder.tsx` | 削除済みコメントプレースホルダー表示 |
| `ThreadMuteButton.tsx` | スレッドミュートボタン |
| `index.ts` | エクスポートまとめ |

### components/common/ — 共通コンポーネント

| ファイル | 役割 |
|---------|------|
| `Breadcrumb.tsx` | パンくずリストUIコンポーネント（JSON-LD構造化データ統合） |
| `FormError.tsx` | フォームエラー表示コンポーネント |
| `KeyboardShortcutsHelp.tsx` | キーボードショートカット一覧モーダル |
| `KeyboardShortcutsProvider.tsx` | グローバルキーボードショートカット管理プロバイダー |
| `LoadingScreen.tsx` | 全画面ローディング表示 |
| `MentionTextarea.tsx` | @メンション対応テキストエリア |
| `GuestRestrictionOverlay.tsx` | ゲストユーザー向け制限オーバーレイ（ログイン促し） |
| `OptimizedImage.tsx` | 最適化画像コンポーネント |
| `PageError.tsx` | ページエラー表示コンポーネント（Sentry送信対応、枯山水イラスト付き） |
| `InkRippleInit.tsx` | 墨滴リップルエフェクト初期化（btn-washiクリック時に墨の波紋アニメーション） |
| `SeasonalBanner.tsx` | 季節バナーコンポーネント（月に応じた水墨画を自動切替、下端フェードアウト） |
| `SharedMediaUploadSection.tsx` | メディアアップロード共通セクション |
| `SkipLink.tsx` | アクセシビリティ用スキップリンク（キーボードナビゲーション） |
| `CookieConsent.tsx` | Cookie同意バナー（GDPR準拠、localStorage管理、同意前は広告/分析スクリプト非ロード） |
| `index.ts` | エクスポートまとめ |

### components/contact/ — お問い合わせ

| ファイル | 役割 |
|---------|------|
| `ContactForm.tsx` | お問い合わせフォーム |

### components/dictionary/ — 辞書・用語検索

| ファイル | 役割 |
|---------|------|
| `DictionarySearch.tsx` | 用語・辞書検索コンポーネント |

### components/draft/ — 下書き

| ファイル | 役割 |
|---------|------|
| `DraftCard.tsx` | 下書きカード表示 |
| `DraftEditForm.tsx` | 下書き編集フォーム |

### components/event/ — イベント

| ファイル | 役割 |
|---------|------|
| `DeleteEventButton.tsx` | イベント削除ボタン |
| `EventActionsDropdown.tsx` | イベント操作メニュー |
| `EventCalendar.tsx` | イベントカレンダー表示 |
| `EventCalendarWrapper.tsx` | カレンダーラッパー（動的インポート） |
| `EventCard.tsx` | イベントカード表示 |
| `EventFilterPersistence.tsx` | フィルター状態永続化 |
| `EventForm.tsx` | イベント作成/編集フォーム |
| `EventList.tsx` | イベント一覧 |
| `RegionFilter.tsx` | 地域フィルター（8地方ブロック） |
| `ShowPastToggle.tsx` | 過去イベント表示切替トグル |

### components/feed/ — タイムライン

| ファイル | 役割 |
|---------|------|
| `ComposeButton.tsx` | 投稿作成ボタン（モバイル用FAB） |
| `EmptyTimeline.tsx` | タイムライン空状態表示 |
| `FeedWithCompose.tsx` | 投稿フォーム付きフィード |
| `Timeline.tsx` | タイムライン（無限スクロール） |
| `TimelineSkeleton.tsx` | タイムラインスケルトンローダー |

### components/fertilizer/ — 肥料ガイド

| ファイル | 役割 |
|---------|------|
| `CategoryComparisonTable.tsx` | 肥料カテゴリ比較テーブル |
| `FertilizationCalendar.tsx` | 施肥カレンダーコンポーネント |
| `FertilizerActionBadge.tsx` | 肥料アクションバッジ |
| `FertilizerDisclaimer.tsx` | 肥料情報の免責表示 |
| `NutrientCard.tsx` | 栄養素カード表示 |
| `NutrientCategoryBadge.tsx` | 栄養素カテゴリバッジ |
| `NutrientLevelIndicator.tsx` | 栄養素レベルインジケーター |
| `TreeSpeciesCard.tsx` | 樹種カード表示 |

### components/help/ — ヘルプ

| ファイル | 役割 |
|---------|------|
| `HelpFaqSearch.tsx` | ヘルプ/FAQ 検索コンポーネント |
| `HelpIcons.tsx` | ヘルプページ用アイコンコンポーネント |

### components/hormone/ — 植物ホルモンガイド

| ファイル | 役割 |
|---------|------|
| `HormoneCard.tsx` | ホルモンカード表示 |
| `HormoneCategoryBadge.tsx` | ホルモンカテゴリバッジ |
| `HormoneDisclaimer.tsx` | ホルモン情報の免責表示 |
| `HormoneEffectList.tsx` | ホルモン効果一覧 |
| `HormoneInteractionCard.tsx` | ホルモン相互作用カード |
| `HormoneInteractionDiagram.tsx` | ホルモン相互作用ノードグラフ可視化 |
| `HormoneSeasonalChart.tsx` | ホルモン季節別チャート |
| `HormoneAnnualCalendar.tsx` | 年間ホルモン活性カレンダー |
| `HormoneTechniqueCard.tsx` | 盆栽技法×ホルモン効果カード |
| `HormoneBalanceSimulator.tsx` | ホルモンバランスシミュレーター（数値→レベル変換は `SIMULATOR_LEVEL_THRESHOLDS` 定数から導出してマジックナンバー排除） |

### components/landing/ — ランディングページ演出

| ファイル | 役割 |
|---------|------|
| `SumiStrokeReveal.tsx` | 墨筆ストロークアニメーション（Intersection Observer連動、SVG stroke-dashoffsetで筆が走る演出） |

### components/layout/ — レイアウト

| ファイル | 役割 |
|---------|------|
| `Header.tsx` | ヘッダーバー |
| `MobileNav.tsx` | モバイル用ボトムナビゲーション（`MenuLink` / `InkSeparator` / `AccordionToggle` / `ActiveBarIndicator` / `InkOrnament` 等の内部プレゼンテーション分割で重複排除済み） |
| `RightSidebar.tsx` | 右サイドバー（トレンド、おすすめユーザー、天気アドバイス等） |
| `Sidebar.tsx` | 左サイドバー（メインナビゲーション） |

### components/message/ — ダイレクトメッセージ

| ファイル | 役割 |
|---------|------|
| `MessageBadge.tsx` | 未読メッセージバッジ |
| `MessageButton.tsx` | メッセージ送信ボタン |
| `MessageForm.tsx` | メッセージ入力フォーム |
| `MessageList.tsx` | メッセージ一覧 |

### components/notification/ — 通知

| ファイル | 役割 |
|---------|------|
| `NotificationBadge.tsx` | 未読通知バッジ |
| `NotificationItem.tsx` | 通知アイテム表示 |
| `NotificationList.tsx` | 通知一覧 |

### components/onboarding/ — オンボーディング

| ファイル | 役割 |
|---------|------|
| `OnboardingComplete.tsx` | オンボーディング完了表示・遷移コンポーネント |

### components/pesticide/ — 農薬・病害虫

| ファイル | 役割 |
|---------|------|
| `PesticideDisclaimer.tsx` | 農薬情報の免責表示 |
| `EffectRatingBadge.tsx` | 効果評価バッジ（◎○△×等） |
| `DiseasePestImageLightbox.tsx` | 病害虫画像ライトボックス |

### components/post/ — 投稿

| ファイル | 役割 |
|---------|------|
| `BookmarkButton.tsx` | ブックマークボタン |
| `CharacterCountRing.tsx` | 文字数カウントリング表示 |
| `DeletePostButton.tsx` | 投稿削除ボタン |
| `GenreSelector.tsx` | ジャンル選択コンポーネント |
| `ImageGallery.tsx` | 画像ギャラリー表示 |
| `InkDropOverlay.tsx` | 墨の滴る投稿送信エフェクト（clip-pathアニメーションによる全画面オーバーレイ） |
| `LikeButton.tsx` | いいねボタン |
| `MediaPreviewGrid.tsx` | メディアプレビューグリッド |
| `PollDisplay.tsx` | 投票表示・投票コンポーネント |
| `PollForm.tsx` | 投票作成フォーム |
| `PostCard.tsx` | 投稿カード表示 |
| `PostCard.types.ts` | 投稿カード型定義 |
| `PostCardActions.tsx` | 投稿カードアクションメニュー |
| `PostCardHeader.tsx` | 投稿カードヘッダー |
| `PostCardIcons.tsx` | 投稿カードのアイコンボタン群（いいね・ブックマーク・その他） |
| `PostForm.tsx` | 投稿作成フォーム |
| `PostFormModal.tsx` | 投稿作成モーダル（墨滴エフェクト統合） |
| `QuotedPost.tsx` | 引用投稿表示 |
| `ScheduledPostCard.tsx` | 予約投稿カード |
| `ScheduledPostForm.tsx` | 予約投稿作成フォーム |
| `ScheduledPostForm.types.ts` | 予約投稿フォーム型定義 |
| `ScheduledPostList.tsx` | 予約投稿一覧 |
| `ShareButtons.tsx` | SNSシェアボタン群 |
| `form/BonsaiSelectorSection.tsx` | 盆栽選択セクション |
| `form/ContentInputSection.tsx` | 投稿内容入力セクション |
| `form/FormActionButtons.tsx` | フォームアクションボタン群 |
| `form/MediaUploadSection.tsx` | メディアアップロードセクション |
| `form/PollSection.tsx` | 投票セクション |
| `gallery/index.ts` | ギャラリーエクスポートまとめ |
| `gallery/MediaItem.tsx` | メディアアイテムコンポーネント |
| `gallery/ModalMediaItem.tsx` | モーダルメディアアイテムコンポーネント |
| `gallery/types.ts` | ギャラリー型定義 |
| `hooks/useMediaUpload.ts` | メディアアップロードフック |

### components/premium/ — プレミアム判定コンテキスト

| ファイル | 役割 |
|---------|------|
| `PremiumContext.tsx` | プレミアム会員状態の React Context 定義 |
| `PremiumProvider.tsx` | プレミアム状態プロバイダー（クライアント側で会員判定を供給） |

### components/pwa/ — PWA（Progressive Web App）

| ファイル | 役割 |
|---------|------|
| `ServiceWorkerRegistration.tsx` | Service Worker登録・更新通知・オフライン状態管理 |

### components/report/ — 通報

| ファイル | 役割 |
|---------|------|
| `ReportButton.tsx` | 通報ボタン |
| `ReportForm.tsx` | 通報フォームコンポーネント |
| `ReportModal.tsx` | 通報理由選択モーダル |
| `ReportSuccessView.tsx` | 通報完了表示コンポーネント |

### components/search/ — 検索

| ファイル | 役割 |
|---------|------|
| `AdvancedSearchFilters.tsx` | 高度な検索フィルター |
| `GenreFilter.tsx` | ジャンルフィルター |
| `PostSearchResults.tsx` | 投稿検索結果表示 |
| `SearchBar.tsx` | 検索バー（最近の検索 localStorage 履歴、`/` キーフォーカス、URL 双方向同期、履歴選択／削除はネスト button 解消で `<li>` 内兄弟配置に変更） |
| `SearchResults.tsx` | 検索結果表示 |
| `SearchResultsSkeleton.tsx` | 検索結果スケルトンローダー |
| `SearchTabs.tsx` | 検索タブ（投稿/ユーザー/ハッシュタグ） |
| `TagSearchResults.tsx` | タグ検索結果表示 |
| `UserSearchResults.tsx` | ユーザー検索結果表示 |

### components/seo/ — SEO・構造化データ

| ファイル | 役割 |
|---------|------|
| `JsonLd.tsx` | JSON-LD構造化データ（汎用） |
| `ArticleJsonLd.tsx` | 記事用JSON-LD |
| `BreadcrumbJsonLd.tsx` | パンくずリスト用JSON-LD |
| `DefinedTermJsonLd.tsx` | 用語定義用JSON-LD |
| `EventJsonLd.tsx` | イベント用JSON-LD |
| `LocalBusinessJsonLd.tsx` | ローカルビジネス用JSON-LD |
| `OrganizationJsonLd.tsx` | 組織用JSON-LD |
| `PersonJsonLd.tsx` | 人物用JSON-LD |
| `WebSiteJsonLd.tsx` | Webサイト用JSON-LD |
| `utils.ts` | SEOユーティリティ関数 |
| `index.ts` | エクスポートまとめ |

### components/settings/ — 設定

| ファイル | 役割 |
|---------|------|
| `NotificationPreferences.tsx` | 通知設定コンポーネント |
| `SakuraPetalsToggle.tsx` | 桜の花びらアニメーション設定トグル |
| `SettingsGuestRestriction.tsx` | ゲストユーザー設定制限表示 |
| `TwoFactorSettings.tsx` | 2段階認証設定コンポーネント |
| `two-factor/SetupSection.tsx` | 2FAセットアップセクション |
| `two-factor/DisableForm.tsx` | 2FA無効化フォーム |
| `two-factor/RegenerateBackupCodes.tsx` | バックアップコード再生成 |
| `two-factor/icons.tsx` | 2FA関連アイコン |

### components/shop/ — 盆栽園

| ファイル | 役割 |
|---------|------|
| `BusinessHoursInput.tsx` | 営業時間入力コンポーネント |
| `Map.tsx` | Leaflet地図コンポーネント |
| `MapWrapper.tsx` | 地図ラッパー（動的インポート、SSR無効） |
| `ReviewCard.tsx` | レビュー表示カード |
| `ReviewForm.tsx` | レビュー投稿フォーム |
| `ReviewList.tsx` | レビュー一覧 |
| `ShopActions.tsx` | 盆栽園操作メニュー |
| `ShopCard.tsx` | 盆栽園カード表示 |
| `ShopChangeRequestForm.tsx` | 盆栽園情報変更リクエストフォーム |
| `ShopForm.tsx` | 盆栽園登録/編集フォーム |
| `ShopGenreEditor.tsx` | 盆栽園ジャンル編集 |
| `ShopList.tsx` | 盆栽園一覧 |
| `StarRating.tsx` | 星評価コンポーネント |
| `form/AddressGeocodingSection.tsx` | 住所ジオコーディングセクション |
| `form/BusinessHoursSection.tsx` | 営業時間入力セクション |
| `form/ShopGenreSelector.tsx` | 盆栽園ジャンル選択 |
| `review/ReviewDisplay.tsx` | レビュー表示コンポーネント |
| `review/ReviewEditForm.tsx` | レビュー編集フォーム |

### components/subscription/ — プレミアム会員

| ファイル | 役割 |
|---------|------|
| `PaymentHistory.tsx` | 支払い履歴表示 |
| `PremiumBadge.tsx` | プレミアムバッジ表示 |
| `PremiumUpgradeCard.tsx` | プレミアムアップグレード案内カード |
| `PricingCard.tsx` | 料金プランカード |
| `SubscriptionStatus.tsx` | サブスクリプション状態表示 |

### components/theme/ — テーマ

| ファイル | 役割 |
|---------|------|
| `ThemeIcons.tsx` | テーマ切替用アイコンコンポーネント |
| `ThemeProvider.tsx` | ダーク/ライトテーマプロバイダー |
| `ThemeToggle.tsx` | テーマ切替トグル |

### components/ui/ — shadcn/ui基盤コンポーネント

| ファイル | 役割 |
|---------|------|
| `alert.tsx` | アラート表示 |
| `alert-dialog.tsx` | 確認ダイアログ |
| `AnalogClockPicker.tsx` | アナログ時計型時刻ピッカー |
| `avatar.tsx` | アバター画像 |
| `badge.tsx` | バッジ表示 |
| `button.tsx` | ボタン |
| `card.tsx` | カード |
| `dialog.tsx` | ダイアログ/モーダル |
| `dropdown-menu.tsx` | ドロップダウンメニュー |
| `input.tsx` | テキスト入力 |
| `label.tsx` | フォームラベル |
| `select.tsx` | セレクトボックス |
| `switch.tsx` | スイッチトグル |
| `tabs.tsx` | タブ |
| `textarea.tsx` | テキストエリア |
| `toaster.tsx` | トースト通知表示 |
| `tooltip.tsx` | ツールチップ |

### components/user/ — ユーザー

| ファイル | 役割 |
|---------|------|
| `AvatarUploader.tsx` | アバター画像アップロード |
| `BlockButton.tsx` | ブロックボタン |
| `BlockedUserList.tsx` | ブロックユーザー一覧 |
| `DeleteAccountButton.tsx` | アカウント削除ボタン |
| `FollowButton.tsx` | フォロー/アンフォローボタン |
| `HeaderUploader.tsx` | ヘッダー画像アップロード |
| `MuteButton.tsx` | ミュートボタン |
| `MutedUserList.tsx` | ミュートユーザー一覧 |
| `PrivacyToggle.tsx` | アカウント公開/非公開切替 |
| `ProfileEditForm.tsx` | プロフィール編集フォーム |
| `ProfileHeader.tsx` | プロフィールヘッダー表示 |
| `ProfileIcons.tsx` | プロフィール用アイコンコンポーネント |
| `ProfileTabs.tsx` | プロフィールタブ（投稿/いいね等） |
| `profile-utils.ts` | プロフィール関連ユーティリティ |
| `RecommendedUserList.tsx` | おすすめユーザー一覧（発見・オンボーディングで共用、フォローボタン付き） |
| `UserCard.tsx` | ユーザーカード表示 |
| `UserList.tsx` | ユーザー一覧 |

### components/weather/ — 天気アドバイス

| ファイル | 役割 |
|---------|------|
| `WeatherAdviceCard.tsx` | 天気に基づく盆栽管理アドバイスカード表示 |
| `WeatherLocationSetting.tsx` | 天気取得用の位置情報設定コンポーネント |

---

## hooks/ — カスタムReact Hooks（7ファイル）

| ファイル | 役割 |
|---------|------|
| `use-fingerprint.ts` | FingerprintJS によるデバイス識別フック |
| `use-focus-trap.ts` | モーダル等のフォーカストラップ（Tab 循環・Escape 復帰） |
| `use-follow-action.ts` | フォローアクション管理フック |
| `use-infinite-scroll.ts` | 無限スクロール実装用フック（IntersectionObserver ベース） |
| `use-is-client.ts` | クライアントマウント判定フック（SSR/CSR ハイドレーション差異の回避） |
| `use-keyboard-shortcuts.ts` | グローバルキーボードショートカットフック（/検索、n投稿、g+hホーム等） |
| `use-toast.ts` | トースト通知フック |

> メディアアップロードフックは `components/post/hooks/useMediaUpload.ts` に配置（投稿フォーム専用）。

---

## lib/ — ライブラリ・ユーティリティ

```
lib/
├── actions/          # Server Actions（root 68 + admin/20 + schemas/1 = 89 .ts）
├── api/              # 管理 API 認可 + モバイル API v1 基盤（seed-auth + v1/）
├── build/            # ビルド時ヘルパー（DB 可用性判定 / generateStaticParams ラッパー）
├── config/           # 設定ロジック（next.config 用 image remotePatterns 等）
├── constants/        # 定数（24ルートファイル + limits/20 + errors/8 + legal/1 = 53）
├── email/            # メール送信（index.ts + templates/5）
├── prisma/           # Prisma 形状共有定義（shared-includes.ts）
├── scraping/         # スクレイピング
├── search/           # 全文検索（3ファイル）
├── security/         # セキュリティ（index / nonce / oauth-guard）
├── services/         # サービス層（61ファイル、push/ サブ含む）
├── shop/             # Shop ドメイン共有ユーティリティ（1ファイル）
├── storage/          # ストレージ（R2 / S3 / local 切替）
├── utils/            # ドメイン別ユーティリティ（14ファイル）
├── validations/      # バリデーション（password.ts）
└── （29ルートファイル）
```

### lib/ ルートファイル（29ファイル）

| ファイル | 役割 |
|---------|------|
| `admin-permissions.ts` | 管理者権限・ロール定義 |
| `auth.ts` | NextAuth.js認証設定（Credentials + Google OAuth、ユーザー登録） |
| `auth.config.ts` | NextAuth.js基本設定（プロバイダー、Cookie SameSite設定等） |
| `cache.ts` | Upstash Redisキャッシュユーティリティ |
| `client-image-compression.ts` | クライアント側画像圧縮 |
| `client-logger.ts` | クライアントサイド用ロガー（本番Sentry送信、開発console出力） |
| `cron-auth.ts` | Cronジョブ認証（HMAC-SHA256署名 + タイムスタンプ検証） |
| `db.ts` | Prismaクライアントインスタンス（シングルトン） |
| `env.ts` | 環境変数ゲートウェイ getter（getCronSecret / getBasicAuthConfig / isProduction 等） |
| `env-validation.ts` | 環境変数検証ユーティリティ |
| `file-validation.ts` | ファイルアップロード検証（シグネチャ、MIME等） |
| `fingerprint.ts` | FingerprintJSデバイス識別 |
| `logger.ts` | ロガーユーティリティ（static import、開発console / 本番Sentry） |
| `login-tracker.ts` | ログイン試行追跡（ブルートフォース対策） |
| `mention-utils.ts` | @メンション解析ユーティリティ |
| `ng-word-checker.ts` | NGワードチェッカー（Redis キャッシュは `z.array(...).safeParse() + .loose()` で型安全な検証、`as` キャスト排除） |
| `prefectures.ts` | 都道府県データ |
| `premium.ts` | プレミアム会員判定ユーティリティ |
| `rate-limit.ts` | Upstash Redisレート制限 |
| `redis.ts` | Upstash Redisクライアント |
| `sakura-petals-pref.ts` | 都道府県別桜花びらアニメーション設定 |
| `sanitize.ts` | HTMLサニタイズ（XSS対策） |
| `security-checks.ts` | セキュリティチェック（Origin検証等） |
| `security-logger.ts` | セキュリティイベントロガー |
| `stripe.ts` | Stripeクライアント設定 |
| `two-factor.ts` | 2段階認証（TOTP）ユーティリティ（鍵バージョニング対応） |
| `two-factor-login-ticket.ts` | 2FA ログイン中間チケット（サーバー側で 2FA 強制。1段目認証後の短命チケットを発行・検証し、TOTP 通過まで本セッションを発行しない） |
| `utils.ts` | 汎用ユーティリティ関数（cn等） |
| `web-push.ts` | Web Push通知送信 |

### lib/actions/ — Server Actions（root 68 + admin/20 + schemas/1 = 89 .ts）

> 戻り値型ポリシー: すべての Server Action は `ActionResult<T>` を返す（`types/action-result.ts`、CLAUDE.md ルール2）。
> 例外として、RSC からのみ呼ばれる / 内部 helper として使う読み取り専用モジュールは `'use server'` を付けず `'server-only'` ガードのみを置き、ドメイン型を直接返す。
>
> **`'server-only'` の RSC データ取得モジュール:**
> `dictionary.ts` / `fertilizer.ts` / `hormone.ts` / `pesticide.ts` / `search-meta.ts`
>
> **`'server-only'` の内部 helper:**
> `filter-helper.ts` / `pagination.ts` / `post-include.ts` / `post-validation.ts` / `prisma-filters.ts` / `utils.ts`
> （3箇所以上で共有される Prisma include/select 形状は `lib/prisma/shared-includes.ts` に集約。依存方向中立のため actions / services 双方から import 可能）
>
> **barrel re-export（自身は無ディレクティブ、再エクスポート先が `'use server'`）:**
> `user.ts`
>
> 大半のファイルが `'use server'` を持つ。残りが上記の `'server-only'` / barrel 群。

| ファイル | 役割 |
|---------|------|
| `admin.ts` | 管理者判定・情報取得（isAdmin, getAdminInfo） |
| `analytics.ts` | ユーザーアナリティクスデータ取得 |
| `announcement.ts` | お知らせ（公開用取得） |
| `auth.ts` | 認証関連（登録、ログイン、ゲストログイン） |
| `auth-email-verify.ts` | メールアドレス確認トークンの送信・検証 |
| `auth-password-reset.ts` | パスワードリセット要求・実行 |
| `blacklist.ts` | メール/デバイスブラックリスト管理 |
| `block.ts` | ブロック操作 |
| `bonsai.ts` | 盆栽CRUD操作 |
| `bonsai-care-log.ts` | 盆栽手入れログ（カレンダービュー専用、種別/日付/メモ）。`addCareLog`/`updateCareLog`/`deleteCareLog`/`listCareLogs` |
| `bonsai-record.ts` | 盆栽成長記録操作 |
| `bookmark.ts` | ブックマーク操作 |
| `comment.ts` | コメントCRUD操作 |
| `comment-thread-mute.ts` | コメントスレッドミュート操作 |
| `contact.ts` | お問い合わせ送信・管理 |
| `dictionary.ts` | 盆栽用語辞典（BonsaiTerm 一覧・詳細取得）。**RSC データ取得モジュール**（`'use server'` 不付与・`'server-only'`） |
| `draft.ts` | 下書き管理 |
| `event.ts` | イベントCRUD操作 |
| `event-import.ts` | イベントCSVインポート |
| `feed.ts` | タイムラインデータ取得 |
| `fertilizer.ts` | 肥料ガイド機能（栄養素・カテゴリ・樹種別スケジュール・コラム）。**RSC データ取得モジュール**（`'use server'` 不付与・`'server-only'`、内部で `requireAuth()` を呼ぶ） |
| `filter-helper.ts` | フィードフィルタリングヘルパー（ブロック/ミュート除外）。**`'use server'` を持たない内部 helper**（`'server-only'` ガード付き）。Server Action / Server Component から呼ばれ、クライアントから RPC で呼べない |
| `follow.ts` | フォロー/アンフォロー操作 |
| `follow-request.ts` | フォローリクエスト管理（送信／承認／拒否／取消）。書き込み系 4 関数すべて `requireActiveNonGuestUser('engagement')` + Zod (`z.string().min(1)`) で認証→Zod→レート制限を統一適用。読取系（status/list/count）は `requireAuth` ベース |
| `hashtag.ts` | ハッシュタグ管理（投稿との紐付け含む） |
| `hide-post.ts` | 投稿非表示操作 |
| `hormone.ts` | 植物ホルモンガイド機能（ホルモン一覧・詳細・相互作用・コラム）。**RSC データ取得モジュール**（`'use server'` 不付与・`'server-only'`、内部で `requireAuth()` を呼ぶ） |
| `like.ts` | いいね操作（投稿・コメント） |
| `maintenance.ts` | メンテナンスモード管理 |
| `mention.ts` | @メンション処理・通知送信 |
| `message.ts` | ダイレクトメッセージ（バレル） |
| `message-conversations.ts` | 会話（Conversation）取得・管理 |
| `message-messages.ts` | メッセージ送信・取得・削除 |
| `mute.ts` | ミュート操作 |
| `notification.ts` | 通知取得・既読管理 + `createNotification` / `deleteNotification` ヘルパー |
| `notification-preferences.ts` | 通知設定管理 |
| `onboarding.ts` | オンボーディング進行管理（初回設定完了フラグ `onboardedAt` の更新等） |
| `pagination.ts` | カーソルベースページネーション用 Prisma クエリ条件生成ユーティリティ（`MAX_PAGE_LIMIT` で clamp）。**`'use server'` を持たない内部 helper** |
| `pesticide.ts` | 農薬・病害虫（薬剤一覧、病害虫、原体、展着剤、コラム等）。**RSC データ取得モジュール**（`'use server'` 不付与・`'server-only'`、内部で `requireAuth()` を呼ぶ） |
| `pin-post.ts` | 投稿のプロフィール固定（ピン留め）操作 |
| `poll.ts` | 投稿アンケート操作（投票、結果取得） |
| `post.ts` | 投稿 CRUD（通常投稿、引用、リポスト、削除、メディアアップロード、`getPost` / `getPosts` / `getPostsByBonsai`）。`createPost` の純粋検証ロジックは `post-validation.ts` に分離済み（`'server-only'`、817→659 行に縮小） |
| `post-include.ts` | 投稿取得時の Prisma include パターン共有定義（`POST_LIST_INCLUDE` / `POST_QUOTE_INCLUDE` / `POST_REPOST_INCLUDE` / `buildPostPollInclude(currentUserId?)` / `formatPostForClient`）。`feed.ts` / `post.ts` の重複 include を集約。**`'use server'` を持たない `'server-only'` モジュール** |
| `post-validation.ts` | `createPost` 専用の純粋検証ヘルパー（`validatePollOptions` / `parseCreatePostShape` / `applyCreatePostBusinessRules`）を `'server-only'` 配下に隔離。Server Action 本体（`post.ts`）を薄く保ち、helpers が任意 input で外部から呼ばれない設計に統一。Poll オプションは Zod 配列スキーマで完全型推論（`as` キャスト排除） |
| `prisma-filters.ts` | Prisma `where` 条件のヘルパー（大文字小文字非依存 contains 等）。**`'use server'` を持たない内部 helper** |
| `push-subscription.ts` | Web Pushサブスクリプション管理 |
| `report.ts` | 通報（バレル） |
| `report-admin.ts` | 通報（管理者側の処理） |
| `report-user.ts` | 通報（ユーザー側の処理） |
| `review.ts` | 盆栽園レビュー操作 |
| `scheduled-post.ts` | 予約投稿（バレル） |
| `scheduled-post-crud.ts` | 予約投稿 CRUD（公開処理は `lib/services/scheduled-post-publisher.ts` へ委譲） |
| `search.ts` | 検索処理（バレル） |
| `search-entities.ts` | 検索エンティティ操作（ショップ・イベント・盆栽） |
| `search-meta.ts` | 検索メタ情報（人気タグ・ジャンル・検索モード）。**RSC データ取得モジュール**（`'use server'` 不付与・`'server-only'`） |
| `search-posts.ts` | 投稿検索（FTS / LIKE フォールバック）。返り値は `ActionResult<{posts, nextCursor}>` |
| `search-users.ts` | ユーザー検索。返り値は `ActionResult<{users, nextCursor}>`（client component から RPC 呼び出しのため `'use server'` 必須） |
| `security-activity.ts` | ユーザー自身のセキュリティアクティビティ（ログイン履歴・デバイス等）取得・管理 |
| `shop.ts` | 盆栽園CRUD |
| `shop-change-request.ts` | 盆栽園変更リクエスト |
| `subscription.ts` | サブスクリプション管理（Stripe連携） |
| `two-factor.ts` | 2段階認証設定操作 |
| `user.ts` | ユーザー（バレル。user-profile/media/account を再エクスポート） |
| `user-account.ts` | ユーザーアカウント管理（メール変更、パスワード変更、アカウント削除） |
| `user-media.ts` | ユーザーメディア操作（アバター・ヘッダー画像管理） |
| `user-profile.ts` | ユーザープロフィール詳細操作 |
| `utils.ts` | Server Actions共通ユーティリティ（requireActiveUser、requireActiveNonGuestUser、getUserRelationSets〈Redis 5分 TTL〉、getGuestUserId〈unstable_cache 1時間 TTL〉、getUser〈cache() メモ化〉等）。**`'use server'` を持たない内部 helper** |
| `weather.ts` | 天気アドバイス操作（位置情報設定、天気データ取得、Open-Meteo連携） |
| `schemas/common.ts` | 共通バリデーションスキーマ |

#### lib/actions/admin/ — 管理者用Server Actions（20ファイル）

| ファイル | 役割 |
|---------|------|
| `_schemas.ts` | admin action 共有 Zod スキーマ（無ディレクティブの内部モジュール） |
| `activity.ts` | アクティビティ管理 |
| `analytics.ts` | アナリティクス管理 |
| `announcements.ts` | お知らせ管理 |
| `cms.ts` | CMSページ管理 |
| `content.ts` | コンテンツ管理 |
| `hidden.ts` | 非表示コンテンツ管理 |
| `ip-management.ts` | IP管理 |
| `logs.ts` | 管理者ログ管理 |
| `moderation.ts` | モデレーション管理 |
| `monitoring.ts` | システム監視管理 |
| `pesticide-data.ts` | 農薬データ管理 |
| `posts.ts` | 投稿管理 |
| `premium.ts` | プレミアム会員管理 |
| `roles.ts` | ロール管理 |
| `security.ts` | セキュリティ管理 |
| `segments.ts` | ユーザーセグメント管理 |
| `stats.ts` | 統計データ管理 |
| `users.ts` | ユーザー管理 |
| `warnings.ts` | ユーザー警告管理 |

### lib/api/ — 管理 API 認可 + モバイル API v1 基盤

| ファイル | 役割 |
|---------|------|
| `seed-auth.ts` | 管理 API（`/api/admin/seed` / `seed-pesticide` / `apply-migration`）共通の認可ヘルパー（Bearer + IP allowlist + 本番でのスタックトレース非返却） |
| `v1/index.ts` | モバイル API v1 共通基盤のバレル（route handler はここ経由で import） |
| `v1/jwt.ts` | v1 向け JWT 発行・検証（`MOBILE_JWT_SECRET` から導出、HS256） |
| `v1/auth-guard.ts` | v1 向け Bearer 認証ガード `requireBearerUser`（fail-closed、`/api/v1/*` の認可責任を集約） |
| `v1/token-pair.ts` | アクセス + リフレッシュトークンのペア発行（login / 2fa / refresh / google で共有） |
| `v1/mobile-2fa-ticket.ts` | モバイル専用の 2FA 一時チケット発行・検証（Web の `lib/two-factor-login-ticket.ts` とは用途が別） |
| `v1/response.ts` | v1 統一レスポンスビルダー（`apiError` / `apiZodError` / `apiRateLimited`、`{ error: { code, message, status } }` 形式） |
| `v1/pagination.ts` | v1 ページネーション共通スキーマ・型（`{ items, nextCursor }` 形式） |
| `v1/types.ts` | v1 共通型定義 |
| `v1/mention-resolver.ts` | レスポンス用メンション一括解決（`<@userId>` を 1 回の findMany で nickname/avatar に解決） |
| `v1/follow-state-resolver.ts` | レスポンス用フォロー状態一括解決（閲覧者のフォロー状態をバッチクエリで付加） |
| `v1/schemas/index.ts` | v1 リクエスト/レスポンススキーマのバレル |
| `v1/schemas/request.ts` | v1 リクエストボディの Zod スキーマ（route handler と `generate-openapi.ts` が共有） |
| `v1/schemas/response.ts` | v1 レスポンスボディの Zod スキーマ（OpenAPI ジェネレータと共有、エラーコードは `MOBILE_API_ERROR_CODES` から z.enum 化） |

### lib/build/ — ビルド時ヘルパー

| ファイル | 役割 |
|---------|------|
| `db-availability.ts` | ビルド/起動時に DB アクセスをスキップすべきか判定（`SKIP_DB_CONNECTION` / `DATABASE_URL` 未設定・ダミー値） |
| `static-params.ts` | `generateStaticParams` 用 DB ロードラッパー（本番 build では失敗を握りつぶさず伝播させる） |

### lib/config/ — 設定ロジック

| ファイル | 役割 |
|---------|------|
| `image-remote-patterns.ts` | `next.config.ts` の `images.remotePatterns` を環境別に組み立て（vitest から import 可能にするため切り出し） |

### lib/constants/ — 定数（ルート24ファイル + errors/8 + limits/20 + legal/1 = 53）

| ファイル | 役割 |
|---------|------|
| `admin-actions.ts` | 管理者アクション定数 |
| `admin-stats.ts` | 管理者統計ダッシュボードの集計対象・期間オプション定数 |
| `animation.ts` | 季節背景アニメーション（パーティクル種別・密度等）の定数 |
| `bonsai-care.ts` | 盆栽手入れログ用のラベル・順序・enum 定数（`BonsaiCareType` 表示名等） |
| `contact.ts` | 連絡先定数（`SUPPORT_EMAIL` / `OPERATOR_NAME` 等） |
| `contact-categories.ts` | お問い合わせカテゴリ定数 |
| `dictionary.ts` | 盆栽用語辞典のカテゴリラベル・配色・並び順を集約（2026-05-12 に新設） |
| `guest.ts` | ゲストユーザー関連定数（`GUEST_EMAIL` 等） |
| `hormone-techniques.ts` | 盆栽技法×ホルモン定数（9技法定義、effectType/magnitude定数、ダイアグラムSVG設定、シミュレーター閾値） |
| `images.ts` | イラスト画像パス定数（ラベル・パスの対応表） |
| `landing-animation.ts` | ランディングページの墨筆ストローク演出設定定数 |
| `locations.ts` | 地域・都道府県定数（8地方ブロック） |
| `messages.ts` | UI メッセージ（フォーム・通知等）の定数 |
| `path-builders.ts` | 動的パス生成ヘルパー（例: `postPath(id)`） |
| `report.ts` | 通報理由の定数 |
| `reserved.ts` | 予約済み文字列定数（ニックネーム等） |
| `routes.ts` | ルートパス定数（ROUTE_LOGIN、ROUTE_FEED、PROTECTED_PATHS 等） |
| `search-media.ts` | 検索メディアフィルタ定数 |
| `search-setup.ts` | 検索インデックス（FTS）セットアップ用定数 |
| `status.ts` | ステータスラベル・色定数（通報ステータス、投稿ステータス等） |
| `storage.ts` | ストレージフォルダパス定数（アバター、投稿画像等） |
| `storage-keys.ts` | ストレージキー定数 |
| `system-settings.ts` | `systemSetting` テーブルの固定キー（`maintenance_mode` 等） |
| `theme.ts` | テーマ（ライト/ダーク）関連定数 |
| `errors/` | エラーメッセージ定数（8ファイル。下記参照） |
| `legal/` | 法務文書スラッグ・メタ定数（`index.ts`） |
| `limits/` | 制限値定数（20ファイル。下記参照） |

#### lib/constants/errors/ — エラー定数（8ファイル）

| ファイル | 役割 |
|---------|------|
| `index.ts` | ドメイン別 ERR_* / API_ERR_* を集約エクスポート |
| `auth.ts` | 認証・登録・2FA 関連 |
| `content.ts` | 投稿・メディア・バリデーション（ファイル検証詳細含む） |
| `entity.ts` | 各エンティティの Not Found・権限エラー |
| `features.ts` | 機能別（ショップ・レビュー・下書き・予約投稿・お問い合わせ 等） |
| `social.ts` | フォロー・ブロック・ミュート・メッセージ |
| `admin.ts` | 管理者・セグメント・ブラックリスト + API_ERR_* 英語 |
| `mobile-api.ts` | モバイル API v1 のエラーコード・メッセージ（`MOBILE_API_ERROR_CODES` 等） |

#### lib/constants/limits/ — 制限値定数（20ファイル）

| ファイル | 役割 |
|---------|------|
| `index.ts` | エクスポートまとめ |
| `admin.ts` | 管理者関連制限値 |
| `ads.ts` | 広告関連制限値 |
| `analytics.ts` | アナリティクス関連制限値（`VIEW_BEACON_RATE_LIMIT_PER_MINUTE` / `VIEW_BEACON_DEDUPE_SECONDS` 等の `/api/analytics/view` 用しきい値も含む） |
| `auth.ts` | 認証関連制限値（`REFERER_LOG_PREVIEW_LENGTH` 等の漏洩抑止用切り詰め長も含む） |
| `bonsai-care.ts` | 盆栽手入れログの上限値（メモ最大文字数・取得期間・将来日トレランス等） |
| `cache.ts` | キャッシュ関連制限値（`MAINTENANCE_CACHE_TTL_MS` を含む。proxy.ts のメンテキャッシュTTL） |
| `database.ts` | データベース関連制限値 |
| `event.ts` | イベント類似度判定（`EVENT_TITLE_SIMILARITY_PREFIX_LENGTH`、`event-import.ts` の重複検出に使用） |
| `external.ts` | 外部連携制限値 |
| `fertilizer.ts` | 肥料関連制限値 |
| `hormone.ts` | 植物ホルモン関連制限値 |
| `media.ts` | メディア関連制限値 |
| `mobile-auth.ts` | モバイル API 認証関連制限値（JWT/リフレッシュトークン有効期限・レート制限等） |
| `mobile-device.ts` | モバイル Push デバイス登録関連制限値 |
| `pagination.ts` | ページネーション関連制限値（`DEFAULT_PAGE_LIMIT` / `MAX_PAGE_LIMIT`） |
| `pesticide.ts` | 農薬関連制限値（一覧件数上限・スラッグ長等） |
| `post.ts` | 投稿関連制限値 |
| `time.ts` | 時間関連制限値（`ONE_MINUTE_MS` 等） |
| `ui.ts` | UI関連制限値 |

### lib/email/ — メール

| ファイル | 役割 |
|---------|------|
| `index.ts` | Resendメール送信エントリポイント |
| `templates/password-reset.ts` | パスワードリセットメールテンプレート |
| `templates/shared.ts` | メール共通ユーティリティ |
| `templates/subscription-expired.ts` | プレミアム期限切れメール |
| `templates/subscription-expiring.ts` | プレミアム期限警告メール |
| `templates/verification.ts` | メール確認トークン送信 |

### lib/prisma/ — Prisma 形状共有定義（1ファイル）

| ファイル | 役割 |
|---------|------|
| `shared-includes.ts` | 3箇所以上で使う Prisma include/select の集約（`USER_MINIMAL_SELECT`、`USER_MINIMAL_RELATION`（user/creator/sender/actor/reporter リレーションで統一）、`GENRE_MINIMAL_SELECT`、`POST_GENRE_RELATION` 等）。純粋な Prisma 形状定数のため依存方向中立で actions / services 双方から import 可能 |

### lib/scraping/ — スクレイピング

| ファイル | 役割 |
|---------|------|
| `bonsai-events.ts` | 盆栽イベント情報スクレイピング |

### lib/search/ — 全文検索（3ファイル）

| ファイル | 役割 |
|---------|------|
| `fulltext.ts` | 全文検索バレル（config / search を再エクスポート） |
| `fulltext-config.ts` | 検索 mode 判定・拡張機能（pg_bigm / pg_trgm）操作・GIN index 作成・状態取得 |
| `fulltext-search.ts` | Entity 別 FTS クエリ実装（SEARCH_MODE で bigm/trgm/like 切替、失敗時 LIKE フォールバック） |

### lib/security/ — セキュリティ

| ファイル | 役割 |
|---------|------|
| `nonce.ts` | CSP nonce取得ユーティリティ（Server Component用） |
| `oauth-guard.ts` | OAuth プロバイダー連携時の検証ガード |
| `index.ts` | エクスポートまとめ |

### lib/services/ — サービス層（61ファイル、`push/` サブ含む）

複数の Server Action / Route Handler（Web + モバイル v1）から共有される再利用ドメインロジック。Web/モバイル両 API がロジックを共有できるよう、多くのドメインで read/write service を分離している。認証・認可は呼び出し元（Action / Route Handler）が済ませている前提。

| ファイル | 役割 |
|---------|------|
| `account-deletion-service.ts` | アカウント削除の実体処理（関連データのカスケード削除・課金記録の匿名化） |
| `analytics-read-service.ts` | アナリティクスデータ取得・整形（読み取り） |
| `analytics-recording.ts` | UserAnalytics 累積カウンタ更新（`recordPostViewService` / `recordProfileViewService` / `recordLikeReceivedService` / `recordNewFollowerService`）。Server Action と `/api/analytics/view` 双方から呼ばれる |
| `analytics-service.ts` | アナリティクス集計サービス |
| `authorization.ts` | 認可チェックサービス（権限判定の共通化） |
| `blacklist-check.ts` | メール/デバイスのブラックリスト照合 |
| `block-service.ts` | ブロックの作成/解除・状態判定 |
| `bonsai-care-log-service.ts` | 盆栽手入れログのドメイン処理 |
| `bonsai-record-service.ts` | 盆栽成長記録のドメイン処理 |
| `bonsai-service.ts` | 盆栽 CRUD のドメイン処理 |
| `bookmark-service.ts` | ブックマークの作成/解除・一覧取得 |
| `comment-notifications.ts` | コメント通知サービス（`createNotification` / `createNotificationsBulk` へ delegate） |
| `comment-read-service.ts` | コメント取得（読み取り） |
| `comment-thread-mute.ts` | コメントスレッドミュート状態の判定共有ロジック |
| `comment-write-service.ts` | コメント作成/削除（書き込み） |
| `credential-verification.ts` | メール/パスワード資格情報の検証（bcrypt 照合） |
| `device-service.ts` | モバイル Push デバイス（Expo トークン）の登録・削除・一覧 |
| `device-tracking.ts` | デバイス識別・追跡共有ロジック（UserDevice 記録、ブラックリスト照合） |
| `dictionary-read-service.ts` | 盆栽用語辞典の取得（読み取り） |
| `email-verify-core.ts` | メール確認トークンの発行・検証コアロジック |
| `event-service.ts` | イベントのドメイン処理 |
| `explore-posts-service.ts` | 発見の人気投稿取得 |
| `explore-service.ts` | 発見（トレンドタグ/ジャンル・おすすめユーザー）取得 |
| `feed-service.ts` | タイムライン取得のドメイン処理 |
| `fertilizer-read-service.ts` | 肥料ガイドの取得（読み取り） |
| `follow-service.ts` | フォロー/アンフォロー・フォローリクエストのドメイン処理 |
| `hashtag-recount.ts` | ハッシュタグ参照件数の再計算（管理操作 / 定期 cron 用） |
| `hashtag-sync.ts` | 投稿ハッシュタグの同期・差分更新（attach/detach 内部処理） |
| `hormone-read-service.ts` | 植物ホルモンガイドの取得（読み取り） |
| `legal-service.ts` | 法務文書の取得（規約・プライバシー等） |
| `like-service.ts` | いいねの作成/解除（投稿・コメント） |
| `login-throttle.ts` | ログイン試行スロットリング（ブルートフォース対策） |
| `media-cleanup.ts` | アップロード済みメディアの実体削除（投稿/コメント/下書き/予約投稿/レビュー/盆栽記録の削除時に R2/local のオーファンを回収） |
| `media-url-validator.ts` | メディア URL の検証（自ストレージ由来かのガード） |
| `mention.ts` | メンション関連の解決・通知共有ロジック |
| `mute-service.ts` | ミュートの作成/解除・状態判定 |
| `notification-bulk.ts` | **複数受信者への通知一括作成**（block/prefs フィルタ + `createMany skipDuplicates` + push 並列） |
| `notification-core.ts` | 通知のブロック/設定/重複チェック等の内部ヘルパー（Web Push + Expo Push を発火） |
| `notification-preferences-utils.ts` | 通知設定の判定ユーティリティ |
| `notification-read-service.ts` | 通知取得・未読件数・既読化（読み取り） |
| `password-reset-service.ts` | パスワードリセットのコアロジック |
| `pesticide-read-service.ts` | 農薬・病害虫の取得（読み取り） |
| `post-read-service.ts` | 投稿取得（読み取り） |
| `post-visibility.ts` | 投稿の可視性判定共有ロジック（公開/非公開/ブロック関係を考慮したアクセス可否） |
| `post-write-service.ts` | 投稿の作成/更新/削除（書き込み） |
| `push/expo-push.ts` | Expo Push API を使ったモバイル Push 送信（fire-and-forget、無効トークン自動削除） |
| `registration-service.ts` | ユーザー登録のコアロジック |
| `report-service.ts` | 通報のドメイン処理 |
| `revenuecat.ts` | RevenueCat Webhook イベント処理（イベント種別に応じて `isPremium` / `premiumExpiresAt` を更新。送信元検証・冪等性は Route Handler 側） |
| `scheduled-post-publisher.ts` | 予約投稿の公開処理（cron から呼び出し。旧 `lib/actions/scheduled-post-publish.ts` を移設） |
| `scheduled-post-service.ts` | 予約投稿の CRUD ドメイン処理 |
| `search-service.ts` | 検索のドメイン処理（FTS / LIKE フォールバック） |
| `security-events.ts` | セキュリティイベント記録サービス |
| `segment-evaluation.ts` | ユーザーセグメント条件の評価ロジック（セグメントビルダー条件→対象ユーザー判定） |
| `shop-service.ts` | 盆栽園 CRUD・レビューのドメイン処理 |
| `usage.ts` | fly.io / Supabase / R2 / Resend 利用量集計サービス |
| `user-eligibility.ts` | ユーザーの操作適格性判定（停止/ゲスト/プレミアム等の状態に基づく許可判定） |
| `user-profile-write-service.ts` | ユーザープロフィール更新（書き込み） |
| `user-read-service.ts` | ユーザー取得・関係解決（読み取り） |
| `webhook-idempotency.ts` | **外部 Webhook 冪等性ガード**（`webhook_events` UNIQUE INSERT、Stripe / RevenueCat 等のリトライ抑止） |
| `weather-service.ts` | 天気サービス（Open-Meteo API連携、天気データ取得・キャッシュ、盆栽管理アドバイス生成） |

### lib/shop/ — Shop ドメイン共有ユーティリティ（1ファイル）

| ファイル | 役割 |
|---------|------|
| `change-request.ts` | 盆栽園変更リクエストの純粋型・Zod schema・parser。副作用を持たないため Server Action / Server Component 双方から dependency-neutral に import 可能（`lib/prisma/shared-includes.ts` と同方針）。旧 `lib/services/shop-change-helpers.ts` から layer 規約遵守のため移設。 |

### lib/storage/ — ストレージ（Strategy パターン）

| ファイル | 役割 |
|---------|------|
| `index.ts` | ストレージ抽象化レイヤーの barrel。`STORAGE_PROVIDER` で local / supabase / r2 を切替（公開 API は `uploadFile` / `deleteFile`） |
| `types.ts` | プロバイダー共通型（`UploadResult` / `DeleteResult` 等） |
| `helpers.ts` | プロバイダー共通ヘルパー |
| `r2-provider.ts` | Cloudflare R2 プロバイダー実装 |
| `local-provider.ts` | ローカルファイルシステムプロバイダー実装（開発用） |
| `supabase-provider.ts` | Supabase Storage プロバイダー実装 |
| `image-sanitize.ts` | アップロード画像のサニタイズ（EXIF 除去等） |
| `s3-sign.ts` | S3/R2 presigned URL署名生成 |

### lib/utils/ — ユーティリティ（ドメイン別、14ファイル）

| ファイル | 役割 |
|---------|------|
| `admin-cursor.ts` | 管理者一覧のカーソル符号化・復号 |
| `avatar.ts` | デフォルトアバター画像パス生成 |
| `calendar-grid.ts` | カレンダー表示用グリッド生成（盆栽手入れログ・イベントカレンダー共用） |
| `client-ip.ts` | Request からの IP 抽出ヘルパー（rate-limit / login-tracker 等で共有） |
| `fertilizer.ts` | 肥料関連ユーティリティ |
| `form-data.ts` | FormData → typed object 変換ヘルパー |
| `hashtag-extract.ts` | 本文からのハッシュタグ抽出ユーティリティ |
| `json.ts` | JSON 安全パース・シリアライズヘルパー（`parseCachedWithSchema` 等 Redis キャッシュの型安全復元用） |
| `pesticide.ts` | 農薬関連（getMaffUrl、getResistanceRiskLabel、RESISTANCE_RISK_LABELS） |
| `pesticide-badge.ts` | 農薬バッジ表示ユーティリティ |
| `preserve-order.ts` | 検索/ページネーション時の順序保持 |
| `request-ip.ts` | Route Handler の Request からの IP 抽出（webhook / モバイル API のレート制限で共有） |
| `season.ts` | 季節判定ユーティリティ（getCurrentSeason、getSeasonInfo、getSeasonImagePath） |
| `seo.ts` | SEO メタデータ・JSON-LD 生成ヘルパー |

### lib/validations/ — バリデーション

| ファイル | 役割 |
|---------|------|
| `password.ts` | パスワードバリデーションルール |

---

## types/ — TypeScript型定義（7ファイル）

| ファイル | 役割 |
|---------|------|
| `action-result.ts` | Server Actions 返却型（success/error 統一）とヘルパー（actionSuccess / actionError / withAuth / andThenActionResult / mapActionResult） |
| `analytics.ts` | アナリティクス関連型定義 |
| `bonsai-care.ts` | 盆栽手入れログの共通型（`CareLogListItem` 等） |
| `global.d.ts` | グローバル型宣言（Window.adsbygoogle等） |
| `next-auth.d.ts` | NextAuth.jsセッション型拡張（user.id, isAdmin追加） |
| `notification.ts` | 通知種別定数・関連型（`VALID_NOTIFICATION_TYPES`、`isSystemNotification` 等） |
| `post.ts` | 投稿関連の共通型定義 |

---

## prisma/ — データベース（92モデル、25 enum、43マイグレーション）

```
prisma/
├── schema.prisma                    # Prismaスキーマ定義
├── seed.ts                          # シードエントリポイント
├── check-counts.ts                  # 各テーブルの件数チェックスクリプト
├── SEED-PESTICIDE-ORDER.md          # 農薬シード投入順序ドキュメント
├── seed/                            # ドメイン別シード
│   ├── dictionary/seed-dictionary.ts     # 盆栽用語辞典シード
│   ├── e2e/seed-e2e-data.ts              # E2E テスト用データシード
│   ├── fertilizer/seed-fertilizer-data.ts # 肥料ガイドシード
│   ├── genre/genre-data.ts               # ジャンルマスタシード
│   ├── hormone/seed-hormone-data.ts      # 植物ホルモンガイドシード
│   ├── pesticide/seed-pesticide-data.ts  # 農薬・病害虫シード（メイン）
│   ├── pesticide/seed-pesticide-additions.ts  # 農薬追加シード（第1弾）
│   ├── pesticide/seed-pesticide-additions2.ts # 農薬追加シード（第2弾）
│   ├── pesticide/seed-pesticide-all.ts   # 農薬全データ一括投入
│   ├── pesticide/seed-pesticide-validate.ts   # 農薬シード検証
│   └── shared/                           # シード用の共通ヘルパー（create-client, helpers, types）
├── seed-pesticide-archive/          # 旧農薬シードのアーカイブ
├── sql/                             # 補助SQL
├── validation/                      # 農薬データ正確性バリデーション
│   ├── PROCESS.md                   # バリデーションプロセス説明
│   ├── export-pesticide-data.ts     # シードデータ→CSV変換
│   ├── validate-against-maff.ts     # MAFF公式データとの突合スクリプト
│   ├── scrape-maff.ts               # MAFF農薬登録データ自動スクレイパー
│   ├── maff-reference.csv           # MAFF公式データ（人間が記入）
│   ├── maff-reference-pending.csv   # MAFF検証待ちデータ
│   ├── maff-reg-numbers.json        # MAFF登録番号データ
│   ├── maff-scrape-report.txt       # スクレイピング結果レポート
│   ├── pesticides.csv               # 農薬一覧（自動生成）
│   ├── ingredients.csv              # 有効成分一覧（自動生成）
│   ├── pest-links.csv               # 農薬⇔有効成分紐付け（自動生成）
│   ├── disease-pests.csv            # 病害虫一覧（自動生成）
│   ├── effects.csv                  # 効果データ（自動生成）
│   ├── formulation-types.csv        # 剤型データ（自動生成）
│   ├── columns.csv                  # コラムデータ（自動生成）
│   ├── spreader-types.csv           # 展着剤タイプ（自動生成）
│   ├── spreader-links.csv           # 展着剤紐付け（自動生成）
│   ├── incompatibilities.csv        # 混用不可データ（自動生成）
│   ├── validation-report.txt        # バリデーション結果（自動生成）
│   ├── audit_output.txt             # 監査出力
│   ├── baseline/                    # ベースラインCSV（検証済みスナップショット）
│   └── parsers/                     # CSVエクスポート用パーサー群
│       ├── index.ts                 # パーサーモジュールエクスポート
│       ├── config.ts                # シードファイルパス設定
│       ├── csv-utils.ts             # CSV入出力・重複除去ユーティリティ
│       ├── data-parser.ts           # seed-pesticide-data.ts用パーサー
│       ├── additions-parser.ts      # seed-pesticide-additions.ts用パーサー
│       ├── additions2-parser.ts     # seed-pesticide-additions2.ts用パーサー
│       ├── spray-parser.ts          # スプレー製品データ用パーサー
│       └── supplement-parser.ts     # 効果補完データ用パーサー（互換性のため残存）
└── migrations/                      # マイグレーション（43ディレクトリ）
```

### マイグレーション一覧（43ディレクトリ）

| ディレクトリ | 内容 |
|---------|------|
| `0_init` | 初期スキーマ |
| `20240201000000_add_fts_indexes` | 全文検索インデックス追加 |
| `20260127_add_birth_date` | 生年月日フィールド追加 |
| `20260128_add_system_settings` | システム設定テーブル追加 |
| `20260129_add_notification_preferences` | 通知設定テーブル追加 |
| `20260129_enable_rls` | RLS（行レベルセキュリティ）有効化 |
| `20260203_add_polls` | 投票機能テーブル追加 |
| `20260208_add_scheduled_posts_composite_index` | 予約投稿複合インデックス追加 |
| `20260222_add_enum_types` | Enumタイプ追加 |
| `20260224000000_add_email_verification_tokens` | メール確認トークン追加 |
| `20260225_add_rls_policies_and_fk_indexes` | RLSポリシーとFKインデックス追加 |
| `20260228100000_enable_rls_pesticide_and_email_tokens` | 農薬・メールトークンRLS有効化 |
| `20260301000000_add_pesticide_tables` | 農薬関連テーブル追加 |
| `20260302000000_pesticide_type_acaricide_no_herbicide` | 農薬タイプ修正（殺ダニ剤、除草剤除外） |
| `20260302100000_add_body_size_to_disease_pest` | 病害虫体サイズフィールド追加 |
| `20260303000000_enable_rls_public_tables` | 公開テーブルRLS有効化 |
| `20260304000000_enable_rls_pesticide_incompatibilities` | 農薬混用不可RLS有効化 |
| `20260307000000_add_resistance_risk_to_active_ingredient` | 有効成分に抵抗性リスク追加 |
| `20260308000000_add_pesticide_spreader_types` | 展着剤タイプテーブル追加 |
| `20260311000000_add_effect_rating_none` | 効果評価に「なし」追加 |
| `20260314_add_bonsai_terms` | 盆栽用語辞典テーブル追加 |
| `20260314000000_add_updated_at_to_post_comment_like_bookmark` | 投稿・コメント・いいね・ブックマークにupdatedAt追加 |
| `20260317000000_add_pagination_indexes` | ページネーションインデックス追加 |
| `20260317000001_add_shop_latitude_index` | 盆栽園緯度インデックス追加 |
| `20260401000000_add_weather_location_fields` | 天気位置情報フィールド追加 |
| `20260401000001_add_poll_vote_user_fk_and_indexes` | 投票ユーザーFK・インデックス追加 |
| `20260405_fix_indexes_and_constraints` | インデックス・制約修正 |
| `20260405000000_enable_rls_remaining_tables` | 残りテーブルRLS有効化 |
| `20260412000000_add_hormone_tables` | 植物ホルモン関連テーブル追加 |
| `20260414000000_add_hormone_rls_policies` | 植物ホルモンテーブルRLSポリシー追加 |
| `20260426000000_add_bonsai_care_log` | 盆栽手入れログ（`bonsai_care_logs` + `BonsaiCareType` enum）追加 |
| `20260427000000_add_hormone_techniques_table_and_rls` | 盆栽技法×ホルモン効果テーブル + RLS ポリシー追加 |
| `20260502000000_add_daily_visitors` | 日次訪問者ログテーブル（`daily_visitors`、`(date, visitor_id)` UNIQUE）追加 |
| `20260512000000_lock_handle_new_user_security` | `handle_new_user` トリガーのセキュリティ強化（SECURITY DEFINER の検査・search_path 固定） |
| `20260512100000_add_rls_policies_bonsai_care_logs_daily_visitors` | `bonsai_care_logs` / `daily_visitors` への RLS ポリシー追加（ユーザー自身のログのみ閲覧可、daily_visitors は service_role 限定） |
| `20260516000000_add_likes_check_constraint` | `likes` テーブルに CHECK 制約追加（投稿/コメントいずれか一方のみを指す整合性保証） |
| `20260527000000_revoke_data_api_grants_from_public` | Supabase Data API 用 grant を public/anon/authenticated から全剥奪 + 将来のデフォルト grant も REVOKE（Prisma postgres ロール経由のみに統一） |
| `20260530000000_add_payment_status_refunded` | 決済ステータスに `refunded`（返金）追加 |
| `20260531000000_add_post_edited_at_and_user_pinned_post` | 投稿に編集日時（`edited_at`）、ユーザーに固定投稿（pinned post）フィールド追加 |
| `20260531100000_add_comment_edited_at_and_user_onboarded_at` | コメントに編集日時、ユーザーにオンボーディング完了日時（`onboarded_at`）追加 |
| `20260602000000_add_repost_unique_constraint` | リポストの重複防止 UNIQUE 制約追加 |
| `20260612000000_add_refresh_tokens` | モバイル API v1 のリフレッシュトークンテーブル追加 |
| `20260618000000_add_mobile_devices` | モバイル Push デバイス（Expo トークン）テーブル追加 |

---

## public/ — 静的アセット

| ファイル/フォルダ | 役割 |
|---------|------|
| `ads.txt` | 広告認証ファイル |
| `apple-touch-icon.png` | Apple Touch Icon |
| `favicon.ico` | ファビコン |
| `file.svg` | 汎用ファイルアイコン |
| `icon-192.png` | PWA用192pxアイコン |
| `icon-512.png` | PWA用512pxアイコン |
| `logo.png` | BON-LOGロゴ |
| `offline.html` | オフライン時フォールバックページ（ダークモード対応） |
| `robots.txt` | 検索エンジンクローラー制御 |
| `site.webmanifest` | PWAマニフェスト（ショートカット、maskableアイコン対応） |
| `sw.js` | Service Worker（キャッシュ戦略、オフライン対応、更新通知） |
| `images/` | サイト画像（生成アセット、病害虫画像、農薬画像） |
| `images/pesticides/` | 病害虫・農薬関連画像（病害虫図鑑用） |
| `images/pests/` | 病害虫画像（害虫等） |
| `uploads/` | ユーザーアップロードファイル |
| `uploads/avatars/` | アバター画像 |
| `uploads/headers/` | ヘッダー画像 |
| `uploads/post-images/` | 投稿画像 |
| `uploads/post-videos/` | 投稿動画 |
| `uploads/comment-images/` | コメント画像 |
| `uploads/comment-videos/` | コメント動画 |
| `uploads/review-images/` | レビュー画像 |

---

## __tests__/ — ユニットテスト（Vitest、845ファイル）

テストファイルは `__tests__/` 配下にプロジェクト構造を反映して配置。Vitest 4.x を使用。内訳は `.test.ts` 353 + `.test.tsx` 492。

カバレッジ閾値: Branches 80% / Functions / Lines / Statements 85%（`@vitest/coverage-istanbul`）。
TypeScript 厳格設定: `strict: true` + `noUncheckedIndexedAccess: true`（2026-05-13 に true 化）。配列インデックスや `Map.get` の戻り値は `T | undefined` として絞り込む必要があり、テスト側も同様に整備済み。

---

## e2e/ — E2Eテスト（Playwright、60 specファイル）

| ファイル | 役割 |
|---------|------|
| `auth.setup.ts` | 認証セットアップ（テスト用ユーザーでログイン・storageState 保存） |
| `global-teardown.ts` | 全E2E終了後のクリーンアップ（テストユーザー削除等） |
| `teardown.ts` | E2E後クリーンアップ（追加teardown） |
| `locators.ts` | E2E用共通ロケータ・ヘルパー |
| `accessibility.spec.ts` | アクセシビリティテスト |
| `admin.spec.ts` | 管理者ページテスト（イベントインポート含む） |
| `admin-extended.spec.ts` | 管理者拡張テスト |
| `admin-moderation.spec.ts` | 管理者モデレーションテスト |
| `admin-new-pages.spec.ts` | 新規管理者ページテスト |
| `analytics.spec.ts` | アナリティクステスト |
| `auth.spec.ts` | 認証フロー（ログイン、登録、未認証リダイレクト） |
| `block-mute.spec.ts` | ブロック・ミュート機能テスト |
| `bonsai.spec.ts` / `bonsai-crud.spec.ts` | 盆栽成長記録テスト |
| `bonsai-filtering.spec.ts` | 盆栽フィルタリングテスト |
| `bookmarks.spec.ts` | ブックマーク機能テスト |
| `comment-interactions.spec.ts` | コメントインタラクションテスト |
| `comment-thread-mute.spec.ts` | コメントスレッドミュートテスト |
| `contact-form.spec.ts` | お問い合わせフォームテスト |
| `content-crud.spec.ts` / `content-detail.spec.ts` | コンテンツCRUD・詳細テスト |
| `dictionary.spec.ts` | 盆栽用語辞典テスト |
| `drafts.spec.ts` / `drafts-crud.spec.ts` | 下書き機能テスト |
| `error-handling.spec.ts` | エラーハンドリングテスト |
| `event-crud.spec.ts` / `events.spec.ts` | イベント機能テスト |
| `feed.spec.ts` | フィードページ表示・投稿フロー |
| `fertilizers.spec.ts` | 肥料機能テスト |
| `hashtag-navigation.spec.ts` | ハッシュタグナビゲーションテスト |
| `hormones.spec.ts` | 植物ホルモン機能テスト |
| `legal-pages.spec.ts` | 法的ページテスト |
| `maintenance.spec.ts` | メンテナンスページテスト |
| `messages.spec.ts` / `messages-flow.spec.ts` | ダイレクトメッセージテスト |
| `navigation.spec.ts` | ナビゲーションテスト |
| `notification-actions.spec.ts` | 通知アクションテスト |
| `notifications.spec.ts` | 通知機能テスト |
| `pesticides.spec.ts` | 農薬・病害虫テスト（トップ、検索、薬剤一覧、展着剤、剤型、原体、病害虫図鑑、コラム） |
| `polls.spec.ts` | 投票機能テスト |
| `post-interactions.spec.ts` | 投稿インタラクションテスト |
| `public-pages.spec.ts` | 公開ページテスト |
| `quote-repost.spec.ts` | 引用投稿・リポストテスト |
| `report.spec.ts` | 通報機能テスト |
| `responsive.spec.ts` | レスポンシブデザインテスト |
| `scheduled-posts.spec.ts` | 予約投稿テスト |
| `search.spec.ts` | 検索ページ・タブ切替・ジャンルフィルター |
| `settings.spec.ts` / `settings-advanced.spec.ts` / `settings-guest.spec.ts` | 設定ページテスト |
| `shop-reviews.spec.ts` / `shops.spec.ts` | 盆栽園マップ・レビューテスト |
| `social-interactions.spec.ts` | ソーシャルインタラクションテスト |
| `subscription.spec.ts` | サブスクリプションテスト |
| `two-factor-auth.spec.ts` | 2段階認証（TOTP）フローテスト |
| `user-actions.spec.ts` / `user-profile.spec.ts` / `user-profile-detail.spec.ts` / `user-profile-extended.spec.ts` | ユーザー・プロフィールテスト |
| `.auth/.gitkeep` | 認証状態保存ディレクトリ |

---

## scripts/ — ユーティリティスクリプト（17ファイル）

| ファイル | 役割 |
|---------|------|
| `setup-fts.ts` | 全文検索（FTS）セットアップ |
| `generate-openapi.ts` | モバイル API v1 の OpenAPI 仕様生成（`lib/api/v1/schemas/` を参照） |
| `backfill-hashtags.ts` | 既存投稿のハッシュタグ抽出・バックフィル |
| `audit-test-data.mjs` | テストデータの監査スクリプト |
| `call-seed-pesticide-api.mjs` | 本番環境の農薬シード投入API呼び出し |
| `call-seed-api.mjs` | 本番環境の統合シード投入API呼び出し（domain 引数: `genres` / `dictionary` / `fertilizer` / `hormone` / `guest` / `all`） |
| `call-apply-migration-api.mjs` | 本番環境のマイグレーション適用API（`/api/admin/apply-migration`）呼び出し |
| `seed-guest-user.ts` | ゲストユーザーのシード投入 |
| `delete-e2e-test-users.ts` | E2Eテスト用ユーザー削除 |
| `delete-e2e-users-production.ts` | 本番DBからE2Eテストユーザー削除 |
| `delete-duplicate-guest-user.ts` | 重複ゲストユーザー削除 |
| `delete-guest-nickname-user.ts` | ゲストニックネームユーザー削除 |
| `promote-admin-role.ts` | 指定ユーザーへの管理者ロール付与 |
| `fly-secrets-import.mjs` | `.env` から fly.io の secrets を一括インポート |
| `generate-pwa-icons.mjs` | PWAアイコン生成 |
| `convert-tutorial-pdf.js` | チュートリアルPDF変換（Mermaid図描画あり） |
| `convert-all-nomermaid-pdf.js` | チュートリアルPDF一括変換（Mermaidはコードブロック表示） |

---

## docs/ — ドキュメント

| ファイル | 役割 |
|---------|------|
| `requirements.md` | 要件定義書 |
| `TESTING.md` | テスト方針・ガイド |
| `project-structure.md` | プロジェクト構成一覧（本ドキュメント） |
| `api-spec.md` | API仕様書 |
| `new-pc-setup-guide.md` | 新規PC開発環境セットアップガイド |

### docs/plans/ — 計画・監査

| ファイル | 役割 |
|---------|------|
| `data-accuracy-audit-2026-04-05.md` | データ正確性監査 |
| `data-accuracy-audit-v2-2026-04-05.md` | データ正確性監査（v2） |
| `data-accuracy-audit-v3-2026-04-05.md` | データ正確性監査（v3） |
| `data-integrity-check-2026-04-05.md` | データ整合性チェック |
| `outsourcing-cost-estimate-2026-04-05.md` | 外注コスト見積もり |

### docs/code-reference/ — コードリファレンス

| ファイル | 役割 |
|---------|------|
| `00_INDEX.md` | リファレンス目次 |
| `02_lib_actions.md` | lib/actions リファレンス |
| `03_app.md` | app/ リファレンス |
| `04_components.md` | components/ リファレンス |
| `05_root.md` | ルートファイルリファレンス |

### docs/tutorial/ — チュートリアル

| ファイル | 役割 |
|---------|------|
| `00_index.md` | チュートリアル目次・全体構成 |
| `01_setup.md` | 環境構築・プロジェクトセットアップ |
| `02_web_basics.md` | Web基礎（HTML/CSS/JavaScript） |
| `03_typescript.md` | TypeScript入門 |
| `04_react.md` | React入門 |
| `05_nextjs.md` | Next.js入門 |
| `06_styling.md` | スタイリング（Tailwind CSS） |
| `07_database.md` | データベース（Prisma/PostgreSQL） |
| `08_auth.md` | 認証（NextAuth.js） |
| `09_posts.md` | 投稿機能 |
| `10_social.md` | ソーシャル機能 |
| `11_upload.md` | ファイルアップロード |
| `12_search.md` | 検索機能 |
| `13_notifications.md` | 通知機能 |
| `14_messages.md` | メッセージ機能 |
| `15_bonsai.md` | 盆栽成長記録 |
| `16_map.md` | 盆栽園マップ |
| `17_events.md` | イベント機能 |
| `18_admin.md` | 管理者機能 |
| `19_payment.md` | 決済・プレミアム |
| `20_security.md` | セキュリティ |
| `21_testing.md` | テスト |
| `22_deploy.md` | デプロイ |

### docs/tutorial/pdf/ — チュートリアルPDF版

各チュートリアルのPDF版が格納されている（`scripts/` のPDF変換スクリプトで生成）。

---

## .github/ — GitHub設定

| ファイル | 役割 |
|---------|------|
| `dependabot.yml` | Dependabot依存関係自動更新設定 |
| `pull_request_template.md` | PRテンプレート |
| `workflows/ci.yml` | CIワークフロー（Lint & Type Check、Security Scan、Unit Tests、Build、E2E） |
| `workflows/fly-deploy.yml` | fly.io 本番デプロイ（amd64 ランナーで `flyctl deploy --local-only` を実行） |
| `workflows/cron.yml` | 定期ジョブ実行（予約投稿公開・サブスク確認・イベント清掃・天気更新の cron。Vercel Cron の代替） |
| `workflows/lighthouse.yml` | Lighthouse CI パフォーマンス監査（push + PR） |
| `workflows/seed-pesticide-production.yml` | 農薬シード本番投入ワークフロー |

---

## 統計サマリー（2026-06-28時点）

| 項目 | 数量 |
|------|------|
| app/ ルートグループ | 4 (auth, legal, main, public) + admin + api + auth + feed.xml + maintenance |
| app/(main)/ 機能エリア | 19 |
| app/(legal)/ ページ | 5 (accessibility, account-deletion, privacy, terms, tokushoho) |
| app/ 全 page.tsx | 132 |
| app/ 全 layout.tsx | 9 |
| app/admin/ サブディレクトリ | 28 |
| app/api/ 総ルート | 100 ハンドラ（`route.ts` 99 + `og/route.tsx` 1。うちモバイル API v1 `/api/v1/*` 75 本）+ `upload/_shared/` 2 ヘルパー + `/feed.xml` + `/auth/callback` |
| components/ サブディレクトリ | 35 |
| components/ ファイル数 | 283（`.tsx` 268 + `.ts` 15） |
| hooks/ カスタムフック | 7 |
| lib/ ルートファイル | 29 |
| lib/actions/ ファイル | root 68 + admin/20 + schemas/1（合計 89 .ts）。大半が `'use server'`、残りが `'server-only'` データ取得 / 内部 helper / barrel |
| lib/api/ ファイル | 14（seed-auth + v1/ モバイル基盤: jwt / auth-guard / token-pair / mobile-2fa-ticket / response / pagination / types / mention-resolver / follow-state-resolver / index / schemas×3） |
| lib/build/ ファイル | 2（db-availability / static-params） |
| lib/config/ ファイル | 1（image-remote-patterns） |
| lib/prisma/ ファイル | 1（shared-includes.ts — 依存方向中立な Prisma include/select 形状の集約） |
| lib/services/ ファイル | 61（`push/expo-push.ts` を含む。read/write service の分離で Web/モバイル両 API がドメインロジックを共有） |
| lib/search/ ファイル | 3（fulltext / fulltext-config / fulltext-search） |
| lib/shop/ ファイル | 1（change-request.ts — 旧 services/shop-change-helpers から layer-neutral utility として移動） |
| lib/storage/ ファイル | 8（index barrel + types/helpers/image-sanitize + r2/local/supabase provider + s3-sign） |
| lib/constants/ ファイル | ルート 24 + errors/ 8 + limits/ 20 + legal/ 1（合計 53） |
| lib/utils/ ファイル | 14 |
| types/ ファイル | 7 |
| prisma/ モデル数 | 92 |
| prisma/ enum数 | 25 |
| prisma/ マイグレーション | 43 |
| prisma/ シード構成 | `seed.ts` + `seed/` ドメイン別（dictionary, e2e, fertilizer, genre, hormone, pesticide, shared） |
| __tests__/ テストファイル | 968（`.test.ts` 468 + `.test.tsx` 500。components / lib / app / coverage-boost / prisma / hooks / types / その他） |
| __tests__/ カバレッジ閾値 | Branches 80% / Functions 85% / Lines 85% / Statements 85% |
| TypeScript 厳格設定 | `strict: true` + `noUncheckedIndexedAccess: true`（2026-05-13 に true 化） |
| e2e/ specファイル | 60（Playwright、CI ワーカー数 3） |
| scripts/ ファイル | 17 |
| .github/workflows/ | 5（ci / fly-deploy / cron / lighthouse / seed-pesticide-production） |
| デプロイ基盤 | fly.io（app `bon-log`、nrt/東京）。DB=Supabase / Storage=Cloudflare R2 / Cache=Upstash Redis / Email=Resend / 決済=Stripe / 監視=Sentry はすべて外部サービス。本番ドメイン: https://www.bon-log.com |
