# app/ 全ファイル解説

Next.js App Router の全ルート・レイアウト・API をファイル単位で解説します。  
各 `page.tsx` はそのルートの UI、`layout.tsx` は子ルート共通のレイアウト、`loading.tsx` は Suspense フォールバック、`error.tsx` はエラーバウンダリ、`not-found.tsx` は `notFound()` 時の表示です。

---

## ルート直下

| ファイル | 役割・解説 |
|----------|------------|
| `layout.tsx` | ルートレイアウト。`<html>` / `<body>`、`globals.css`、`Providers`（SessionProvider, ThemeProvider, ServiceWorkerRegistration 等）でラップ。 |
| `page.tsx` | ホーム（ランディング）ページ。未認証はこちらを表示、認証済みは `/feed` へリダイレクトする場合あり。 |
| `loading.tsx` | ルートの共通ローディング（存在する場合）。 |
| `global-error.tsx` | ルートレベルのエラーバウンダリ。`'use client'` 必須。クラッシュ時に表示。 |
| `globals.css` | Tailwind の読み込みと、テーマ変数・ベーススタイル。 |
| `providers.tsx` | クライアント用プロバイダー群。SessionProvider, ThemeProvider, Toaster, ServiceWorkerRegistration, KeyboardShortcutsProvider 等。 |
| `robots.ts` | `robots.txt` を動的生成。本番では許可、開発では Disallow 等を返す。 |
| `sitemap.ts` | サイトマップ XML を動的生成。投稿・ユーザー・イベント・盆栽園の URL を列挙。 |
| `feed.xml/route.ts` | RSS フィード（XML）を返す Route Handler。直近の投稿を配信。 |

---

## app/(auth)/ — 認証ページ

| ファイル | 役割・解説 |
|----------|------------|
| `layout.tsx` | 認証用レイアウト。中央配置・ロゴ等。 |
| `loading.tsx` | 認証ページのローディング。 |
| `login/page.tsx` | ログインフォーム。Credentials で `signIn()`。成功時は callbackUrl または `/feed` へ。 |
| `register/page.tsx` | ユーザー登録。`lib/actions/auth.ts` の登録 Action を呼び、メール確認案内を表示。 |
| `password-reset/page.tsx` | パスワードリセット要求。メール送信後は案内メッセージ。 |
| `password-reset/confirm/page.tsx` | トークン付き URL でアクセス。新パスワード入力とリセット実行。 |
| `verify-email/page.tsx` | メール確認用トークンでアクセス。確認済みに更新後、ログインへ誘導。 |

---

## app/(main)/ — メインアプリ（認証必須）

| ファイル | 役割・解説 |
|----------|------------|
| `layout.tsx` | 3 カラムレイアウト。左 `Sidebar`、中央 `children`、右 `RightSidebar`。認証未済は proxy で `/login` へ。 |
| `loading.tsx` | メインエリアの共通ローディング。 |
| `feed/page.tsx` | タイムライン。`getFeed()` で投稿を取得し、`Timeline` や `FeedWithCompose` を表示。 |
| `feed/loading.tsx` / `feed/error.tsx` | フィードのローディング・エラー。 |
| `search/page.tsx` | 検索。クエリに応じて `searchPosts` / `searchUsers` / `searchHashtags` を呼び、`SearchResults` で表示。 |
| `search/loading.tsx` / `search/error.tsx` | 検索のローディング・エラー。 |
| `notifications/page.tsx` | 通知一覧。`getNotifications()` と `markNotificationsRead`。 |
| `notifications/loading.tsx` / `notifications/error.tsx` | 通知のローディング・エラー。 |
| `bookmarks/page.tsx` | ブックマーク一覧。`BookmarkPostList` で `getBookmarks()` の結果を表示。 |
| `bookmarks/BookmarkPostList.tsx` | ブックマーク投稿リストのクライアント表示。 |
| `bookmarks/loading.tsx` / `bookmarks/error.tsx` | ブックマークのローディング・エラー。 |
| `messages/page.tsx` | DM 一覧。`getConversations()` で会話リストを表示。 |
| `messages/[conversationId]/page.tsx` | 会話詳細。`getMessages()` でメッセージ一覧、`MessageForm` で送信。 |
| `messages/loading.tsx` / `messages/error.tsx` | メッセージのローディング・エラー。 |
| `posts/[id]/page.tsx` | 投稿詳細。`getPost(id)` で 1 件取得。コメント・いいね・ブックマークを表示。 |
| `posts/[id]/loading.tsx` / `posts/[id]/error.tsx` / `posts/[id]/not-found.tsx` | 投稿詳細のローディング・エラー・404。 |
| `posts/scheduled/page.tsx` | 予約投稿一覧。`getScheduledPosts()`。 |
| `posts/scheduled/new/page.tsx` | 予約投稿作成。`ScheduledPostForm`。 |
| `posts/scheduled/[id]/edit/page.tsx` | 予約投稿編集。 |
| `posts/scheduled/loading.tsx` | 予約投稿のローディング。 |
| `users/[id]/page.tsx` | ユーザープロフィール。`getUser(id)`。`ProfileHeader`・`ProfileTabs`（投稿/いいね/フォロワー等）。 |
| `users/[id]/loading.tsx` / `users/[id]/error.tsx` | プロフィールのローディング・エラー。 |
| `users/[id]/posts/page.tsx` | そのユーザーの投稿一覧。 |
| `users/[id]/followers/page.tsx` | フォロワー一覧。 |
| `users/[id]/following/page.tsx` | フォロー中一覧。 |
| `users/[id]/likes/page.tsx` | いいねした投稿一覧。 |
| `bonsai/page.tsx` | 盆栽一覧。`getBonsaiList()`。`BonsaiListClient` で表示。 |
| `bonsai/new/page.tsx` | 盆栽新規登録。`BonsaiForm`。 |
| `bonsai/[id]/page.tsx` | 盆栽詳細。成長記録タイムライン付き。 |
| `bonsai/[id]/edit/page.tsx` | 盆栽編集。 |
| `bonsai/loading.tsx` / `bonsai/error.tsx` / `[id]/loading.tsx` | 盆栽のローディング・エラー。 |
| `drafts/page.tsx` | 下書き一覧。`getDrafts()`。 |
| `drafts/[id]/edit/page.tsx` | 下書き編集。`DraftEditForm`。 |
| `drafts/loading.tsx` | 下書きのローディング。 |
| `shops/page.tsx` | 盆栽園マップ。`searchShops` で一覧取得。`Map`・`ShopList`・`ShopSearchForm`。 |
| `shops/ShopSearchForm.tsx` | 盆栽園検索フォーム（クライアント）。 |
| `shops/new/page.tsx` | 盆栽園新規登録。`ShopForm`。 |
| `shops/[id]/page.tsx` | 盆栽園詳細。レビュー・地図表示。 |
| `shops/[id]/edit/page.tsx` | 盆栽園編集（オーナーまたは管理者）。 |
| `shops/loading.tsx` / `shops/error.tsx` / `[id]/loading.tsx` / `[id]/error.tsx` | 盆栽園のローディング・エラー。 |
| `events/page.tsx` | イベント一覧。カレンダー表示。`getEvents`・`RegionFilter`・`ShowPastToggle`。 |
| `events/new/page.tsx` | イベント新規作成。`EventForm`。 |
| `events/[id]/page.tsx` | イベント詳細。`DeleteEventButton` で削除。 |
| `events/[id]/edit/page.tsx` | イベント編集。 |
| `events/loading.tsx` / `events/error.tsx` / `[id]/loading.tsx` / `[id]/error.tsx` | イベントのローディング・エラー。 |
| `events/[id]/DeleteEventButton.tsx` | イベント削除ボタン（Client Component）。 |
| `analytics/page.tsx` | アナリティクス（プレミアム）。`getAnalytics()` でデータ取得。グラフ・ヒートマップ・キーワードクラウド等。 |
| `analytics/loading.tsx` / `analytics/error.tsx` | アナリティクスのローディング・エラー。 |
| `settings/page.tsx` | 設定メニュー。アカウント・プロフィール・通知・セキュリティ・ブロック・ミュート・フォローリクエスト・プレミアムへのリンク。 |
| `settings/account/page.tsx` | アカウント設定（メール・パスワード・削除）。 |
| `settings/profile/page.tsx` | プロフィール編集。`ProfileEditForm`・`AvatarUploader`・`HeaderUploader`・`PrivacyToggle`。 |
| `settings/notifications/page.tsx` | 通知設定。`NotificationPreferences`。 |
| `settings/security/page.tsx` | セキュリティ（2 段階認証）。`TwoFactorSettings`。 |
| `settings/blocked/page.tsx` | ブロック一覧。`BlockedUserList`。 |
| `settings/muted/page.tsx` | ミュート一覧。`MutedUserList`。 |
| `settings/follow-requests/page.tsx` | フォローリクエスト。`FollowRequestsClient` で承認/拒否。 |
| `settings/subscription/page.tsx` | プレミアム会員。`SubscriptionStatus`・`PaymentHistory`・Stripe ポータルリンク。 |
| 各 `settings/*/loading.tsx` | 設定サブページのローディング。 |
| `settings/error.tsx` | 設定のエラーバウンダリ。 |

---

## app/(public)/ — 公開ページ（認証不要）

| ファイル | 役割・解説 |
|----------|------------|
| `layout.tsx` | 公開ページ用レイアウト。 |
| `about/page.tsx` | BON-LOG について。 |
| `help/page.tsx` | ヘルプ。 |
| `contact/page.tsx` | お問い合わせ。`ContactForm` で送信。 |

---

## app/(legal)/ — 法務・規約

| ファイル | 役割・解説 |
|----------|------------|
| `layout.tsx` | 法務ページ用レイアウト。 |
| `terms/page.tsx` | 利用規約。 |
| `privacy/page.tsx` | プライバシーポリシー。 |
| `tokushoho/page.tsx` | 特定商取引法に基づく表記。 |

---

## app/admin/ — 管理者ダッシュボード

| ファイル | 役割・解説 |
|----------|------------|
| `layout.tsx` | 管理者レイアウト。`requireAdmin` 相当のチェック、管理者用ナビ。 |
| `loading.tsx` / `page.tsx` | ダッシュボードトップ。統計概要・Sentry エラー表示（`SentryErrors.tsx`）。 |
| `users/page.tsx` | ユーザー管理一覧。`UserActionsDropdown`（停止・削除等）。 |
| `users/[id]/page.tsx` | ユーザー詳細。`UserDetailActions`。 |
| `users/loading.tsx` | ユーザー管理のローディング。 |
| `posts/page.tsx` | 投稿管理。`PostActionsDropdown`。 |
| `reports/page.tsx` | 通報管理。`ReportActionsDropdown` でステータス変更。 |
| `reviews/page.tsx` | レビュー管理。`ReviewActionsDropdown`。 |
| `shops/page.tsx` | 盆栽園管理。`ShopActionsDropdown`。 |
| `shop-requests/page.tsx` | 盆栽園変更リクエスト。`ShopRequestActions` で承認/拒否。 |
| `events/page.tsx` | イベント管理。`EventActionsDropdown`。イベントインポートへのリンク。 |
| `events/import/page.tsx` | イベント CSV インポート。`EventImportClient`。 |
| `events/import/EventImportClient.tsx` | インポート用クライアントコンポーネント。 |
| `hidden/page.tsx` | 非表示コンテンツ一覧。`HiddenContentList`・`AdminNotificationBanner`。 |
| `blacklist/page.tsx` | ブラックリスト。`BlacklistTabs`（メール/デバイス）。 |
| `contact/page.tsx` | お問い合わせ管理。`ContactActionsDropdown`。 |
| `contact/[id]/page.tsx` | お問い合わせ詳細。`ContactDetailActions`。 |
| `premium/page.tsx` | プレミアム会員管理。`PremiumActionsDropdown`。 |
| `maintenance/page.tsx` | メンテナンスモード。`MaintenanceForm` で ON/OFF。 |
| `logs/page.tsx` | 管理者操作ログ一覧。 |
| `stats/page.tsx` | 統計ダッシュボード。`StatsChartsWrapper` で recharts を動的インポート（`ssr: false`）。 |
| `stats/StatsChartsWrapper.tsx` | Client ラッパー。内部で `StatsCharts` を `next/dynamic`（ssr: false）で読み込む。 |
| `stats/StatsCharts.tsx` | 統計グラフ（recharts）。 |
| `usage/page.tsx` | システム利用統計。`UsageCards`。`lib/services/usage.ts` のデータを表示。 |

---

## app/api/ — API ルート

| ファイル | 役割・解説 |
|----------|------------|
| `auth/[...nextauth]/route.ts` | NextAuth の GET/POST。`handlers` を export。 |
| `upload/route.ts` | 汎用アップロード。multipart で受け取り、`file-validation` で検証後、R2 またはストレージに保存。 |
| `upload/avatar/route.ts` | アバター画像専用。サイズ・MIME チェック後、ストレージに保存し URL を返す。 |
| `upload/header/route.ts` | ヘッダー画像専用。同様に検証・保存。 |
| `upload/presigned/route.ts` | R2 の presigned URL を発行。クライアントが直接アップロードする方式で使用。 |
| `upload/_shared/profile-image-upload.ts` | アバター/ヘッダー共通の検証・保存ロジック。 |
| `cron/publish-scheduled/route.ts` | Cron: 予約投稿の自動公開。`verifyCronAuth` で認証後、`lib/services/scheduled-post-publisher.ts` の `publishDueScheduledPosts()` を実行。GitHub Actions（`.github/workflows/cron.yml`）が 5 分毎に起動。 |
| `cron/check-subscriptions/route.ts` | Cron: サブスク期限切れチェック。`checkPremiumExpiry()` と期限切れメール送信。 |
| `cron/cleanup-events/route.ts` | Cron: 終了イベントのクリーンアップ。一定期間経過したイベントを非表示または削除。 |
| `webhooks/stripe/route.ts` | Stripe Webhook。署名検証後、`checkout.session.completed` 等を処理し、DB のプレミアム状態を更新。 |
| `health/route.ts` | ヘルスチェック。GET で 200 を返す。 |
| `maintenance/status/route.ts` | メンテナンスモードの状態を返す。middleware が参照。 |
| `badges/route.ts` | バッジ/実績データを返す（取得条件・表示用）。 |
| `ad-frame/route.ts` | 広告用 iframe のレンダリング。AdSense 等。 |
| `og/route.tsx` | OG 画像の動的生成。@vercel/og 等で画像を生成し、PNG で返す。 |
| `admin/sentry/route.ts` | 管理者用。Sentry のエラー一覧取得。 |
| `admin/usage/route.ts` | 管理者用。利用統計 API。`lib/services/usage.ts` を呼ぶ。 |
| `admin/search/setup/route.ts` | 管理画面の検索用（必要に応じて）。 |

---

## app/auth/ — 認証コールバック等

| ファイル | 役割・解説 |
|----------|------------|
| `callback/route.ts` | OAuth 等のコールバック。NextAuth のコールバック URL として使用する場合。 |

---

## app/maintenance/ — メンテナンス表示

| ファイル | 役割・解説 |
|----------|------------|
| `page.tsx` | メンテナンス中に表示するページ。 |
| `logout-button.tsx` | メンテナンス中でもログアウトできるボタン。 |

---

以上が `app/` の全ファイルの解説です。  
ルートとコンポーネントの対応は [04_components.md](./04_components.md) を、API の内部ロジックは [01_lib.md](./01_lib.md) と [02_lib_actions.md](./02_lib_actions.md) を参照してください。
