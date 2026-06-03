# BON-LOG API 仕様書

## 認証方式

| 方式 | 説明 |
|------|------|
| Session | NextAuth.js JWT セッション (`auth()`) — cookie ベース |
| ActiveUser | セッション + 凍結チェック + レート制限 (`requireActiveUser()`) |
| ActiveNonGuest | セッション + 非ゲスト + 凍結チェック + レート制限 (`requireActiveNonGuestUser()`) |
| Admin | セッション + `adminUser` レコード + 権限チェック (`requireAdmin()`) |
| HMAC-SHA256 | Cron ジョブ用: タイムスタンプ + 署名検証 (`verifyCronAuth()`) |
| Stripe Webhook | `stripe.webhooks.constructEvent()` 署名検証 |
| Bearer | Bearer トークン (タイミングセーフ比較) — シードエンドポイント用 |
| None | 認証不要 |

---

## レスポンス形式

### 成功レスポンス

```json
{ "success": true, "data": { ... } }
```

### エラーレスポンス

```json
{ "success": false, "error": "エラーメッセージ" }
```

エラーメッセージは `lib/constants/errors/` 配下のドメイン別定数（`auth.ts` / `content.ts` / `entity.ts` / `social.ts` / `features.ts` / `admin.ts`）を使用し、barrel export `lib/constants/errors/index.ts` 経由でも import 可能。インライン文字列は禁止。

---

## API Routes (`app/api/` 配下 24 Route Handlers + `/feed.xml` + `/auth/callback` = 26 エンドポイント)

`app/api/` 配下: `.ts` 形式の Route Handler 23 本 + `og/route.tsx`（動的 OG 画像生成、Node.js ランタイム）の合計 24 本。
さらに `app/api/upload/_shared/` 配下に `profile-image-upload.ts` と `validate-upload-file.ts` の 2 本のアップロード共有ヘルパーを配置（`_shared/` プレフィックスにより Next.js のルート対象外）。
`app/feed.xml/route.ts` は RSS フィード（API ではなく公開コンテンツのため `/api/` 外配置）、
`app/auth/callback/route.ts` は NextAuth の OAuth コールバック処理用（NextAuth 内部フロー）。

### 公開エンドポイント

#### GET `/api/health`
- **認証:** None (IPレート制限: 60回/分)
- **説明:** ヘルスチェック。DB接続(`SELECT 1`)を検証
- **レスポンス:**
  - `200`: `{ status: 'healthy', timestamp: string }`
  - `429`: `{ status: 'rate_limited', timestamp: string }`
  - `503`: `{ status: 'unhealthy', timestamp: string }`

#### GET `/api/maintenance/status`
- **認証:** None (セッションがあればadmin判定)
- **レート制限:** `RATE_LIMITS.api`（60req/分・IPベース）、超過時は `429 { error: 'Too many requests' }`
- **説明:** メンテナンスモード状態を返す。`prisma.systemSetting` の `maintenance_mode` キー（`SYSTEM_SETTING_KEYS.MAINTENANCE_MODE` 定数を使用）を Zod スキーマ (`maintenanceSettingsSchema`) で検証する。不正形状が検出された場合は fail-safe で `isMaintenanceMode: false` を返し、警告を logger に送る。
- **レスポンス:** `{ isMaintenanceMode: boolean, isAdmin: boolean }`

#### GET `/api/push/vapid-key`
- **認証:** None
- **レート制限:** IP ベース（超過時 `429 { error: API_ERR_TOO_MANY_REQUESTS }`）
- **説明:** Web Push用VAPID公開鍵を返す（環境変数 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`）
- **レスポンス:**
  - `200`: `{ publicKey: string }`
  - `429`: レート制限超過
  - `503`: `{ error: API_ERR_PUSH_NOT_CONFIGURED }`（VAPID鍵未設定）

#### GET `/api/og`
- **認証:** None
- **ランタイム:** Node.js（Next.js 16 デフォルト。`next/og` の `ImageResponse` は Next.js 14+ で Node.js / Edge 双方をサポート）
- **レート制限:** `RATE_LIMITS.api`（60req/分・IPベース、fail-open）
- **説明:** 動的OG画像生成（墨絵背景 + タイトル）
- **パラメータ:** `?title=string` (任意)
- **レスポンス:** `image/png`

#### GET `/api/ad-frame`
- **認証:** None
- **レート制限:** `RATE_LIMITS.api`（60req/分・IPベース、fail-open）
- **説明:** 広告iframe HTML返却。親ページの厳密CSPを継承しないよう、ピンポイント許可の独自CSPを付与する（`default-src 'none'` をベースに、忍者AdMax / Google Syndication / DoubleClick / Google Ad Services のみ script/connect/frame 許可）。`X-Frame-Options: SAMEORIGIN` と `Referrer-Policy: strict-origin-when-cross-origin` も併設。
- **パラメータ:** `?id=string` (32桁hex, 必須)
- **レスポンス:** `text/html`

#### GET `/api/badges`
- **認証:** None (未認証時は0を返す)
- **説明:** 未読通知・メッセージ数を返す。ミュートユーザーからの通知は除外。メッセージは直近N会話のみ対象
- **レスポンス:** `{ notifications: number, messages: number, messagesCapReached?: true }`

#### POST `/api/analytics/track`
- **認証:** None（オプションでセッションがあれば `userId` をバックフィル）
- **説明:** 日次の実訪問者ログ記録。クライアントの `<VisitorBeacon />` がページマウント時に POST。HttpOnly Cookie `bon_log_visitor_id`（UUID）で訪問者識別、`(date, visitor_id)` UNIQUE で同日重複抑止。個人特定情報（IP / UA / Referer 等）は格納しない。
- **永続化:** `daily_visitors` テーブル（管理画面のアクセス推移グラフが参照）
- **Cookie:** `bon_log_visitor_id`（HttpOnly / SameSite=Lax / 1 年）
- **レスポンス:**
  - `200`: `{ ok: true }`
  - `204`: 例外時の no-content フォールバック（fire-and-forget なクライアントを汚染しない）

#### POST `/api/analytics/view`
- **認証:** Session 必須（未認証時は `401 { error: ERR_AUTH_REQUIRED }`）
- **レート制限:** 認証ユーザー単位（`analytics-view:${viewerId}` キー、`VIEW_BEACON_RATE_LIMIT_PER_MINUTE` 回／分、failOpen=true）。超過時は `204 no-content`。
- **説明:** Server Component から書き込みを切り離した「閲覧」beacon。`<ViewBeacon />` がページマウント時に POST。投稿閲覧 / プロフィール閲覧を Zod discriminated union（`type: 'post' | 'profile'`）で型付け、`lib/services/analytics-recording.ts` の `recordPostViewService` / `recordProfileViewService` を呼ぶ。
- **重複抑止:** Redis `view:post:${viewerId}:${postId}` または `view:profile:${viewerId}:${targetUserId}` キーで `VIEW_BEACON_DEDUPE_SECONDS` 秒の dedupe。
- **集計拒否条件:**
  - 自分自身の閲覧
  - 相手にブロックされている
  - 投稿が `isHidden=true` / 投稿者と body 不一致
  - プロフィール対象が凍結 / 非公開
- **リクエスト:** `{ type: 'post', postId, targetUserId }` または `{ type: 'profile', targetUserId }`
- **レスポンス:** `204 no-content` (fire-and-forget なクライアントを 5xx で汚染しない) または `400 { error: ERR_INVALID_INPUT }` / `401 { error: ERR_AUTH_REQUIRED }`

#### GET `/feed.xml`
- **認証:** None
- **説明:** 公開投稿のRSS 2.0フィード
- **レスポンス:** `application/xml` (1時間キャッシュ)

---

### 認証エンドポイント

#### GET/POST `/api/auth/[...nextauth]`
- **認証:** NextAuth.js ハンドラー
- **説明:** ログイン・ログアウト・コールバック・セッション管理
- **プロバイダー:** Credentials (メール/パスワード + bcrypt), Google OAuth

---

### アップロードエンドポイント

#### POST `/api/upload`
- **認証:** Session
- **レート制限:** 5回/分, 50回/日
- **説明:** 画像・動画アップロード。ファイルタイプ・サイズ・シグネチャ検証（MIMEタイプ偽装防止）
- **リクエスト:** `multipart/form-data` (`file`)
- **レスポンス:**
  - `200`: `{ success: true, url: string, type: 'image' | 'video' }`
  - `400`: ファイル未選択 / 不正な形式 / サイズ超過
  - `401`: 未認証
  - `429`: レート制限超過
  - `500`: アップロード失敗

#### POST `/api/upload/avatar`
- **認証:** Session
- **説明:** プロフィールアバター画像アップロード
- **リクエスト:** `multipart/form-data` (`file`)

#### POST `/api/upload/header`
- **認証:** Session
- **説明:** プロフィールヘッダー画像アップロード
- **リクエスト:** `multipart/form-data` (`file`)

#### POST `/api/upload/presigned`
- **認証:** Session
- **レート制限:** 5回/分, 50回/日
- **説明:** Cloudflare R2直接アップロード用署名付きURL生成。Vercelの4.5MBペイロード制限を回避
- **許可MIMEタイプ:** `video/mp4`, `video/quicktime`, `video/webm`
- **許可フォルダ:** `posts`, `post-videos`, `avatars`, `headers`
- **リクエスト:** `{ contentType: string, fileSize: number, folder?: string }`
- **レスポンス:**
  - `200`: `{ presignedUrl: string, fileUrl: string, key: string }`
  - `400`: パラメータ不正 / 不正MIMEタイプ / サイズ超過
  - `401`: 未認証
  - `429`: レート制限超過

---

### Webhook エンドポイント

#### POST `/api/webhooks/stripe`
- **認証:** Stripe 署名検証 (`stripe.webhooks.constructEvent()`)
- **レート制限:** `RATE_LIMITS.api`（60req/分・IPベース、fail-open）。署名検証 (HMAC) は軽量だが、偽 webhook 大量送信による計算コスト消費・障害誘発を防ぐため
- **冪等性:** `ensureWebhookEventOnce('stripe', event.id)` で `webhook_events` テーブルへ UNIQUE INSERT。
  重複イベントは `200 { received: true, duplicate: true }` を返してリトライを終了させる。
  冪等性 INSERT 自体が DB エラーで失敗した場合は処理を継続（5xx 応答による Stripe 再配信を回避）。
- **通知:** `invoice.payment_failed` 時は `createNotification()` 経由で system 通知を作成（CLAUDE.md ルール6準拠）。
- **説明:** Stripe サブスクリプションライフサイクルイベント処理
- **対応イベント:**
  - `checkout.session.completed` — プレミアム有効化
  - `customer.subscription.updated` — ステータス更新
  - `customer.subscription.deleted` — プレミアム無効化
  - `invoice.payment_failed` — 決済失敗記録（system 通知作成）
  - `invoice.payment_succeeded` — 決済成功記録

---

### Cron ジョブ

全ジョブで HMAC-SHA256 署名 + タイムスタンプ認証 (`verifyCronAuth()`) を使用。

#### GET `/api/cron/publish-scheduled`
- **認証:** HMAC-SHA256（`verifyCronAuth` が未認証時 `401 { error: API_ERR_UNAUTHORIZED }` を返す）
- **実行間隔:** 5分毎 (`*/5 * * * *`)
- **maxDuration:** 60 秒（リテラル。`CRON_FUNCTION_TIMEOUT_SECONDS` 定数と一致することを型レベルで検証）
- **説明:** 予約投稿の公開処理（バッチ）。凍結ユーザーの投稿はスキップ
- **レスポンス:** `{ success: true, publishedCount: number, failedCount: number, message: string }`
- **エラー:** 予期せぬ失敗時は `500 { success: false, error: API_ERR_INTERNAL_SERVER_ERROR }`

#### GET/POST `/api/cron/check-subscriptions`
- **認証:** HMAC-SHA256
- **実行間隔:** 毎日 00:00 UTC (`0 0 * * *`)
- **説明:**
  - GET: 期限切れプレミアム会員のステータスリセット + 期限切れメール送信
  - POST: 期限3日前の警告メール送信
- **レスポンス:** `{ success: true, processedCount: number }`

#### GET `/api/cron/update-weather`
- **認証:** HMAC-SHA256
- **実行間隔:** 毎時
- **説明:** 天気観測地点の座標を集約・重複排除し、Open-Meteo APIからバッチで天気データ取得・Redisキャッシュ更新

#### GET `/api/cron/cleanup-events`
- **認証:** HMAC-SHA256
- **実行間隔:** 毎月1日 00:00 JST
- **説明:** 終了日から6ヶ月以上経過したイベントを削除

---

### 管理者エンドポイント

#### GET `/api/admin/sentry`
- **認証:** Admin (`requireAdmin()`)
- **説明:** Sentry未解決イシュー一覧取得
- **レスポンス:** `{ issues: SentryIssue[], dashboardUrl: string }`
- **SentryIssue:** `{ id, shortId, title, culprit, level, status, count, userCount, firstSeen, lastSeen, permalink }`

#### GET `/api/admin/usage`
- **認証:** Admin (`requireAdmin()`)
- **説明:** Vercel/Supabase/R2/Resend使用量集計
- **レスポンス:** サービス別 `{ status, usage, limit, percentage, cost }`

#### GET/POST `/api/admin/search/setup`
- **認証:** Admin (セッション + `adminUser` レコード)
- **説明:**
  - GET: PostgreSQL全文検索設定状態確認
  - POST: インデックス作成・拡張有効化
- **POSTアクション:** `enable_extension` / `create_indexes` / `full_setup`

#### POST `/api/admin/seed-pesticide`
- **認証:** Bearer トークン (タイミングセーフ比較)
- **シークレット優先順位:** `SEED_PESTICIDE_SECRET` > `CRON_SECRET` > `VERCEL_CRON_SECRET`
- **任意 IP 許可リスト:** `SEED_ALLOWED_IPS`（カンマ区切り、未設定時は全 IP 許可）
- **ランタイム:** Node.js（`maxDuration = 300` で Vercel Pro の上限まで許可）
- **説明:** 農薬データベース再シード（8 テーブルを TRUNCATE CASCADE → seed-pesticide-data の `main()` を呼び出し）
- **対象テーブル:** `pesticide_effects`, `pesticide_active_ingredients`, `pesticides`, `active_ingredients`, `formulation_types`, `disease_pests`, `spreader_types`, `pesticide_columns`
- **エラー時:** `{ error: 'Seed failed', message, stackHead }` を 500 で返却（運用デバッグ用）
- **呼び出し:** `npm run db:seed-pesticide-production`

#### POST `/api/admin/apply-migration`
- **認証:** Bearer トークン (タイミングセーフ比較。`SEED_PESTICIDE_SECRET` > `CRON_SECRET` > `VERCEL_CRON_SECRET` の順で照合)
- **任意 IP 許可リスト:** `SEED_ALLOWED_IPS`
- **maxDuration:** 60 秒
- **説明:** 一回限りの管理者用マイグレーション適用バックドア。`prisma migrate deploy` を手元から実行できない運用時に Vercel 関数経由で本番 DB に直接マイグレーションを反映する。`MIGRATIONS` allowlist 内のハードコード SQL のみ実行可能（任意 SQL 実行不可）。すべて `IF NOT EXISTS` / `DROP IF EXISTS` で冪等。
- **リクエストボディ:** `{ "migration": "add_daily_visitors" }`（allowlist 内のみ）
- **レスポンス:**
  - `200`: `{ success: true, migration, statementCount }`
  - `400`: `{ error: ERR_INVALID_INPUT, available: string[] }`（不正な migration 名）
  - `401`: `{ error: API_ERR_UNAUTHORIZED }`
  - `403`: `{ error: 'Forbidden' }`（IP 拒否）
  - `500`: `{ error, migration, message, stackHead, executedStatementIndices }`（途中まで適用された場合のデバッグ用）

#### POST `/api/admin/seed`
- **認証:** Bearer トークン（同上の優先順位）
- **任意 IP 許可リスト:** `SEED_ALLOWED_IPS`
- **ランタイム:** Node.js（`maxDuration = 300`）
- **説明:** 薬剤以外の 5 ドメイン（ジャンル / 辞典 / 肥料 / ホルモン / ゲストユーザー）を本番DBにシード。ドメインごとに idempotent / TRUNCATE-then-insert を使い分ける。
- **リクエストボディ:** `{ "domain": "genres" | "dictionary" | "fertilizer" | "hormone" | "guest" | "all" }`
- **ドメイン別の挙動:**
  - `genres`: `POST_GENRES` + `SHOP_GENRES` を upsert（**非破壊**）
  - `dictionary`: `bonsai_terms` を TRUNCATE → `DICTIONARY_TERMS` を `createMany`
  - `fertilizer`: `fertilization_plans` / `tree_species` / `fertilizer_nutrients` / `fertilizer_categories` / `fertilizer_columns` を TRUNCATE CASCADE → `seed-fertilizer-data#main()` 呼び出し
  - `hormone`: `hormone_techniques` / `hormone_columns` / `hormone_interactions` / `hormone_seasonal_levels` / `hormone_effects` / `hormone_types` を TRUNCATE CASCADE → `seed-hormone-data#seedHormoneData()` 呼び出し
  - `guest`: `GUEST_PASSWORD` 環境変数が設定されている場合のみゲストユーザーを upsert（未設定時は `{ ok: false, reason }` を返す）
  - `all`: 上記をすべて順次実行（`genres → guest → fertilizer → dictionary → hormone`）
- **レスポンス:** `{ success: true, domain, results: { genres?, guest?, fertilizer?, dictionary?, hormone? } }`
- **エラー時:** `{ error: 'Seed failed', domain, message, stackHead, partial: results }` を 500 で返却（途中まで成功した結果も含む）
- **呼び出し:** `npm run db:seed-production [domain]`（domain 省略時は `all`）

---

## Server Actions (87 ファイル: ルート 66 + 管理者 20 + schemas 1。うち `'use server'` ディレクティブ付きは 73 本)

### 戻り値型ポリシー（CLAUDE.md ルール2）

すべての Server Action は **`ActionResult<T>`** 型（`types/action-result.ts`）で返却する:

```ts
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }
```

エラーメッセージは必ず `lib/constants/errors/` 配下のドメイン別 `ERR_*` 定数を使用し、インライン文字列は禁止。28 個以上の `ERR_*` を import するファイル（例: `lib/actions/auth.ts`）はドメイン別 sub-import で整理する。

#### `'use server'` を持たないモジュール（規約対象外）

`lib/actions/` 配下でも以下は **クライアントから RPC 公開しない内部 helper / RSC データ取得モジュール** として `'use server'` を外し、`'server-only'` ガードのみを置く設計に統一されている。これらは Server Action ではないため ActionResult 規約は適用されず、ドメイン型を直接返す（**lib/actions/ ルート 66 ファイル中 12 ファイル** + `admin/_schemas.ts` + `schemas/common.ts` が該当）:

**RSC データ取得モジュール（読み取り専用 query、RSC からの直接 await 用途）:**
- `lib/actions/dictionary.ts` — 盆栽用語辞典の取得（`getTerms` / `getTermBySlug` / `getAdjacentTerms`）
- `lib/actions/fertilizer.ts` — 肥料・栄養素・樹種・施肥スケジュール・コラム取得
- `lib/actions/hormone.ts` — 植物ホルモン・相互作用・季節レベル・技法マッピング・コラム取得
- `lib/actions/pesticide.ts` — 農薬・病害虫・有効成分・剤型・展着剤・コラム取得
- `lib/actions/search-meta.ts` — 検索メタ情報（`getPopularTags` / `getAllGenres` / `getSearchModeInfo`）

**内部 helper（任意 input で外部から呼ばれない設計）:**
- `lib/actions/filter-helper.ts` — ブロック/ミュート除外 ID 取得（`getExcludedUserIds` / `getBlockedUserIds` / `getMutedUserIds`）。以前は `'use server'` 配下で公開されており任意 userId で他人の関係を取得できる懸念があったため、`'server-only'` 化により RPC 露出を遮断
- `lib/actions/post-include.ts` — Prisma include 共有定義（`POST_LIST_INCLUDE` / `POST_QUOTE_INCLUDE` / `POST_REPOST_INCLUDE` / `buildPostPollInclude(currentUserId?)` / `formatPostForClient`）
- `lib/actions/post-validation.ts` — `createPost` の純粋検証ヘルパー（`validatePollOptions` / `parseCreatePostShape` / `applyCreatePostBusinessRules`）
- `lib/actions/prisma-filters.ts` — Prisma where 句生成 helper（ブロック・非公開・凍結除外）
- `lib/actions/pagination.ts` — カーソルベース pagination ヘルパ（`MAX_PAGE_LIMIT` で clamp）
- `lib/actions/utils.ts` — 認証/権限ゲート（`requireAuth`, `requireActiveNonGuestUser` 等）・media 検証・relation キャッシュ・`ActionResult` 再エクスポート

**barrel re-export:**
- `lib/actions/user.ts` — `user-profile` / `user-media` / `user-account` の再エクスポート（`export *` のみ、`'use server'` ディレクティブを持たないが、再エクスポート先の各ファイルが `'use server'` を持つ）

**schema 定義モジュール（`'use server'` 不付与）:**
- `lib/actions/schemas/common.ts` — 共有 Zod schema 定義
- `lib/actions/admin/_schemas.ts` — admin Action 用 Zod schema 定義

> 共有 Prisma select/include 定数（`USER_MINIMAL_SELECT` / `USER_MINIMAL_RELATION` / `USER_MINIMAL_WITH_BIO_SELECT` / `GENRE_MINIMAL_SELECT` / `POST_GENRE_RELATION` 等）は `lib/actions/` ではなく **`lib/prisma/shared-includes.ts`** に集約されている（依存方向中立のため actions/services 双方から import 可能）。

これらのうち、client component から呼ぶ必要があるものは `lib/actions/search.ts` バレル等が `'use server'` で再エクスポートしているため、従来通り呼び出せる。RSC データ取得モジュール（fertilizer/hormone/pesticide/dictionary/search-meta）は **page.tsx から直接 await** することを想定。

### ファイル一覧

**ルートActions (66):** admin, analytics, announcement, auth, auth-email-verify, auth-password-reset, blacklist, block, bonsai, bonsai-care-log, bonsai-record, bookmark, comment, comment-thread-mute, contact, dictionary\*, draft, event, event-import, feed, fertilizer\*, filter-helper\*, follow, follow-request, hashtag, hide-post, hormone\*, like, maintenance, mention, message, message-conversations, message-messages, mute, notification, notification-preferences, pagination\*, pesticide\*, poll, post, post-include\*, post-validation\*, prisma-filters\*, push-subscription, report, report-admin, report-user, review, scheduled-post, scheduled-post-crud, scheduled-post-publish, search, search-entities, search-meta\*, search-posts, search-users, shop, shop-change-request, subscription, two-factor, user\*\*, user-account, user-media, user-profile, utils\*, weather

\* 印は `'use server'` を持たない RSC データ取得 / 内部 helper モジュール（`'server-only'` ガード付き）。
\*\* `user.ts` は `user-profile` / `user-media` / `user-account` の barrel re-export（自身は `'use server'` を持たないが、再エクスポート先は持つ）。

**管理者Actions (20):** activity, analytics, announcements, cms, content, hidden, ip-management, logs, moderation, monitoring, pesticide-data, posts, premium, roles, security, segments, stats, users, warnings, _schemas（`'use server'` 不付与の Zod schema 定義）

**schemas (1):** common（`'use server'` 不付与の Zod schema 定義）

### サービス層ヘルパー（CLAUDE.md ルール6 / lib/services/）

| 関数 | 場所 | 用途 |
|------|------|------|
| `createNotification(params)` | `lib/services/notification-core.ts` | **単発通知** — ブロック/設定/重複チェック + push 配信。`system` / `subscription_expiring` 型はブロックチェックをスキップし、actor=userId 自身の self-notification を許容 |
| `deleteNotification(params)` | `lib/services/notification-core.ts` | 通知削除 |
| `createNotificationsBulk(params)` | `lib/services/notification-bulk.ts` | **複数受信者への同種通知** — block/prefs フィルタ + `createMany({ skipDuplicates: true })` + 個別 push（`Promise.allSettled`）|
| （各種通知コア処理） | `lib/services/notification-core.ts` | 通知フィルタリング・設定チェック等の内部ヘルパー |
| `ensureWebhookEventOnce(provider, eventId)` | `lib/services/webhook-idempotency.ts` | UNIQUE INSERT による冪等性ロック（Stripe 等のリトライ抑止）。重複は `{ alreadyProcessed: true }` を返す |
| `requireAuthorization(...)` | `lib/services/authorization.ts` | 認可チェック共通化 |
| `commentNotifications` | `lib/services/comment-notifications.ts` | コメント関連通知（`createNotification`/`createNotificationsBulk` へ delegate） |
| `attachHashtagsToPost` / `detachHashtagsFromPost` | `lib/services/hashtag-sync.ts` | 投稿ハッシュタグの同期・差分更新（`post.ts` の投稿作成/削除から呼ばれる） |
| `hashtag-recount` | `lib/services/hashtag-recount.ts` | ハッシュタグ参照件数の再計算（管理操作 / cron 用） |
| `notifyMentionedUsers` / `resolveMentionUsers` | `lib/services/mention.ts` | メンション通知送信・メンションユーザー情報解決（`post.ts` / `comment.ts` から呼ばれる） |
| `logSecurityEvent` | `lib/services/security-events.ts` | セキュリティイベント記録 |
| `shop/change-request` | `lib/shop/change-request.ts` | 盆栽園変更リクエストの型・Zod schema・parser（純粋関数のみ。dependency-neutral として `lib/shop/` 配下に配置） |
| `usage` | `lib/services/usage.ts` | Vercel / Supabase / R2 / Resend の利用量集計 |
| `weather-service` | `lib/services/weather-service.ts` | Open-Meteo API 連携・天気キャッシュ・盆栽管理アドバイス生成 |
| `analytics-service` | `lib/services/analytics-service.ts` | アナリティクスデータ取得・集計 |
| `analytics-recording` | `lib/services/analytics-recording.ts` | UserAnalytics の累積カウンタ更新（`recordPostViewService` / `recordProfileViewService` / `recordLikeReceivedService` / `recordNewFollowerService`）。閲覧/いいね/フォロー beacon の Route Handler（`/api/analytics/view`）から呼ばれる共有 domain logic（個別の `record*` Server Action は廃止済み） |

`prisma.notification.create` / `createMany` の直接呼び出しは禁止。バリデーション失敗時は `actionError(ERR_INVALID_INPUT)` を返す。

---

### 認証 (`lib/actions/auth.ts`)

認証不要（ログイン前に使用）。メール認証系（`verifyEmailToken` / `resendVerificationEmail` / `getEmailVerificationStatus`）は `lib/actions/auth-email-verify.ts`、パスワードリセット系（`requestPasswordReset` / `resetPassword` / `verifyPasswordResetToken`）は `lib/actions/auth-password-reset.ts` に実装され、`auth.ts` がラッパー経由で再エクスポートしている。

| 関数 | 説明 |
|------|------|
| `checkLoginAllowed(email)` | ログイン試行回数チェック（ロックアウト判定） |
| `recordLoginFailure(email)` | ログイン失敗を記録 |
| `clearLoginAttempts(email)` | ログイン試行回数をリセット |
| `verifyCredentials(credentials)` | メール・パスワード検証 |
| `signInAsGuest()` | ゲストログイン |
| `signInAsGuestFormAction()` | ゲストログイン（フォームアクション版） |
| `registerUser(data)` | ユーザー登録（メール・パスワード・ニックネーム） |
| `verifyEmailToken(token)` | メール認証トークン検証 |
| `resendVerificationEmail(email)` | 認証メール再送 |
| `getEmailVerificationStatus(email)` | メール認証状態取得 |
| `requestPasswordReset(email)` | パスワードリセットメール送信 |
| `resetPassword(data)` | パスワードリセット実行 |
| `verifyPasswordResetToken(email, token)` | パスワードリセットトークン検証 |

---

### 2段階認証 (`lib/actions/two-factor.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `setup2FA()` | 2FA初期設定（QRコード・シークレット・バックアップコード生成） |
| `enable2FA(code)` | 2FA有効化（TOTP検証） |
| `disable2FA(password)` | 2FA無効化（パスワード検証） |
| `verify2FAToken(token, options?)` | 2FAトークン検証（ログイン時） |
| `regenerateBackupCodes(password)` | バックアップコード再生成 |
| `get2FAStatus()` | 2FA設定状態取得 |
| `check2FARequired(email)` | 2FA要求判定 |

---

### ユーザー (`lib/actions/user.ts` — バレルエクスポート)

**Session 認証必須**。`user-profile.ts` / `user-media.ts` / `user-account.ts` を再エクスポート。

| 関数 | ソース | 説明 |
|------|--------|------|
| `getUser(userId)` | user-profile | 指定ユーザー情報取得（React `cache` でメモ化） |
| `getCurrentUser()` | user-profile | 現在のユーザー情報取得 |
| `updateProfile(formData)` | user-profile | プロフィール更新 |
| `updatePrivacy(isPublic)` | user-profile | 公開/非公開切り替え |
| `getFollowing(userId, cursor?, limit?)` | user-profile | フォロー一覧取得 |
| `uploadAvatar(formData)` | user-media | アバター画像アップロード |
| `uploadHeader(formData)` | user-media | ヘッダー画像アップロード |
| `deleteAccount()` | user-account | アカウント削除 |

---

### 投稿 (`lib/actions/post.ts`)

**Session 認証必須**（`getGenres` を除く）。投稿は1日20件制限。

| 関数 | 説明 |
|------|------|
| `createPost(formData)` | 投稿作成（テキスト500文字、メディア4枚、ジャンル最大3つ） |
| `createQuotePost(formData, quotePostId)` | 引用投稿作成 |
| `createRepost(postId)` | リポスト |
| `deletePost(postId)` | 投稿削除（本人のみ） |
| `getPost(postId)` | 投稿詳細取得 |
| `getPosts(cursor?, limit?)` | 投稿一覧取得（カーソルベースページネーション） |
| `getGenres()` | ジャンルマスタ一覧取得 |
| `uploadPostMedia(formData)` | 投稿用メディアアップロード |
| `getPostsByBonsai(bonsaiId, cursor?, limit?)` | 盆栽別投稿一覧取得 |

---

### コメント (`lib/actions/comment.ts`)

**Session 認証必須**。コメントは1日100件制限。

| 関数 | 説明 |
|------|------|
| `createComment(formData)` | コメント作成（スレッド形式対応） |
| `deleteComment(commentId)` | コメント削除（本人のみ） |
| `getComments(postId, cursor?, limit?)` | 投稿のコメント一覧取得 |
| `getReplies(commentId, cursor?, limit?)` | コメントの返信一覧取得 |
| `getCommentCount(postId)` | コメント数取得 |
| `uploadCommentMedia(formData)` | コメント用メディアアップロード |

---

### いいね (`lib/actions/like.ts`)

**Session 認証必須**。通知は `createNotification`/`deleteNotification` ヘルパー経由で管理。

| 関数 | 説明 |
|------|------|
| `togglePostLike(postId)` | 投稿のいいねトグル |
| `toggleCommentLike(commentId, postId)` | コメントのいいねトグル |
| `getPostLikeStatus(postId)` | 投稿のいいね状態取得 |
| `getLikedPosts(userId, cursor?, limit?)` | いいねした投稿一覧取得 |

---

### ブックマーク (`lib/actions/bookmark.ts`)

**Session 認証必須**。レート制限あり（`checkUserRateLimit`）。

| 関数 | 説明 |
|------|------|
| `toggleBookmark(postId)` | ブックマークトグル |
| `getBookmarkStatus(postId)` | ブックマーク状態取得 |
| `getBookmarkedPosts(cursor?, limit?)` | ブックマーク一覧取得 |

---

### フォロー (`lib/actions/follow.ts`)

**Session 認証必須**。レート制限あり（`checkUserRateLimit`）。フォロー/アンフォロー時に `revalidatePath` でキャッシュ無効化。

| 関数 | 説明 |
|------|------|
| `toggleFollow(userId)` | フォロー/アンフォロートグル |
| `getFollowStatus(targetUserId)` | フォロー状態取得 |
| `getFollowers(userId, cursor?, limit?)` | フォロワー一覧取得 |
| `getFollowing(userId, cursor?, limit?)` | フォロー一覧取得 |

---

### フォローリクエスト (`lib/actions/follow-request.ts`)

**Session 認証必須**。非公開アカウント向け。返り値は `ActionResult` 型。書き込み系（送信／承認／拒否／取消）は `requireActiveNonGuestUser('engagement')` で**認証 → Zod (`z.string().min(1)`) → engagement レート制限**を統一適用。

| 関数 | 説明 | 認証ゲート |
|------|------|----------|
| `sendFollowRequest(targetUserId)` | フォローリクエスト送信 | engagement RL + Zod |
| `approveFollowRequest(requestId)` | フォローリクエスト承認 | engagement RL + Zod |
| `rejectFollowRequest(requestId)` | フォローリクエスト拒否 | engagement RL + Zod |
| `cancelFollowRequest(targetUserId)` | フォローリクエスト取消 | engagement RL + Zod |
| `getFollowRequestStatus(targetUserId)` | リクエスト状態取得 | requireAuth（読取） |
| `getReceivedFollowRequests(cursor?, limit?)` | 受信リクエスト一覧 | requireAuth + requireNotGuest（読取） |
| `getSentFollowRequests(cursor?, limit?)` | 送信リクエスト一覧 | requireAuth + requireNotGuest（読取） |
| `getPendingFollowRequestCount()` | 未処理リクエスト数 | requireAuth（読取） |

---

### ブロック (`lib/actions/block.ts`)

**Session 認証必須**。返り値は `ActionResult` 型。

| 関数 | 説明 |
|------|------|
| `blockUser(targetUserId)` | ユーザーブロック（相互フォロー解除含む） |
| `unblockUser(targetUserId)` | ブロック解除 |
| `getBlockedUsers(cursor?, limit?)` | ブロック一覧取得 |
| `isBlocked(targetUserId)` | ブロック状態判定 |

---

### ミュート (`lib/actions/mute.ts`)

**Session 認証必須**。返り値は `ActionResult` 型。

| 関数 | 説明 |
|------|------|
| `muteUser(targetUserId)` | ユーザーミュート |
| `unmuteUser(targetUserId)` | ミュート解除 |
| `getMutedUsers(cursor?, limit?)` | ミュート一覧取得 |
| `isMuted(targetUserId)` | ミュート状態判定 |

---

### フィード (`lib/actions/feed.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `getTimeline(cursor?, limit?)` | タイムライン取得（フォロー中ユーザーの投稿） |
| `getRecommendedUsers(limit?)` | おすすめユーザー取得 |
| `getTrendingGenres(limit?)` | トレンドジャンル取得 |

---

### 通知 (`lib/actions/notification.ts`)

**Session 認証必須**。

**`NotificationType`:** `'like'` | `'comment'` | `'follow'` | `'quote'` | `'reply'` | `'comment_like'` | `'follow_request'` | `'follow_request_approved'` | `'mention'`

| 関数 | 説明 |
|------|------|
| `getNotifications(cursor?, limit?)` | 通知一覧取得 |
| `markAsRead(notificationId)` | 通知を既読にする |
| `markAllAsRead()` | 全通知を既読にする |
| `getUnreadCount()` | 未読通知数取得 |

通知の作成・削除は Server Action ではなく `lib/services/notification-core.ts` の `createNotification()` / `deleteNotification()` を各 Action 内から呼び出す（CLAUDE.md ルール6。`'use server'` ファイルからは公開しない）。

---

### 通知設定 (`lib/actions/notification-preferences.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `getNotificationPreferences()` | 通知設定取得 |
| `updateNotificationPreferences(data)` | 通知設定更新 |

---

### メッセージ (`lib/actions/message.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `getOrCreateConversation(targetUserId)` | 会話取得/作成 |
| `sendMessage(conversationId, content)` | メッセージ送信 |
| `getConversations()` | 会話一覧取得 |
| `getConversation(conversationId)` | 会話詳細取得 |
| `getMessages(conversationId, cursor?, limit?)` | メッセージ一覧取得 |
| `getUnreadMessageCount()` | 未読メッセージ数取得 |
| `markAsRead(conversationId)` | 会話を既読にする |
| `deleteMessage(messageId)` | メッセージ削除 |

---

### 盆栽 (`lib/actions/bonsai.ts` + `lib/actions/bonsai-record.ts` + `lib/actions/bonsai-care-log.ts`)

**Session 認証必須**。返り値は `ActionResult<T>`。

| 関数 | 説明 |
|------|------|
| `getBonsais(userId?)` | 盆栽一覧取得 |
| `getBonsai(bonsaiId)` | 盆栽詳細取得 |
| `createBonsai(data)` | 盆栽登録 |
| `updateBonsai(bonsaiId, data)` | 盆栽更新 |
| `deleteBonsai(bonsaiId)` | 盆栽削除 |
| `searchBonsais(query)` | 盆栽検索 |
| `addBonsaiRecord(data)` | 管理記録追加（水やり、施肥、剪定等） |
| `updateBonsaiRecord(recordId, data)` | 管理記録更新 |
| `deleteBonsaiRecord(recordId)` | 管理記録削除 |
| `getBonsaiTimeline(options?)` | 盆栽タイムライン取得 |
| `getBonsaiRecords(bonsaiId, options?)` | 盆栽の管理記録一覧取得 |

#### 盆栽手入れログ (`lib/actions/bonsai-care-log.ts`)

カレンダービュー専用の構造化メモ。盆栽 ID には紐付けず、ユーザー全体のログとして扱う（タイムラインや盆栽詳細には漏出しない）。

| 関数 | 説明 |
|------|------|
| `addBonsaiCareLog(input)` | 手入れログ追加（`type: BonsaiCareType` / `performedAt: Date \| string` / `note?`） |
| `updateBonsaiCareLog(id, input)` | 手入れログ更新（`type?` / `performedAt?` / `note?`） |
| `deleteBonsaiCareLog(id)` | 手入れログ削除 |
| `getCareLogsInRange(input)` | 期間指定で取得（`fromIso` / `toIso` / `types?: BonsaiCareType[]`） |
| `getBonsaiCalendarOverlaysInRange(input)` | カレンダー重ね合わせ用データ取得（`fromIso` / `toIso`） |

`BonsaiCareType` は `watering` / `fertilizing` / `pruning` / `wiring` / `repotting` / `other` 等。

---

### イベント (`lib/actions/event.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `getEvents(options?)` | イベント一覧取得（地域・期間フィルタ） |
| `getUpcomingEvents(limit?, region?)` | 近日イベント取得 |
| `getEventsByMonth(year, month)` | 月別イベント取得（カレンダー表示用） |
| `getEvent(eventId)` | イベント詳細取得 |
| `createEvent(formData)` | イベント作成 |
| `updateEvent(eventId, formData)` | イベント更新 |
| `deleteEvent(eventId)` | イベント削除 |

---

### イベントインポート (`lib/actions/event-import.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `scrapeExternalEvents()` | 外部イベント情報スクレイピング |
| `scrapeEventsByRegion(region)` | 地域別イベントスクレイピング |
| `importSelectedEvents(events)` | 選択イベントインポート |
| `getAvailableRegions()` | スクレイピング対象地域一覧 |

---

### 盆栽園 (`lib/actions/shop.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `getShops(options?)` | 盆栽園一覧取得（地域・ジャンルフィルタ） |
| `getShop(shopId)` | 盆栽園詳細取得 |
| `createShop(formData)` | 盆栽園登録（重複チェック付き） |
| `updateShop(shopId, formData)` | 盆栽園更新 |
| `deleteShop(shopId)` | 盆栽園削除 |
| `geocodeAddress(address)` | 住所→緯度経度変換 |
| `searchAddressSuggestions(query)` | 住所候補検索 |
| `getShopGenres()` | 盆栽園ジャンル一覧 |
| `updateShopGenres(shopId, genreIds)` | 盆栽園ジャンル更新 |

---

### 盆栽園変更リクエスト (`lib/actions/shop-change-request.ts`)

**Session 認証必須**（作成）/ **Admin 認証必須**（承認・拒否）。

| 関数 | 説明 |
|------|------|
| `createShopChangeRequest(shopId, changes, reason?)` | 変更リクエスト作成 |
| `getShopChangeRequests(options?)` | 変更リクエスト一覧 |
| `getPendingShopChangeRequestCount()` | 未処理リクエスト数 |
| `getShopChangeRequest(requestId)` | リクエスト詳細 |
| `approveShopChangeRequest(requestId, adminComment?)` | リクエスト承認 |
| `rejectShopChangeRequest(requestId, adminComment?)` | リクエスト拒否 |
| `getPendingShopChangeRequestsCount()` | 未処理数取得（別名） |

---

### レビュー (`lib/actions/review.ts`)

**Session 認証必須**。返り値は `ActionResult` 型。

| 関数 | 説明 |
|------|------|
| `createReview(formData)` | レビュー作成（星5段階 + テキスト + 画像3枚） |
| `updateReview(reviewId, formData)` | レビュー更新 |
| `deleteReview(reviewId)` | レビュー削除 |
| `getReviews(shopId, cursor?, limit?)` | レビュー一覧取得 |
| `uploadReviewImage(formData)` | レビュー画像アップロード |

---

### 検索 (`lib/actions/search.ts` + `lib/actions/search-entities.ts`)

PostgreSQL 全文検索（FTS）対応。IP ベースレート制限。検索系は **未認証でも動作**（ブロック関係はセッションがあれば反映）。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `searchPosts(query, genreIds?, cursor?, limit?, filters?)` | `ActionResult<{posts, nextCursor}>` | 投稿検索（FTS / LIKE フォールバック） |
| `searchUsers(query, cursor?, limit?)` | `ActionResult<{users, nextCursor}>` | ユーザー検索 |
| `searchByTag(tag, cursor?, limit?)` | `ActionResult<{posts, nextCursor}>` | タグ検索 |
| `searchShops(query, cursor?, limit?, prefecture?)` | `ActionResult<...>` | 盆栽園検索 |
| `searchEvents(query, cursor?, limit?, options?)` | `ActionResult<...>` | イベント検索 |
| `searchBonsais(query, cursor?, limit?, userId?)` | `ActionResult<...>` | 盆栽検索 |
| `searchGlobal(query)` | `ActionResult<...>` | グローバル検索（投稿・ユーザー・盆栽園・イベント横断） |
| `getPopularTags(limit?)` | `{ tags: ... }` | 人気タグ取得（RSC データ取得モジュール経由） |
| `getAllGenres()` | `{ genres: ... }` | 全ジャンル取得（RSC データ取得モジュール経由） |
| `getSearchModeInfo()` | `{ mode: 'bigm' \| 'trgm' \| 'like' }` | 検索モード情報（FTS有効/無効） |

`getPopularTags` / `getAllGenres` / `getSearchModeInfo` は `lib/actions/search-meta.ts` の RSC データ取得モジュール（`'use server'` 不付与）を `search.ts` バレルが Server Action として再エクスポートしている。client component から呼ぶ場合も従来通り。

---

### 予約投稿 (`lib/actions/scheduled-post.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `createScheduledPost(formData)` | 予約投稿作成 |
| `getScheduledPosts()` | 予約投稿一覧取得 |
| `getScheduledPost(id)` | 予約投稿詳細取得 |
| `updateScheduledPost(id, formData)` | 予約投稿更新 |
| `deleteScheduledPost(id)` | 予約投稿削除 |
| `cancelScheduledPost(id)` | 予約投稿キャンセル |
| `publishScheduledPosts(cronSecret?)` | 予約投稿公開処理（cron用） |

---

### 下書き (`lib/actions/draft.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `getDrafts()` | 下書き一覧取得 |
| `getDraftCount()` | 下書き数取得 |
| `saveDraft(data)` | 下書き保存 |
| `publishDraft(draftId)` | 下書きを投稿として公開 |
| `deleteDraft(draftId)` | 下書き削除 |
| `getDraft(draftId)` | 下書き詳細取得 |

---

### アンケート (`lib/actions/poll.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `votePoll(pollId, optionId)` | アンケート投票 |
| `getPollResults(pollId)` | アンケート結果取得 |

---

### サブスクリプション (`lib/actions/subscription.ts`)

**Session 認証必須**。Stripe連携。

| 関数 | 説明 |
|------|------|
| `createCheckoutSession(priceType?)` | Stripeチェックアウトセッション作成（monthly/yearly） |
| `createCustomerPortalSession()` | Stripeカスタマーポータルセッション作成 |
| `getSubscriptionStatus()` | サブスクリプション状態取得 |
| `getPaymentHistory()` | 決済履歴取得 |
| `cancelSubscriptionImmediately()` | サブスクリプション即時キャンセル |
| `getMembershipInfo()` | 会員情報取得 |

---

### アナリティクス (`lib/actions/analytics.ts`)

**Session 認証必須**。取得系のみ Server Action として提供。

> 閲覧・いいね・フォロー等の記録系（旧 `recordProfileView` / `recordPostView` / `recordLikeReceived` / `recordNewFollower` Server Action）は廃止され、記録は `/api/analytics/view` Route Handler 経由で `lib/services/analytics-recording.ts` に集約された。

#### 取得系

| 関数 | 説明 |
|------|------|
| `getPostAnalytics(days?)` | 投稿分析 |
| `getLikeAnalytics(days?)` | いいね分析 |
| `getQuoteAnalytics()` | 引用分析 |
| `getKeywordAnalytics(days?)` | キーワード分析 |
| `getEngagementTrend(days?)` | エンゲージメント推移 |
| `getGenrePerformance(days?)` | ジャンル別パフォーマンス |
| `getFollowerGrowth(days?)` | フォロワー増減推移 |
| `getPeriodComparison(days?)` | 期間比較 |
| `getAnalyticsDashboard(days?)` | ダッシュボード集計 |
| `getDetailedAnalytics(days?)` | 詳細分析 |
| `getBasicStats()` | 基本統計 |

---

### 農薬ガイド (`lib/actions/pesticide.ts`)

**RSC データ取得モジュール**（`'use server'` 不付与・`'server-only'` ガード付き）。RSC ページから直接 await することを想定し、client component には公開していない。各関数は内部で `requireAuth()` を呼び、認証必須。戻り値は `ActionResult` ではなくドメインオブジェクトをそのまま返す。

| 関数 | 説明 |
|------|------|
| `getDiseasePests(params?)` | 病害虫一覧取得（カテゴリフィルタ） |
| `getDiseasePestBySlug(slug)` | スラッグ指定で病害虫詳細取得 |
| `getPesticides(params?)` | 農薬一覧取得（タイプ・対象病害虫フィルタ） |
| `getPesticideBySlug(slug)` | スラッグ指定で農薬詳細取得 |
| `getActiveIngredients(params?)` | 有効成分一覧取得 |
| `getActiveIngredientBySlug(slug)` | スラッグ指定で有効成分詳細取得 |
| `getSpreaderTypes()` | 展着剤タイプ一覧取得 |
| `getSpreaderProducts()` | 展着剤製品一覧取得 |
| `getSpreaderTypeBySlug(slug)` | スラッグ指定で展着剤タイプ詳細取得 |
| `getColumns(params?)` | コラム一覧取得（カテゴリフィルタ） |
| `getColumnBySlug(slug)` | スラッグ指定でコラム詳細取得 |
| `getFormulationTypes()` | 剤型一覧取得 |
| `getFormulationTypeByCode(code)` | コード指定で剤型詳細取得 |

---

### 肥料ガイド (`lib/actions/fertilizer.ts`)

**RSC データ取得モジュール**（`'use server'` 不付与・`'server-only'` ガード付き）。各関数は内部で `requireAuth()` を呼び、認証必須。戻り値は `ActionResult` ではなくドメインオブジェクトをそのまま返す。

| 関数 | 説明 |
|------|------|
| `getNutrients(params?)` | 栄養素一覧取得。`category` でフィルタ可能 |
| `getNutrientBySlug(slug)` | スラッグ指定で栄養素詳細を取得 |
| `getFertilizerCategories()` | 肥料カテゴリ一覧取得 |
| `getTreeSpecies(params?)` | 樹種一覧取得。`category` でフィルタ可能。施肥プラン数を含む |
| `getFertilizationSchedule(treeSpeciesSlug)` | 樹種別の月次施肥スケジュール取得 |
| `getFertilizerColumns(params?)` | 公開済みコラム一覧取得。`category` でフィルタ可能 |
| `getFertilizerColumnBySlug(slug)` | スラッグ指定でコラム詳細を取得 |

---

### ホルモンガイド (`lib/actions/hormone.ts`)

**RSC データ取得モジュール**（`'use server'` 不付与・`'server-only'` ガード付き）。各関数は内部で `requireAuth()` を呼び、認証必須。戻り値は `ActionResult` ではなくドメインオブジェクトをそのまま返す。

| 関数 | 説明 |
|------|------|
| `getHormones(params?)` | ホルモン一覧取得（カテゴリフィルタ） |
| `getHormoneBySlug(slug)` | スラッグ指定でホルモン詳細取得（効果・季節レベル・相互作用含む） |
| `getHormoneInteractions(params?)` | ホルモン相互作用一覧取得 |
| `getHormoneInteractionsBySlug(slug)` | 特定ホルモンの相互作用取得 |
| `getHormoneColumns(params?)` | ホルモンコラム一覧取得 |
| `getHormoneColumnBySlug(slug)` | スラッグ指定でホルモンコラム詳細取得 |
| `getHormoneTechniques()` | 盆栽技法×ホルモン効果マッピング一覧取得 |
| `getHormoneTechniquesBySlug(slug)` | 特定ホルモンに影響する技法一覧取得 |
| `getHormonesWithSeasonalLevels()` | 月別活性レベル付きホルモン一覧取得 |
| `getSimulatorData()` | ホルモンバランスシミュレーター用データ一括取得 |

---

### 盆栽用語辞典 (`lib/actions/dictionary.ts`)

**RSC データ取得モジュール**（`'use server'` 不付与・`'server-only'` ガード付き）。RSC ページから直接呼ぶことを想定し、client component には公開していない。戻り値は `ActionResult` ではなくドメインオブジェクトをそのまま返す。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `getTerms(options?)` | `{ terms: BonsaiTermSummary[] }` | 用語一覧取得（検索・カテゴリフィルタ） |
| `getTermBySlug(slug)` | `{ term: BonsaiTermDetail \| null }` | スラッグ指定で用語詳細取得 |
| `getAdjacentTerms(slug, category)` | `{ prev, next }` | 前後の用語取得（ナビゲーション用） |

---

### 天気 (`lib/actions/weather.ts`)

**Session 認証必須**。返り値は `ActionResult` 型。

| 関数 | 説明 |
|------|------|
| `saveWeatherLocation(data)` | 天気観測地点の保存 |
| `getWeatherLocation()` | 天気観測地点の取得 |
| `removeWeatherLocation()` | 天気観測地点の削除 |
| `getWeatherAdvice()` | 天気に基づく盆栽管理アドバイス取得 |

---

### ハッシュタグ (`lib/actions/hashtag.ts`)

**Session 認証必須**（一部は内部用）。

| 関数 | 説明 |
|------|------|
| `getTrendingHashtags(limit?)` | トレンドハッシュタグ取得 |
| `getPostsByHashtag(tag, cursor?, limit?)` | ハッシュタグ別投稿取得 |
| `recalculateHashtagCounts()` | ハッシュタグカウント再計算（管理用） |
| `searchHashtags(query, limit?)` | ハッシュタグ検索 |

投稿へのハッシュタグ紐付け・除去（`attachHashtagsToPost` / `detachHashtagsFromPost`）は `lib/services/hashtag-sync.ts` に移動済み（`post.ts` の投稿作成/削除から呼ばれる内部 service）。

---

### メンション (`lib/actions/mention.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `searchMentionUsers(query, limit?)` | メンション候補ユーザー検索 |
| `getRecentMentionedUsers(limit?)` | 最近メンションしたユーザー取得 |

メンション通知送信・ユーザー解決（`notifyMentionedUsers` / `resolveMentionUsers`）は `lib/services/mention.ts` に移動済み（Server Action ではなく内部 service）。

---

### お問い合わせ (`lib/actions/contact.ts`)

認証不要（送信）/ **Admin 認証必須**（管理）。

| 関数 | 認証 | 説明 |
|------|------|------|
| `submitContactInquiry(data)` | None | お問い合わせ送信 |
| `getContactInquiries(options)` | Admin | お問い合わせ一覧取得 |
| `getContactStats()` | Admin | お問い合わせ統計 |
| `getContactInquiry(id)` | Admin | お問い合わせ詳細取得 |
| `updateInquiryStatus(id, status, response?)` | Admin | ステータス更新・返信 |
| `deleteInquiry(id)` | Admin | お問い合わせ削除 |

---

### 通報 (`lib/actions/report.ts`)

**Session 認証必須**（作成）/ **Admin 認証必須**（管理）。

| 関数 | 認証 | 説明 |
|------|------|------|
| `createReport(params)` | Session | 通報作成（投稿・コメント・ユーザー対象） |
| `getReports(options?)` | Admin | 通報一覧取得（ステータスフィルタ） |
| `updateReportStatus(reportId, status, response?)` | Admin | 通報ステータス更新 |
| `deleteReportedContent(reportId, contentType)` | Admin | 通報対象コンテンツ削除 |
| `deleteReport(reportId)` | Admin | 通報削除 |
| `getReportStats()` | Admin | 通報統計 |

---

### 投稿非表示 (`lib/actions/hide-post.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `hidePost(postId)` | 投稿を非表示にする（自分のフィードから除外） |
| `getHiddenPostIds(userId)` | 非表示投稿ID一覧取得 |

---

### コメントスレッドミュート (`lib/actions/comment-thread-mute.ts`)

**Session 認証必須**。返り値は `ActionResult` 型。

| 関数 | 説明 |
|------|------|
| `muteThread(rootCommentId)` | スレッドミュート |
| `unmuteThread(rootCommentId)` | スレッドミュート解除 |

ミュート状態判定（`isThreadMuted(userId, rootCommentId)`）は `lib/services/comment-thread-mute.ts` の内部 service として提供（Server Action ではない）。

---

### プッシュ通知 (`lib/actions/push-subscription.ts`)

**Session 認証必須**。

| 関数 | 説明 |
|------|------|
| `subscribePush(subscription)` | プッシュ通知サブスクリプション登録 |
| `unsubscribePush(endpoint)` | プッシュ通知サブスクリプション解除 |
| `getPushSubscriptionStatus()` | サブスクリプション状態取得 |

---

### メンテナンス (`lib/actions/maintenance.ts`)

**Admin 認証必須**（設定変更）。

| 関数 | 認証 | 説明 |
|------|------|------|
| `getMaintenanceSettings()` | Admin | メンテナンス設定取得 |
| `isMaintenanceMode()` | None | メンテナンスモード判定 |
| `checkIsAdmin(userId)` | None | 管理者判定 |
| `updateMaintenanceSettings(data)` | Admin | メンテナンス設定更新 |
| `toggleMaintenanceMode(enabled, reason?)` | Admin | メンテナンスモード切り替え |

---

### ブラックリスト (`lib/actions/blacklist.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `addEmailToBlacklist(email, reason?)` | メールアドレスをブラックリスト追加 |
| `removeEmailFromBlacklist(id)` | メールアドレスをブラックリスト除去 |
| `getEmailBlacklist(options?)` | メールブラックリスト一覧 |
| `isEmailBlacklisted(email)` | メールブラックリスト判定 |
| `addDeviceToBlacklist(fingerprint, reason?)` | デバイスをブラックリスト追加 |
| `removeDeviceFromBlacklist(id)` | デバイスをブラックリスト除去 |
| `getDeviceBlacklist(options?)` | デバイスブラックリスト一覧 |
| `isDeviceBlacklisted(fingerprint)` | デバイスブラックリスト判定 |
| `recordUserDevice(userId, fingerprint)` | ユーザーデバイス記録 |
| `getUserDevices(userId)` | ユーザーデバイス一覧 |
| `blacklistUserDevices(userId, reason?)` | ユーザーの全デバイスをブラックリスト |

---

## 管理者 Server Actions

### 管理者共通 (`lib/actions/admin.ts`)

| 関数 | 説明 |
|------|------|
| `isAdmin()` | 管理者判定 |
| `getAdminInfo()` | 管理者情報取得 |

---

### ユーザー管理 (`lib/actions/admin/users.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getAdminUsers(options?)` | ユーザー一覧取得（検索・ステータスフィルタ） |
| `getAdminUserDetail(userId)` | ユーザー詳細取得 |
| `suspendUser(userId, reason)` | ユーザー凍結 |
| `activateUser(userId)` | ユーザー凍結解除 |
| `deleteUserByAdmin(userId, reason)` | ユーザー削除 |

---

### 投稿管理 (`lib/actions/admin/posts.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getAdminPosts(options?)` | 投稿一覧取得（検索・フィルタ） |
| `deletePostByAdmin(postId, reason)` | 投稿削除（理由付き） |

---

### コンテンツ管理 (`lib/actions/admin/content.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `deleteEventByAdmin(eventId, reason)` | イベント削除 |
| `deleteShopByAdmin(shopId, reason)` | 盆栽園削除 |
| `getAdminReviews(options?)` | レビュー一覧取得 |
| `deleteReviewByAdmin(reviewId, reason)` | レビュー削除 |

---

### モデレーション (`lib/actions/admin/moderation.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getNgWords(options?)` | NGワード一覧取得 |
| `getNgWordStats()` | NGワード統計取得 |
| `createNgWord(data)` | NGワード追加 |
| `deleteNgWord(id)` | NGワード削除 |
| `toggleNgWord(id)` | NGワード有効/無効切り替え |
| `getModerationQueue(options?)` | モデレーションキュー取得 |
| `reviewModerationItem(id, action)` | モデレーション審査（approved/rejected） |
| `bulkReviewModeration(ids, action)` | 一括モデレーション審査 |
| `bulkDeletePosts(postIds)` | 投稿一括削除 |
| `bulkSuspendUsers(userIds)` | ユーザー一括凍結 |

---

### 警告 (`lib/actions/admin/warnings.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getWarnings(options?)` | 警告一覧取得 |
| `issueWarning(data)` | 警告発行 |
| `deactivateWarning(warningId)` | 警告無効化 |
| `getUserWarningsSummary(userId)` | ユーザーの警告サマリー |

---

### ロール管理 (`lib/actions/admin/roles.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getAdminRoles()` | 管理者ロール一覧 |
| `updateAdminRole(targetUserId, newRole)` | 管理者ロール更新 |
| `addAdmin(userId, role)` | 管理者追加 |
| `removeAdmin(targetUserId)` | 管理者削除 |

---

### プレミアム管理 (`lib/actions/admin/premium.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `grantPremium(targetUserId, durationDays?)` | プレミアム付与 |
| `revokePremium(targetUserId)` | プレミアム剥奪 |
| `extendPremium(targetUserId, additionalDays)` | プレミアム延長 |
| `getPremiumUsers(options?)` | プレミアムユーザー一覧 |
| `getPremiumStats()` | プレミアム統計 |
| `searchUserForPremium(query)` | プレミアム付与対象ユーザー検索 |
| `toggleAdminPremium()` | 管理者自身のプレミアム切り替え |
| `getAdminPremiumStatus()` | 管理者プレミアム状態取得 |

---

### 統計 (`lib/actions/admin/stats.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getAdminStats()` | 管理者ダッシュボード統計 |
| `getDailyActiveUsers()` | DAU取得 |
| `getStatsHistory(days?)` | 統計履歴取得 |
| `getDailyVisitorsHistory(days?)` | 日次実訪問者数の推移取得（`daily_visitors` 由来） |
| `getStatsSummary()` | 統計サマリー |

---

### アナリティクス (`lib/actions/admin/analytics.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getCohortAnalysis(options?)` | コホート分析 |
| `getContentAnalysis()` | コンテンツ分析 |
| `exportAnalyticsCSV(type)` | 分析データCSVエクスポート |

---

### アクティビティ (`lib/actions/admin/activity.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getUserActivity(userId, options?)` | ユーザーアクティビティ取得 |
| `detectSuspiciousBehavior(userId)` | 不審行動検出 |

---

### ログ (`lib/actions/admin/logs.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getAdminLogs(options?)` | 管理者操作ログ取得 |

---

### セキュリティ (`lib/actions/admin/security.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getSecurityEvents(options?)` | セキュリティイベント一覧 |
| `getSecurityDashboard()` | セキュリティダッシュボード |

セキュリティイベントの記録（`logSecurityEvent`）は `lib/services/security-events.ts` の内部 service として提供（Server Action ではない）。

---

### IP管理 (`lib/actions/admin/ip-management.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getIpAddresses(options?)` | IPアドレス一覧取得 |
| `detectMultiAccounts()` | 複数アカウント検出 |

---

### お知らせ (`lib/actions/admin/announcements.ts`)

**Admin 認証必須**（管理）/ **None**（公開取得）。

| 関数 | 認証 | 説明 |
|------|------|------|
| `getAnnouncements(options?)` | Admin | お知らせ一覧取得 |
| `createAnnouncement(data)` | Admin | お知らせ作成 |
| `updateAnnouncement(id, data)` | Admin | お知らせ更新 |
| `deleteAnnouncement(id)` | Admin | お知らせ削除 |

公開中のお知らせ取得（`getActiveAnnouncements()`、認証不要）は `lib/actions/announcement.ts`（admin 配下ではない）に分離されている。

---

### CMS (`lib/actions/admin/cms.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getCmsPages(options?)` | CMSページ一覧取得 |
| `getCmsPage(slug)` | CMSページ取得 |
| `createCmsPage(data)` | CMSページ作成 |
| `updateCmsPage(slug, data)` | CMSページ更新 |
| `deleteCmsPage(slug)` | CMSページ削除 |

---

### セグメント (`lib/actions/admin/segments.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getSegments(options?)` | セグメント一覧取得 |
| `createSegment(data)` | セグメント作成 |
| `deleteSegment(id)` | セグメント削除 |
| `evaluateSegment(id)` | セグメント評価（対象ユーザー算出） |

---

### 非表示コンテンツ管理 (`lib/actions/admin/hidden.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getHiddenContent(options?)` | 非表示コンテンツ一覧 |
| `restoreContent(type, id)` | コンテンツ復元 |
| `deleteHiddenContent(type, id)` | 非表示コンテンツ完全削除 |
| `getAdminNotifications(options?)` | 管理者通知一覧 |
| `markAdminNotificationAsRead(notificationId)` | 管理者通知既読 |
| `markAllAdminNotificationsAsRead()` | 管理者通知全件既読 |

---

### モニタリング (`lib/actions/admin/monitoring.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getMonitoringStats()` | システムモニタリング統計 |

---

### 農薬データ管理 (`lib/actions/admin/pesticide-data.ts`)

**Admin 認証必須**。

| 関数 | 説明 |
|------|------|
| `getAdminPesticides(options?)` | 農薬一覧取得（管理用） |
| `getAdminPesticideDetail(id)` | 農薬詳細取得（管理用） |
| `createPesticide(data)` | 農薬データ作成 |
| `updatePesticide(id, data)` | 農薬データ更新 |
| `deletePesticide(id)` | 農薬データ削除 |
| `getPesticideHistory(options?)` | 農薬データ変更履歴 |

---

## 共通パターン

### ページネーション

カーソルベースページネーションを全一覧系APIで使用:

```typescript
{
  items: T[],
  nextCursor: string | undefined,  // 次ページのカーソル（undefinedで末尾）
}
```

### ActionResult 型

Server Actions は統一的なエラー返却に `ActionResult` 型を使用:

```typescript
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }
```

ヘルパー関数: `actionSuccess(data?)` / `actionError(message)` / `withAuth(gate, fn)` / `andThenActionResult(result, fn)` / `mapActionResult(result, fn)`（`types/action-result.ts`）

---

### レート制限

Upstash Redis によるスライディングウィンドウ方式。

#### 認証系

| アクション | 制限 | ウィンドウ |
|-----------|------|----------|
| login | 5回 | 15分 |
| register | 3回 | 1時間 |
| passwordReset | 3回 | 1時間 |
| verify_2fa | 5回 | 15分 |
| contact | 3回 | 15分 |

#### 書き込み系

| アクション | 制限 | ウィンドウ |
|-----------|------|----------|
| post | 3回 | 1分 |
| comment | 5回 | 1分 |
| upload | 5回 | 1分 |
| create_shop | 3回 | 1分 |
| update_shop | 5回 | 1分 |
| create_event | 3回 | 1分 |
| update_event | 5回 | 1分 |
| create_review | 3回 | 1分 |
| update_review | 5回 | 1分 |
| create_draft | 5回 | 1分 |
| update_draft | 10回 | 1分 |
| create_report | 5回 | 1分 |
| create_bonsai | 3回 | 1分 |
| update_bonsai | 5回 | 1分 |
| create_bonsai_record | 5回 | 1分 |
| send_message | 20回 | 1分 |
| toggle_like | 30回 | 1分 |
| delete_shop | 5回 | 1分 |
| delete_event | 5回 | 1分 |
| delete_review | 5回 | 1分 |
| delete_comment | 10回 | 1分 |

#### 読み取り系

| アクション | 制限 | ウィンドウ | 備考 |
|-----------|------|----------|------|
| api | 60回 | 1分 | IPベース |
| search | 20回 | 1分 | IPベース |
| engagement | 30回 | 1分 | |
| timeline | 30回 | 1分 | |
| read | 60回 | 1分 | |

#### 日次制限

| アクション | 制限 | 備考 |
|-----------|------|------|
| upload | 50回/日 | UTC 0時リセット |
| message | DAILY_MESSAGE_LIMIT | UTC 0時リセット |

---

### 認証パターン一覧

| パターン | 用途 |
|----------|------|
| `requireAuth()` | 基本セッションチェック |
| `requireActiveUser(action)` | セッション + 凍結チェック + レート制限 |
| `requireActiveNonGuestUser(action)` | セッション + 非ゲスト + 凍結チェック + レート制限 |
| `requireAdmin(requiredAction?)` | 管理者ロール + オプション権限チェック |
| `verifyCronAuth()` | HMAC-SHA256署名（cronジョブ用） |
| Bearer トークン | タイミングセーフ比較（シードエンドポイント用） |
