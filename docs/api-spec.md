# BON-LOG API 仕様書

## 認証方式

| 方式 | 説明 |
|------|------|
| Session | NextAuth.js JWT セッション (`auth()`) — cookie ベース |
| ActiveUser | セッション + 凍結チェック + レート制限 (`requireActiveUser()`) |
| ActiveNonGuest | セッション + 非ゲスト + 凍結チェック + レート制限 (`requireActiveNonGuestUser()`) |
| Admin | セッション + `adminUser` レコード + 権限チェック (`requireAdmin()`) |
| JWT Bearer | モバイル v1 API: `Authorization: Bearer <accessToken>` — JWT アクセストークン（`lib/api/v1/auth-guard.ts` の `requireBearerUser()` で検証。有効期限切れ時は `/api/v1/auth/refresh` でトークンペア更新） |
| HMAC-SHA256 | Cron ジョブ用: タイムスタンプ + 署名検証 (`verifyCronAuth()`) |
| Stripe Webhook | `stripe.webhooks.constructEvent()` 署名検証 |
| RevenueCat Webhook | `Authorization` ヘッダーと環境変数 `REVENUECAT_WEBHOOK_AUTH_HEADER` をタイミングセーフ比較 (`timingSafeEqual`) |
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

## API Routes (`app/api/` 配下 100 Route Handlers: 非 v1 エンドポイント 25 本 + モバイル REST API v1 75 本)

`app/api/` 配下: `.ts` 形式の Route Handler 99 本 + `og/route.tsx`（動的 OG 画像生成、Node.js ランタイム）の合計 100 本。
内訳: 非 v1 エンドポイント 25 本（ad-frame / admin / analytics / auth / badges / cron / health / maintenance / og / push / upload / webhooks）+ モバイル REST API v1 75 本（`/api/v1/*`、JWT Bearer 認証）。
`app/api/upload/_shared/` 配下に `profile-image-upload.ts` / `require-upload-user.ts` / `validate-upload-file.ts` の 3 本のアップロード共有ヘルパーを配置（`_shared/` プレフィックスにより Next.js のルート対象外）。
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
- **説明:** 画像・動画アップロード（動画はプレミアム会員限定）。ファイルタイプ・サイズ・シグネチャ検証（MIMEタイプ偽装防止）
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
- **認証:** Session（動画専用のためプレミアム会員限定）
- **レート制限:** 5回/分, 50回/日
- **説明:** Cloudflare R2直接アップロード用署名付きURL生成（動画は最大80MB）。Vercelの4.5MBペイロード制限を回避
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

#### POST `/api/webhooks/revenuecat`
- **認証:** 共有シークレット定数時間比較（`timingSafeEqual`）— `Authorization` ヘッダーと環境変数 `REVENUECAT_WEBHOOK_AUTH_HEADER` を照合。環境変数未設定時は fail-closed（503）
- **レート制限:** `RATE_LIMITS.api`（60req/分・IPベース、fail-open）— 正規 RevenueCat webhook を優先するため fail-open
- **冪等性:** `ensureWebhookEventOnce(WEBHOOK_PROVIDER_REVENUECAT, event.id)` で `webhook_events` テーブルへ UNIQUE INSERT。重複イベントは `200 { received: true, duplicate: true }` を返す。処理失敗時はロックを `deleteWebhookEvent` で解放してリトライを許容
- **ペイロード検証:** `revenueCatPayloadSchema`（Zod）でペイロード形状を検証。スキーマ不一致時は 200 + `{ received: true, error }` を返す（RevenueCat の永久リトライ防止）
- **説明:** RevenueCat モバイルサブスクリプションライフサイクルイベント処理（`lib/services/revenuecat.ts` の `processRevenueCatEvent()` に委譲）
- **対応イベント:**
  - `INITIAL_PURCHASE` — isPremium=true、premiumExpiresAt 更新
  - `RENEWAL` — isPremium=true、premiumExpiresAt 更新
  - `CANCELLATION` — premiumCancelledAt 更新（isPremium は EXPIRATION まで維持）
  - `EXPIRATION` — isPremium=false、premiumExpiresAt=null

---

### Cron ジョブ

全ジョブで `verifyCronAuth()` による認証（Bearer `CRON_SECRET`（GET のみ）/ HMAC-SHA256 署名 + タイムスタンプの 2 方式）。
本番は GitHub Actions（`.github/workflows/cron.yml`）の schedule が Bearer 方式で起動する。

#### GET `/api/cron/publish-scheduled`
- **認証:** `verifyCronAuth`（Bearer / HMAC。未認証時 `401 { error: API_ERR_UNAUTHORIZED }` を返す）
- **実行間隔:** 5分毎 (`*/5 * * * *`)
- **maxDuration:** 60 秒（リテラル。`CRON_FUNCTION_TIMEOUT_SECONDS` 定数と一致することを型レベルで検証）
- **説明:** 予約投稿の公開処理（バッチ）。本体は `lib/services/scheduled-post-publisher.ts` の `publishDueScheduledPosts()`。凍結ユーザーの投稿はスキップ
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

## モバイル REST API v1 (`/api/v1/` 配下 75 Route Handlers)

モバイルアプリ（Expo/React Native）向けの JWT ベース REST API。Web の NextAuth cookie セッションとは独立した認証基盤を持つ。

### 共通仕様

- **認証:** `Authorization: Bearer <accessToken>` ヘッダー（`lib/api/v1/auth-guard.ts` の `requireBearerUser()` で検証）
- **アクセストークン:** 短命 JWT（`lib/api/v1/jwt.ts`）。ペイロードに `userId` を格納
- **リフレッシュトークン:** SHA-256 ハッシュで DB 保存（`refresh_tokens` テーブル）。ローテーション + 再利用検知（盗難時に当該ユーザーの全トークンを即時失効）
- **モバイルデバイス:** Expo Push Token を `mobile_devices` テーブルで管理（`/api/v1/devices`）
- **エラーコード:** `lib/constants/errors/mobile-api.ts` の `MOBILE_API_ERROR_CODES` 定数
- **制限定数:** `lib/constants/limits/mobile-auth.ts`（トークン有効期限等）、`lib/constants/limits/mobile-device.ts`
- **共有基盤:** `lib/api/v1/`（auth-guard, jwt, token-pair, mention-resolver, follow-state-resolver, pagination, response, types + schemas/）
- **OpenAPI:** `scripts/generate-openapi.ts`（`@asteasolutions/zod-to-openapi` 使用）。`npm run generate:openapi` で生成
- **ゲスト:** ゲストアカウントでの書き込み操作は 403 `GUEST_NOT_ALLOWED`。読み取りは認証任意のエンドポイントあり
- **ページネーション:** カーソルベース（`cursor` / `limit` クエリパラメータ）。レスポンス形式: `{ items: T[], nextCursor?: string }`

### 認証エンドポイント

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| POST | `/api/v1/auth/register` | None | 新規ユーザー登録（メール/パスワード/ニックネーム）。確認メール送信後 201 + `{ success: true }` |
| POST | `/api/v1/auth/login` | None | メール/パスワード認証。2FA 無効: 200 + tokenPair; 2FA 有効: 202 + `{ requires2FA: true, ticket }` |
| POST | `/api/v1/auth/logout` | None | リフレッシュトークン失効（冪等） |
| POST | `/api/v1/auth/refresh` | None | トークンペア更新。ローテーション + 再利用検知 |
| POST | `/api/v1/auth/google` | None | Google ID トークン認証（`jose` + JWKS 検証）。Account 経由でユーザー解決・作成 |
| POST | `/api/v1/auth/2fa/verify` | None (チケット) | 2FA コード検証（TOTP またはバックアップコード）。チケットは GETDEL で単回使用 |
| POST | `/api/v1/auth/password-reset/request` | None | パスワードリセット申請（列挙攻撃対策: 常に 200） |
| POST | `/api/v1/auth/password-reset/confirm` | None | パスワードリセット実行 |
| POST | `/api/v1/auth/verify-email/resend` | None | 確認メール再送（列挙攻撃対策: 常に 200） |

### フィード

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/feed` | JWT Bearer | タイムライン取得（フォロー中ユーザーの投稿。ブロック/ミュート除外）。カーソルページネーション |

### 投稿

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| POST | `/api/v1/posts` | JWT Bearer（非ゲスト） | 投稿作成（テキスト/ジャンル/メディア URL） |
| GET | `/api/v1/posts/{id}` | JWT Bearer | 投稿詳細取得 |
| PATCH | `/api/v1/posts/{id}` | JWT Bearer（非ゲスト） | 投稿編集（所有者のみ） |
| DELETE | `/api/v1/posts/{id}` | JWT Bearer（非ゲスト） | 投稿削除（所有者のみ） |
| POST | `/api/v1/posts/{id}/like` | JWT Bearer | いいね（冪等） |
| DELETE | `/api/v1/posts/{id}/like` | JWT Bearer（非ゲスト） | いいね解除（冪等） |
| GET | `/api/v1/posts/{id}/comments` | JWT Bearer | コメント一覧取得。カーソルページネーション |
| POST | `/api/v1/posts/{id}/comments` | JWT Bearer（非ゲスト） | コメント作成 |
| DELETE | `/api/v1/posts/{id}/comments/{commentId}` | JWT Bearer（非ゲスト） | コメント削除（コメント所有者または投稿所有者） |
| POST | `/api/v1/posts/{id}/bookmark` | JWT Bearer（非ゲスト） | ブックマーク（冪等） |
| DELETE | `/api/v1/posts/{id}/bookmark` | JWT Bearer（非ゲスト） | ブックマーク解除（冪等） |

### ユーザー

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/users/{id}` | JWT Bearer | ユーザープロフィール取得（email 非公開） |
| POST | `/api/v1/users/{id}/follow` | JWT Bearer（非ゲスト） | フォロー（公開: 確立、非公開: リクエスト送信）。レスポンス: `{ following, requested, followerCount }` |
| DELETE | `/api/v1/users/{id}/follow` | JWT Bearer（非ゲスト） | フォロー解除またはリクエスト取消 |
| POST | `/api/v1/users/{id}/block` | JWT Bearer（非ゲスト） | ブロック（冪等） |
| DELETE | `/api/v1/users/{id}/block` | JWT Bearer（非ゲスト） | ブロック解除（冪等） |
| POST | `/api/v1/users/{id}/mute` | JWT Bearer（非ゲスト） | ミュート（冪等） |
| DELETE | `/api/v1/users/{id}/mute` | JWT Bearer（非ゲスト） | ミュート解除（冪等） |
| GET | `/api/v1/users/me` | JWT Bearer | 自分の基本情報取得 |
| PATCH | `/api/v1/users/me` | JWT Bearer（非ゲスト） | プロフィール編集（nickname / bio / avatarUrl / headerUrl 等） |
| DELETE | `/api/v1/users/me` | JWT Bearer（非ゲスト） | アカウント削除（不可逆） |
| GET | `/api/v1/users/me/bookmarks` | JWT Bearer（非ゲスト） | ブックマーク投稿一覧。カーソルページネーション |
| GET | `/api/v1/users/me/blocks` | JWT Bearer（非ゲスト） | ブロック一覧。カーソルページネーション |
| GET | `/api/v1/users/me/mutes` | JWT Bearer（非ゲスト） | ミュート一覧。カーソルページネーション |
| GET | `/api/v1/users/me/follow-requests` | JWT Bearer（非ゲスト） | 受信フォローリクエスト一覧（pending のみ） |
| POST | `/api/v1/users/me/follow-requests/{id}/approve` | JWT Bearer（非ゲスト） | フォローリクエスト承認 |
| POST | `/api/v1/users/me/follow-requests/{id}/reject` | JWT Bearer（非ゲスト） | フォローリクエスト拒否 |
| GET | `/api/v1/users/me/notification-settings` | JWT Bearer（非ゲスト） | 通知設定取得 |
| PATCH | `/api/v1/users/me/notification-settings` | JWT Bearer（非ゲスト） | 通知設定部分更新（system / subscription_expiring 除外） |

### 通知

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/notifications` | JWT Bearer | 通知一覧取得。カーソルページネーション |
| GET | `/api/v1/notifications/unread-count` | JWT Bearer | 未読通知件数取得 |
| PATCH | `/api/v1/notifications/read` | JWT Bearer | 通知既読化。`ids` 指定: 特定通知群を既読; `ids` 省略: 全未読を既読 |

### 検索

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/search/posts` | JWT Bearer | 投稿キーワード検索（FTS / LIKE フォールバック）。`q` / `cursor` / `limit` |
| GET | `/api/v1/search/users` | JWT Bearer | ユーザーキーワード検索。`q` / `cursor` / `limit` |

### 探索

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/explore/trending-hashtags` | JWT Bearer（ゲスト可） | トレンドハッシュタグ一覧。`limit` |
| GET | `/api/v1/explore/trending-genres` | JWT Bearer（ゲスト可） | トレンドジャンル一覧（直近 48 時間の投稿数付き）。`limit` |
| GET | `/api/v1/explore/recommended-users` | JWT Bearer（ゲスト可） | おすすめユーザー一覧。ゲスト時は空配列 |
| GET | `/api/v1/explore/posts` | JWT Bearer（ゲスト可） | ハッシュタグまたはジャンル別投稿一覧。`hashtag` / `genreId` いずれか一方必須 |

### 通報

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| POST | `/api/v1/reports` | JWT Bearer（非ゲスト） | 通報作成（投稿/コメント/ユーザー）。AUTO_HIDE_THRESHOLD 到達で自動非表示 |

### デバイス（Push 通知）

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| POST | `/api/v1/devices` | JWT Bearer（非ゲスト） | Expo Push Token 登録（冪等 upsert）。`lib/services/device-service.ts` の `registerDevice()` |
| DELETE | `/api/v1/devices/{token}` | JWT Bearer（非ゲスト） | Push Token 解除（冪等。他人・不存在トークンも 200） |

### アップロード

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| POST | `/api/v1/upload/image` | JWT Bearer（非ゲスト） | 画像アップロード（multipart/form-data）。EXIF/GPS 除去済みで R2 保存。プレミアム不問 |
| POST | `/api/v1/upload/presigned` | JWT Bearer（非ゲスト・プレミアム限定） | 動画 presigned PUT URL 生成。既存 `/api/upload/presigned` の Bearer 版 |

### 盆栽

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/bonsai` | JWT Bearer | 自分の盆栽一覧取得 |
| POST | `/api/v1/bonsai` | JWT Bearer（非ゲスト） | 盆栽作成 |
| GET | `/api/v1/bonsai/{id}` | JWT Bearer | 盆栽詳細取得 |
| PATCH | `/api/v1/bonsai/{id}` | JWT Bearer（非ゲスト） | 盆栽更新（所有者のみ） |
| DELETE | `/api/v1/bonsai/{id}` | JWT Bearer（非ゲスト） | 盆栽削除（所有者のみ） |
| GET | `/api/v1/bonsai/{id}/records` | JWT Bearer | 成長記録一覧取得。カーソルページネーション |
| POST | `/api/v1/bonsai/{id}/records` | JWT Bearer（非ゲスト） | 成長記録作成 |
| PATCH | `/api/v1/bonsai/{id}/records/{recordId}` | JWT Bearer（非ゲスト） | 成長記録更新（所有者のみ） |
| DELETE | `/api/v1/bonsai/{id}/records/{recordId}` | JWT Bearer（非ゲスト） | 成長記録削除（所有者のみ） |
| GET | `/api/v1/bonsai/care-logs` | JWT Bearer（非ゲスト） | 手入れログ一覧（盆栽に紐付かないユーザー全体のメモ）。カーソルページネーション |
| POST | `/api/v1/bonsai/care-logs` | JWT Bearer（非ゲスト） | 手入れログ作成 |
| PATCH | `/api/v1/bonsai/care-logs/{logId}` | JWT Bearer（非ゲスト） | 手入れログ更新（所有者のみ） |
| DELETE | `/api/v1/bonsai/care-logs/{logId}` | JWT Bearer（非ゲスト） | 手入れログ削除（所有者のみ） |

### イベント

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/events` | JWT Bearer（ゲスト可） | イベント一覧取得（日付・地域フィルタ可） |
| POST | `/api/v1/events` | JWT Bearer（非ゲスト） | イベント作成 |
| GET | `/api/v1/events/{id}` | JWT Bearer（ゲスト可） | イベント詳細取得 |
| PATCH | `/api/v1/events/{id}` | JWT Bearer（非ゲスト） | イベント更新（作成者のみ） |
| DELETE | `/api/v1/events/{id}` | JWT Bearer（非ゲスト） | イベント削除（作成者のみ） |

### 盆栽園

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/shops` | JWT Bearer（ゲスト可） | 盆栽園一覧取得（地域・ジャンルフィルタ可） |
| POST | `/api/v1/shops` | JWT Bearer（非ゲスト） | 盆栽園登録 |
| GET | `/api/v1/shops/{id}` | JWT Bearer（ゲスト可） | 盆栽園詳細取得 |
| PATCH | `/api/v1/shops/{id}` | JWT Bearer（非ゲスト） | 盆栽園編集（作成者または admin） |
| GET | `/api/v1/shops/{id}/reviews` | JWT Bearer（ゲスト可） | レビュー一覧取得。カーソルページネーション |
| POST | `/api/v1/shops/{id}/reviews` | JWT Bearer（非ゲスト） | レビュー投稿（星 + テキスト + 画像 URL） |

### 予約投稿（プレミアム限定）

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/scheduled-posts` | JWT Bearer（非ゲスト・プレミアム） | 予約投稿一覧 |
| POST | `/api/v1/scheduled-posts` | JWT Bearer（非ゲスト・プレミアム） | 予約投稿作成 |
| GET | `/api/v1/scheduled-posts/{id}` | JWT Bearer（非ゲスト・プレミアム） | 予約投稿詳細取得（所有者のみ） |
| PATCH | `/api/v1/scheduled-posts/{id}` | JWT Bearer（非ゲスト・プレミアム） | 予約投稿更新（pending 状態のみ） |
| DELETE | `/api/v1/scheduled-posts/{id}` | JWT Bearer（非ゲスト・プレミアム） | 予約投稿削除（published 不可） |
| POST | `/api/v1/scheduled-posts/{id}/cancel` | JWT Bearer（非ゲスト・プレミアム） | 予約投稿ソフトキャンセル（status→cancelled） |

### ジャンル

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/genres` | JWT Bearer（ゲスト可） | ジャンル一覧。`type=shop\|post` クエリでフィルタ |

### 盆栽用語辞典

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/dictionary` | JWT Bearer（ゲスト可） | 用語一覧。`search` / `category` / `row` フィルタ。カーソルページネーション |
| GET | `/api/v1/dictionary/{slug}` | JWT Bearer（ゲスト可） | 用語詳細取得 |

### 肥料ガイド

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/fertilizers/categories` | JWT Bearer（ゲスト可） | 肥料カテゴリ一覧（全件返却） |
| GET | `/api/v1/fertilizers/nutrients` | JWT Bearer（ゲスト可） | 栄養素一覧。`category` フィルタ |
| GET | `/api/v1/fertilizers/nutrients/{slug}` | JWT Bearer（ゲスト可） | 栄養素詳細取得 |
| GET | `/api/v1/fertilizers/tree-species` | JWT Bearer（ゲスト可） | 樹種一覧（施肥プラン数付き） |
| GET | `/api/v1/fertilizers/tree-species/{slug}/schedule` | JWT Bearer（ゲスト可） | 樹種別月次施肥スケジュール取得 |

### ホルモンガイド

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/hormones` | JWT Bearer（ゲスト可） | ホルモン一覧。カーソルページネーション |
| GET | `/api/v1/hormones/{slug}` | JWT Bearer（ゲスト可） | ホルモン詳細取得（効果・季節レベル・相互作用含む） |

### 農薬ガイド

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/pesticides/disease-pests` | JWT Bearer（ゲスト可） | 病害虫一覧。カテゴリフィルタ |
| GET | `/api/v1/pesticides/disease-pests/{slug}` | JWT Bearer（ゲスト可） | 病害虫詳細取得 |
| GET | `/api/v1/pesticides/products` | JWT Bearer（ゲスト可） | 農薬製品一覧。`type` フィルタ（herbicide→other 正規化） |
| GET | `/api/v1/pesticides/products/{slug}` | JWT Bearer（ゲスト可） | 農薬製品詳細取得 |
| GET | `/api/v1/pesticides/ingredients` | JWT Bearer（ゲスト可） | 有効成分一覧 |
| GET | `/api/v1/pesticides/ingredients/{slug}` | JWT Bearer（ゲスト可） | 有効成分詳細取得 |

### 法的文章

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/legal` | JWT Bearer（ゲスト可） | 利用可能な法的文章の slug/title 一覧 |
| GET | `/api/v1/legal/{slug}` | JWT Bearer（ゲスト可） | 法的文章詳細取得 |

### アナリティクス（プレミアム限定）

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| GET | `/api/v1/analytics/summary` | JWT Bearer（非ゲスト・プレミアム） | 自分の投稿分析サマリ。`days=7\|30\|90`（省略時 30） |

---

## Server Actions (89 ファイル: ルート 68 + 管理者 20 + schemas 1。うち `'use server'` ディレクティブ付きは 83 本)

### 戻り値型ポリシー（CLAUDE.md ルール2）

すべての Server Action は **`ActionResult<T>`** 型（`types/action-result.ts`）で返却する:

```ts
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }
```

エラーメッセージは必ず `lib/constants/errors/` 配下のドメイン別 `ERR_*` 定数を使用し、インライン文字列は禁止。28 個以上の `ERR_*` を import するファイル（例: `lib/actions/auth.ts`）はドメイン別 sub-import で整理する。

#### `'use server'` を持たないモジュール（規約対象外）

`lib/actions/` 配下でも以下は **クライアントから RPC 公開しない内部 helper / schema 定義** として `'use server'` を外した設計となっている。これらは Server Action ではないため ActionResult 規約は適用されない。**89 ファイル中、`'use server'` を一切含まないファイルは 6 本**:

**内部 helper（任意 input で外部から直接呼ばれない設計）:**
- `lib/actions/filter-helper.ts` — ブロック/ミュート除外 ID 取得（`getExcludedUserIds` / `getBlockedUserIds` / `getMutedUserIds`）。`'server-only'` 化により RPC 露出を遮断
- `lib/actions/pagination.ts` — カーソルベース pagination ヘルパ（`MAX_PAGE_LIMIT` で clamp）
- `lib/actions/prisma-filters.ts` — Prisma where 句生成 helper（ブロック・非公開・凍結除外）

**barrel re-export:**
- `lib/actions/user.ts` — `user-profile` / `user-media` / `user-account` の再エクスポート（`export *` のみ。再エクスポート先の各ファイルは `'use server'` を持つ）

**schema 定義モジュール:**
- `lib/actions/schemas/common.ts` — 共有 Zod schema 定義
- `lib/actions/admin/_schemas.ts` — admin Action 用 Zod schema 定義

上記以外にも `lib/actions/dictionary.ts` / `lib/actions/fertilizer.ts` / `lib/actions/hormone.ts` / `lib/actions/pesticide.ts` / `lib/actions/search-meta.ts` / `lib/actions/admin.ts` / `lib/actions/post-include.ts` / `lib/actions/post-validation.ts` / `lib/actions/utils.ts` 等は `'use server'` ディレクティブを持たない RSC 専用モジュール・内部 helper として設計されているが、これらはファイル内のコメントに `'use server'` への言及を含む（「付与しない理由」の説明として）ため上記 6 本とは区別して扱う。

> 共有 Prisma select/include 定数（`USER_MINIMAL_SELECT` / `USER_MINIMAL_RELATION` / `USER_MINIMAL_WITH_BIO_SELECT` / `GENRE_MINIMAL_SELECT` / `POST_GENRE_RELATION` 等）は `lib/actions/` ではなく **`lib/prisma/shared-includes.ts`** に集約されている（依存方向中立のため actions/services 双方から import 可能）。

RSC データ取得モジュール（fertilizer/hormone/pesticide/dictionary/search-meta）は **page.tsx から直接 await** することを想定。client component から呼ぶ必要があるものは `lib/actions/search.ts` バレル等が `'use server'` で再エクスポートしている。

### ファイル一覧

**ルートActions (68):** admin†, analytics, announcement, auth, auth-email-verify, auth-password-reset, blacklist, block, bonsai, bonsai-care-log, bonsai-record, bookmark, comment, comment-thread-mute, contact, dictionary†, draft, event, event-import, feed, fertilizer†, filter-helper‡, follow, follow-request, hashtag, hide-post, hormone†, like, maintenance, mention, message, message-conversations, message-messages, mute, notification, notification-preferences, onboarding, pagination‡, pesticide†, pin-post, poll, post, post-include†, post-validation†, prisma-filters‡, push-subscription, report, report-admin, report-user, review, scheduled-post, scheduled-post-crud, search, search-entities, search-meta†, search-posts, search-users, security-activity, shop, shop-change-request, subscription, two-factor, user‡, user-account, user-media, user-profile, utils†, weather

† `'use server'` ディレクティブを持たない RSC 専用モジュール / 内部 helper（ファイル内コメントで理由を説明）。
‡ `'use server'` を一切含まないモジュール（上記 6 ファイルに該当）。

**管理者Actions (20):** activity, analytics, announcements, cms, content, hidden, ip-management, logs, moderation, monitoring, pesticide-data, posts, premium, roles, security, segments, stats, users, warnings, _schemas‡（Zod schema 定義）

**schemas (1):** common‡（Zod schema 定義）

### サービス層ヘルパー（CLAUDE.md ルール6 / lib/services/ 全 61 ファイル）

`lib/services/` 配下のサービスは複数の Action から共有される再利用ロジック。外部（components/）からは直接呼ばれない。

#### 通知系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `notification-core.ts` | `createNotification(params)` — **単発通知**（ブロック/設定/重複チェック + push 配信）。`system` / `subscription_expiring` 型はブロックチェックをスキップ。`deleteNotification(params)` — 通知削除。`prisma.notification.create` 直接呼出禁止 |
| `notification-bulk.ts` | `createNotificationsBulk(params)` — **複数受信者への同種通知**（block/prefs フィルタ + `createMany({ skipDuplicates: true })` + 個別 push） |
| `notification-read-service.ts` | `fetchNotifications` / `fetchUnreadNotificationCount` — v1 通知一覧・未読数取得 |
| `notification-preferences-utils.ts` | 通知設定の get/update ロジック共有 |
| `comment-notifications.ts` | コメント関連通知（`createNotification`/`createNotificationsBulk` へ delegate） |
| `push/expo-push.ts` | Expo Push Notification Service 連携（モバイル push 送信） |

#### 認証・登録系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `credential-verification.ts` | `verifyCredentials(email, password)` — throttle / bcrypt / 停止 / 未確認チェックを含む credentials 照合 |
| `registration-service.ts` | `registerUserCore(params)` — Web/モバイル共通のユーザー作成 + 確認メール送信 |
| `email-verify-core.ts` | メール認証トークン発行・検証ロジック |
| `password-reset-service.ts` | パスワードリセットメール送信・トークン検証 |
| `login-throttle.ts` | ログイン試行回数の throttle / ロックアウト管理（Redis） |
| `blacklist-check.ts` | メール / デバイスのブラックリスト照合 |
| `user-eligibility.ts` | ユーザーの操作資格判定（凍結チェック等） |

#### ユーザー系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `user-read-service.ts` | `fetchUserProfile` — v1 ユーザープロフィール取得 |
| `user-profile-write-service.ts` | プロフィール更新（PATCH /api/v1/users/me 等） |
| `account-deletion-service.ts` | アカウント削除処理（データ完全削除の cascade 処理） |
| `follow-service.ts` | `followUser` / `unfollowUser` / `sendFollowRequest` — フォロー関係の作成・解除・リクエスト処理 |
| `block-service.ts` | `blockUserService` / `unblockUserService` / `getBlockedUsersService` |
| `mute-service.ts` | `muteUserService` / `unmuteUserService` / `getMutedUsersService` |
| `authorization.ts` | `requireAuthorization(...)` — 認可チェック共通化 |

#### 投稿系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `post-read-service.ts` | `fetchPostDetail` — 投稿詳細取得（v1 用） |
| `post-write-service.ts` | `createPostV1` / `updatePostV1` / `deletePostV1` / `fetchCreatedPost` — 投稿 CRUD（v1 用） |
| `post-visibility.ts` | 投稿の可視性判定（ブロック・非公開・凍結除外） |
| `like-service.ts` | いいね追加・解除・状態取得（v1 用） |
| `bookmark-service.ts` | `addBookmark` / `removeBookmark` / `getBookmarkedPosts` — ブックマーク管理 |
| `feed-service.ts` | `fetchTimeline` — タイムライン取得（フォロー中ユーザーの投稿） |
| `hashtag-sync.ts` | `attachHashtagsToPost` / `detachHashtagsFromPost` — 投稿ハッシュタグの同期・差分更新 |
| `hashtag-recount.ts` | ハッシュタグ参照件数の再計算（管理操作 / cron 用） |
| `mention.ts` | `notifyMentionedUsers` / `resolveMentionUsers` — メンション通知送信・ユーザー情報解決 |

#### コメント系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `comment-read-service.ts` | `fetchComments` — コメント一覧取得（v1 用） |
| `comment-write-service.ts` | `createCommentV1` — コメント作成（v1 用） |
| `comment-thread-mute.ts` | `isThreadMuted(userId, rootCommentId)` — スレッドミュート状態判定 |

#### 検索・探索系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `search-service.ts` | `fetchSearchPosts` / `fetchSearchUsers` — FTS / LIKE フォールバック検索 |
| `explore-service.ts` | おすすめユーザー・トレンドジャンル・トレンドハッシュタグ取得 |
| `explore-posts-service.ts` | ハッシュタグ / ジャンル別投稿一覧取得 |

#### 通報系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `report-service.ts` | 通報作成・自動非表示ロジック（AUTO_HIDE_THRESHOLD 到達時） |

#### 盆栽系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `bonsai-service.ts` | 盆栽 CRUD（v1 用） |
| `bonsai-record-service.ts` | 成長記録 CRUD（v1 用） |
| `bonsai-care-log-service.ts` | 手入れログ CRUD・期間取得（v1 用） |

#### イベント・ショップ系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `event-service.ts` | イベント CRUD / 一覧取得（v1 用） |
| `shop-service.ts` | 盆栽園 CRUD / レビュー投稿（v1 用） |

#### 予約投稿系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `scheduled-post-publisher.ts` | `publishDueScheduledPosts()` — cron から呼ばれる予約投稿公開バッチ |
| `scheduled-post-service.ts` | `cancelScheduledPostV1` 等 — 予約投稿 CRUD（v1 用） |

#### マスターデータ系（読み取り専用）

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `dictionary-read-service.ts` | 盆栽用語辞典の読み取り（v1 用） |
| `fertilizer-read-service.ts` | 肥料・栄養素・樹種・施肥スケジュール（v1 用） |
| `hormone-read-service.ts` | ホルモン・相互作用・季節レベル（v1 用） |
| `pesticide-read-service.ts` | 農薬・病害虫・有効成分（v1 用） |
| `legal-service.ts` | `listLegalDocuments` / 法的文章取得（v1 用） |

#### デバイス・Push 通知系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `device-service.ts` | `registerDevice` / `removeDevice` — Expo Push Token の登録・解除（v1 用） |
| `device-tracking.ts` | デバイスフィンガープリントの追跡・ブラックリスト照合 |

#### 課金・RevenueCat 系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `revenuecat.ts` | `processRevenueCatEvent(event)` — RevenueCat webhook イベント処理（INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION）。`revenueCatPayloadSchema` — ペイロード Zod 検証スキーマ |

#### アナリティクス系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `analytics-recording.ts` | `recordPostViewService` / `recordProfileViewService` / `recordLikeReceivedService` / `recordNewFollowerService` — UserAnalytics 累積カウンタ更新（`/api/analytics/view` から呼ばれる） |
| `analytics-service.ts` | アナリティクスデータ取得・集計 |
| `analytics-read-service.ts` | v1 向け分析サマリ取得 |

#### インフラ・共通系

| ファイル | 主要エクスポート / 用途 |
|---------|----------------------|
| `webhook-idempotency.ts` | `ensureWebhookEventOnce(provider, eventId)` — UNIQUE INSERT による冪等性ロック。`deleteWebhookEvent` — ロック解放。重複は `{ alreadyProcessed: true }` を返す |
| `media-cleanup.ts` | R2 から未使用メディアを削除（管理 cron 用） |
| `media-url-validator.ts` | `assertMediaUrlsFromOwnStorage` — アップロード済み URL が自プロジェクトの R2 を指すことを検証（SSRF 防止） |
| `security-events.ts` | `logSecurityEvent` — セキュリティイベント記録（ログイン失敗・パスワード変更・2FA 切替等） |
| `segment-evaluation.ts` | `evaluateSegment` — ユーザーセグメントの対象者算出 |
| `usage.ts` | Vercel / Supabase / R2 / Resend の利用量集計 |
| `weather-service.ts` | Open-Meteo API 連携・天気キャッシュ・盆栽管理アドバイス生成 |

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
| `updatePost(postId, formData)` | 投稿編集（本人のみ） |
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
| `updateComment(commentId, content)` | コメント編集（本人のみ） |
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

**`NotificationType`** (`types/notification.ts` の `VALID_NOTIFICATION_TYPES`、Prisma enum と同期): `'like'` | `'comment'` | `'follow'` | `'quote'` | `'reply'` | `'comment_like'` | `'follow_request'` | `'follow_request_approved'` | `'mention'` | `'message'` | `'repost'` | `'system'` | `'subscription_expiring'`

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
| `getBonsais()` | 盆栽一覧取得（自分の盆栽） |
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

公開処理は Server Action ではなく `lib/services/scheduled-post-publisher.ts` の `publishDueScheduledPosts()` に一本化。`/api/cron/publish-scheduled`（GitHub Actions cron が 5 分毎に起動）からのみ呼ばれる。

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
| `createReport(params)` | Session | 通報作成（投稿・コメント・ユーザー対象。`report-user.ts` 実装） |
| `getReports(options?)` | Admin | 通報一覧取得（ステータス・対象種別フィルタ。`report-admin.ts` 実装） |
| `updateReportStatus(reportId, status, note?)` | Admin | 通報ステータス更新 |
| `deleteReportedContent(targetType, targetId)` | Admin | 通報対象コンテンツ削除 |
| `deleteReport(reportId)` | Admin | 通報削除 |
| `getReportStats()` | Admin | 通報統計 |

通報機能は `report.ts` バレルが `report-user.ts`（一般ユーザー向け作成）/ `report-admin.ts`（管理者向け管理）を再エクスポートする構成。

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

### オンボーディング (`lib/actions/onboarding.ts`)

**Session 認証必須**（非ゲスト）。

| 関数 | 説明 |
|------|------|
| `completeOnboarding()` | オンボーディング完了記録（`User.onboardedAt` を更新、冪等） |

---

### 固定投稿 (`lib/actions/pin-post.ts`)

**Session 認証必須**（非ゲスト）。ユーザーは自分の投稿を 1 件だけプロフィール先頭に固定できる（`User.pinnedPostId`）。`engagement` レート制限を適用。

| 関数 | 説明 |
|------|------|
| `pinPost(postId)` | 自分の投稿をプロフィールに固定（既存の固定を置き換え） |
| `unpinPost()` | プロフィールの固定を解除 |

---

### セキュリティ活動 (`lib/actions/security-activity.ts`)

**Session 認証必須**。戻り値は `ActionResult` ではなく `{ events: SecurityActivityEvent[] }`（読み取り例外、未認証時は空配列）。

| 関数 | 説明 |
|------|------|
| `getMySecurityEvents()` | 自分の直近セキュリティイベント（ログイン失敗・パスワード変更・2FA 切替・メール変更）を新しい順で取得 |

---

## 管理者 Server Actions

### 管理者共通 (`lib/actions/admin.ts`)

**`'use server'` を持たない `'server-only'` モジュール**（admin Server Component から直接 await する認可ヘルパー。`isAdmin` を公開 RPC にしないため Server Action 化していない）。戻り値はドメイン値を直接返す。

| 関数 | 説明 |
|------|------|
| `isAdmin()` | 管理者判定（`boolean`） |
| `getAdminInfo()` | 管理者情報取得（`{ userId, role }` または `null`） |

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
| publish_draft | 10回 | 1分 |
| delete_draft | 10回 | 1分 |
| create_report | 5回 | 1分 |
| create_bonsai | 3回 | 1分 |
| update_bonsai | 5回 | 1分 |
| delete_bonsai | 5回 | 1分 |
| create_bonsai_record | 5回 | 1分 |
| care_log_write | 10回 | 1分 |
| delete_care_log | 10回 | 1分 |
| send_message | 20回 | 1分 |
| toggle_like | 30回 | 1分 |
| create_shop_change_request | 3回 | 1分 |
| delete_shop | 5回 | 1分 |
| delete_event | 5回 | 1分 |
| delete_review | 5回 | 1分 |
| delete_comment | 10回 | 1分 |
| update_comment | 15回 | 1分 |
| delete_post | 5回 | 1分 |
| block_user / unblock_user | 10回 | 1分 |
| mute_user / unmute_user | 10回 | 1分 |
| two_factor_setup | 10回 | 15分 |
| admin_bulk | 5回 | 1分 |
| stripe_billing | 5回 | 1分 |

#### 読み取り系

| アクション | 制限 | ウィンドウ | 備考 |
|-----------|------|----------|------|
| api | 60回 | 1分 | IPベース |
| search | 20回 | 1分 | IPベース |
| mention_search | 30回 | 1分 | @入力サジェスト（debounce 前提） |
| engagement | 30回 | 1分 | |
| timeline | 30回 | 1分 | |
| get_timeline | 30回 | 1分 | |
| get_recommended | 20回 | 1分 | |
| read | 60回 | 1分 | |
| care_log_read | 60回 | 1分 | カレンダー手入れログ取得 |

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
| `requireBearerUser(request, options?)` | v1 API: JWT Bearer 検証（`lib/api/v1/auth-guard.ts`）。`options.rejectGuest=true` でゲスト拒否 |
| `verifyCronAuth()` | HMAC-SHA256署名（cronジョブ用） |
| Bearer トークン | タイミングセーフ比較（シードエンドポイント用） |
