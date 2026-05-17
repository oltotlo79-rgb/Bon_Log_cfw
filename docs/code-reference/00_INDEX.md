# 全コードリファレンス — 索引

このフォルダでは、BON-LOG の**アプリケーションコードをファイル単位で漏れなく解説**しています。  
各ファイルの役割・主要な処理・型・エクスポートを一覧し、詳細は対応するドキュメント内のセクションで確認できます。

- **01_lib.md** … `lib/` 直下・constants・auth・db・redis・cache・logger・security・email・storage・search・services など
- **02_lib_actions.md** … `lib/actions/` の全 Server Actions（post, feed, user, comment, like, follow, message, search, shop, event, admin 等）
- **03_app.md** … `app/` の全ルート（ページ・レイアウト・API・loading/error/not-found）
- **04_components.md** … `components/` の全コンポーネント
- **05_root.md** … ルートの `proxy.ts`, `types/`, `instrumentation.ts`, Next/Sentry 設定など

---

## 1. lib/ — 一覧と解説リンク

| ファイル | 役割（要約） | 詳細 |
|----------|--------------|------|
| `lib/db.ts` | PrismaClient シングルトン、PostgreSQL 接続プール | [01_lib.md](01_lib.md) |
| `lib/auth.ts` | NextAuth 設定（Credentials, JWT, PrismaAdapter） | [01_lib.md#auth](01_lib.md) |
| `lib/auth.config.ts` | NextAuth の callbacks・trustHost 等 | [01_lib.md#auth-config](01_lib.md) |
| `lib/redis.ts` | Upstash Redis クライアント | [01_lib.md#redis](01_lib.md) |
| `lib/cache.ts` | キャッシュヘルパー（Redis 利用） | [01_lib.md#cache](01_lib.md) |
| `lib/logger.ts` | アプリロガー | [01_lib.md#logger](01_lib.md) |
| `lib/utils.ts` | 汎用ユーティリティ（日付等） | [01_lib.md#utils](01_lib.md) |
| `lib/rate-limit.ts` | レート制限（Redis 利用） | [01_lib.md#rate-limit](01_lib.md) |
| `lib/csrf.ts` | CSRF 検証（Webhook/Cron 除外） | [01_lib.md#csrf](01_lib.md) |
| `lib/cron-auth.ts` | Cron ジョブ用 HMAC 認証 | [01_lib.md#cron-auth](01_lib.md) |
| `lib/sanitize.ts` | 投稿テキストのサニタイズ | [01_lib.md#sanitize](01_lib.md) |
| `lib/security-checks.ts` | セキュリティチェック集 | [01_lib.md#security-checks](01_lib.md) |
| `lib/security-logger.ts` | セキュリティイベントログ | [01_lib.md#security-logger](01_lib.md) |
| `lib/login-tracker.ts` | ログイン試行・ブロック | [01_lib.md#login-tracker](01_lib.md) |
| `lib/two-factor.ts` | 2段階認証（TOTP） | [01_lib.md#two-factor](01_lib.md) |
| `lib/fingerprint.ts` | デバイスフィンガープリント | [01_lib.md#fingerprint](01_lib.md) |
| `lib/file-validation.ts` | アップロードファイル検証 | [01_lib.md#file-validation](01_lib.md) |
| `lib/client-image-compression.ts` | クライアント側画像圧縮 | [01_lib.md#client-image-compression](01_lib.md) |
| `lib/premium.ts` | プレミアム会員判定・制限取得 | [01_lib.md#premium](01_lib.md) |
| `lib/stripe.ts` | Stripe クライアント・チェックアウト | [01_lib.md#stripe](01_lib.md) |
| `lib/prefectures.ts` | 都道府県データ | [01_lib.md#prefectures](01_lib.md) |
| `lib/mention-utils.ts` | @メンション抽出・検証 | [01_lib.md#mention-utils](01_lib.md) |
| `lib/constants/errors.ts` | エラーメッセージ定数 | [01_lib.md#constants-errors](01_lib.md) |
| `lib/constants/limits.ts` | 投稿数・画像数等の上限定数 | [01_lib.md#constants-limits](01_lib.md) |
| `lib/constants/routes.ts` | パス定数 | [01_lib.md#constants-routes](01_lib.md) |
| `lib/constants/status.ts` | ステータス定数 | [01_lib.md#constants-status](01_lib.md) |
| `lib/constants/storage.ts` | ストレージフォルダ名 | [01_lib.md#constants-storage](01_lib.md) |
| `lib/constants/report.ts` | 通報種別定数 | [01_lib.md#constants-report](01_lib.md) |
| `lib/constants/locations.ts` | 地域ブロック等 | [01_lib.md#constants-locations](01_lib.md) |
| `lib/validations/password.ts` | パスワードバリデーション | [01_lib.md#validations-password](01_lib.md) |
| `lib/security/nonce.ts` | CSP nonce 生成 | [01_lib.md#security-nonce](01_lib.md) |
| `lib/security/index.ts` | セキュリティモジュール export | [01_lib.md#security-index](01_lib.md) |
| `lib/email/index.ts` | メール送信（Resend） | [01_lib.md#email](01_lib.md) |
| `lib/storage/index.ts` | R2 アップロード・削除 | [01_lib.md#storage](01_lib.md) |
| `lib/search/fulltext.ts` | 全文検索（pg_trgm 等） | [01_lib.md#search-fulltext](01_lib.md) |
| `lib/services/usage.ts` | 利用統計取得 | [01_lib.md#services-usage](01_lib.md) |
| `lib/scraping/bonsai-events.ts` | イベントスクレイピング | [01_lib.md#scraping-bonsai-events](01_lib.md) |

---

## 2. lib/actions/ — 一覧と解説リンク

| ファイル | 役割（要約） | 詳細 |
|----------|--------------|------|
| `lib/actions/utils.ts` | requireAuth, requireActiveUser, requireAdmin, getClientIp, ActionResult 型 | [02_lib_actions.md#utils](01_lib.md) |
| `lib/actions/auth.ts` | 登録・パスワードリセット・メール確認 | [02_lib_actions.md#auth](01_lib.md) |
| `lib/actions/post.ts` | 投稿作成・削除・取得・引用・リポスト・メディア | [02_lib_actions.md#post](01_lib.md) |
| `lib/actions/feed.ts` | タイムライン取得（フォロー・全体） | [02_lib_actions.md#feed](01_lib.md) |
| `lib/actions/comment.ts` | コメント作成・削除・取得 | [02_lib_actions.md#comment](01_lib.md) |
| `lib/actions/like.ts` | いいね付け外し | [02_lib_actions.md#like](01_lib.md) |
| `lib/actions/bookmark.ts` | ブックマーク追加・削除・一覧 | [02_lib_actions.md#bookmark](01_lib.md) |
| `lib/actions/follow.ts` | フォロー・アンフォロー | [02_lib_actions.md#follow](01_lib.md) |
| `lib/actions/follow-request.ts` | フォローリクエスト送信・承認・拒否 | [02_lib_actions.md#follow-request](01_lib.md) |
| `lib/actions/user.ts` | プロフィール取得・更新・アカウント削除 | [02_lib_actions.md#user](01_lib.md) |
| `lib/actions/notification.ts` | 通知取得・既読 | [02_lib_actions.md#notification](01_lib.md) |
| `lib/actions/notification-preferences.ts` | 通知設定の取得・更新 | [02_lib_actions.md#notification-preferences](01_lib.md) |
| `lib/actions/message.ts` | DM 会話・メッセージ送信・取得 | [02_lib_actions.md#message](01_lib.md) |
| `lib/actions/mention.ts` | メンション通知 | [02_lib_actions.md#mention](01_lib.md) |
| `lib/actions/hashtag.ts` | ハッシュタグの投稿への紐付け | [02_lib_actions.md#hashtag](01_lib.md) |
| `lib/actions/search.ts` | 投稿・ユーザー・ハッシュタグ検索 | [02_lib_actions.md#search](01_lib.md) |
| `lib/actions/draft.ts` | 下書き CRUD | [02_lib_actions.md#draft](01_lib.md) |
| `lib/actions/scheduled-post.ts` | 予約投稿 CRUD・公開 | [02_lib_actions.md#scheduled-post](01_lib.md) |
| `lib/actions/poll.ts` | 投票作成・投票実行・結果取得 | [02_lib_actions.md#poll](01_lib.md) |
| `lib/actions/bonsai.ts` | 盆栽・成長記録 CRUD | [02_lib_actions.md#bonsai](01_lib.md) |
| `lib/actions/shop.ts` | 盆栽園 CRUD・検索・レビュー・変更リクエスト | [02_lib_actions.md#shop](01_lib.md) |
| `lib/actions/review.ts` | 盆栽園レビュー作成・削除 | [02_lib_actions.md#review](01_lib.md) |
| `lib/actions/event.ts` | イベント CRUD・一覧 | [02_lib_actions.md#event](01_lib.md) |
| `lib/actions/event-import.ts` | イベント CSV インポート | [02_lib_actions.md#event-import](01_lib.md) |
| `lib/actions/block.ts` | ブロック・ブロック解除 | [02_lib_actions.md#block](01_lib.md) |
| `lib/actions/mute.ts` | ミュート・ミュート解除 | [02_lib_actions.md#mute](01_lib.md) |
| `lib/actions/comment-thread-mute.ts` | コメントスレッドミュート | [02_lib_actions.md#comment-thread-mute](01_lib.md) |
| `lib/actions/report.ts` | 通報作成・一覧（管理者用） | [02_lib_actions.md#report](01_lib.md) |
| `lib/actions/hide-post.ts` | 投稿の非表示（管理者用） | [02_lib_actions.md#hide-post](01_lib.md) |
| `lib/actions/contact.ts` | お問い合わせ送信・管理 | [02_lib_actions.md#contact](01_lib.md) |
| `lib/actions/blacklist.ts` | メール・デバイスブラックリスト | [02_lib_actions.md#blacklist](01_lib.md) |
| `lib/actions/maintenance.ts` | メンテナンスモード ON/OFF | [02_lib_actions.md#maintenance](01_lib.md) |
| `lib/actions/subscription.ts` | Stripe サブスク・ポータル | [02_lib_actions.md#subscription](01_lib.md) |
| `lib/actions/analytics.ts` | アナリティクスデータ取得 | [02_lib_actions.md#analytics](01_lib.md) |
| `lib/actions/two-factor.ts` | 2段階認証の有効化・無効化 | [02_lib_actions.md#two-factor](01_lib.md) |
| `lib/actions/admin.ts` | 管理者用ユーザー・投稿・通報等操作 | [02_lib_actions.md#admin](01_lib.md) |
| `lib/actions/admin/hidden.ts` | 非表示コンテンツ一覧・復元 | [02_lib_actions.md#admin-hidden](01_lib.md) |
| `lib/actions/admin/premium.ts` | 管理者用プレミアム操作 | [02_lib_actions.md#admin-premium](01_lib.md) |
| `lib/actions/filter-helper.ts` | 一覧フィルタ用ヘルパー | [02_lib_actions.md](01_lib.md) |

---

## 3. app/ — 一覧と解説リンク

ルート・( auth )・( main )・( public )・( legal )・admin・api・maintenance の全ファイルは **[03_app.md](./03_app.md)** で解説しています。  
各 `page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx` / `not-found.tsx` および API の `route.ts` をファイルパスごとに記載しています。

---

## 4. components/ — 一覧と解説リンク

ads, analytics, auth, bonsai, comment, common, contact, draft, event, feed, layout, message, notification, post, report, search, settings, shop, subscription, theme, user, seo の全コンポーネントは **[04_components.md](./04_components.md)** で解説しています。

---

## 5. ルート・types — 一覧と解説リンク

| ファイル | 役割（要約） | 詳細 |
|----------|--------------|------|
| `proxy.ts` | 認証・リダイレクト・CSP・メンテナンス | [05_root.md](05_root.md) |
| `instrumentation.ts` | Sentry 初期化 | [05_root.md](05_root.md) |
| `next.config.ts` | Next.js 設定 | [05_root.md](05_root.md) |
| `sentry.client.config.ts` | Sentry クライアント | [05_root.md](05_root.md) |
| `sentry.server.config.ts` | Sentry サーバー | [05_root.md](05_root.md) |
| `sentry.edge.config.ts` | Sentry Edge | [05_root.md](05_root.md) |
| `types/action-result.ts` | ActionResult 型・actionSuccess/actionError | [05_root.md](05_root.md) |
| `types/next-auth.d.ts` | NextAuth Session 型拡張 | [05_root.md](05_root.md) |

---

**読み方**: 各「詳細」リンク先のドキュメント内で、該当ファイルの**役割・主要な処理・コードブロックの解説**を記載しています。  
チュートリアル（`docs/tutorial/`）は機能・概念ごとの学習用、本 code-reference は**ファイル単位の網羅的な解説**用です。
