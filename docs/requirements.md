# BON-LOG 要件定義書

## 1. プロジェクト概要

### 1.1 プロジェクト情報

| 項目 | 内容 |
|------|------|
| プロジェクト名 | BON-LOG（ボンログ） |
| 概要 | 盆栽愛好家向けのソーシャルネットワークサービス |
| 本番URL | https://www.bon-log.com |
| リポジトリ | GitHub (プライベート) |

### 1.2 目的

盆栽愛好家向けのSNSプラットフォームを構築し、以下を実現する：
- 盆栽に関する画像・動画投稿と情報共有
- 盆栽園マップによる店舗情報の共有
- イベント情報の掲載と共有
- 盆栽の成長記録管理
- 農薬・病害虫データベースの提供
- 肥料ガイド・植物ホルモンガイド・盆栽用語辞典の提供

### 1.3 ターゲットユーザー

| ユーザー層 | 主な利用目的 |
|-----------|-------------|
| 盆栽愛好家 | 日々の管理記録、作品共有、情報交換 |
| 盆栽初心者 | 育成方法の学習、コミュニティ参加 |
| 盆栽園経営者 | 店舗情報掲載、集客、イベント告知 |
| イベント主催者 | 展示会・イベント情報の告知 |

### 1.4 ビジネスモデル

| 収益源 | 状態 | 内容 |
|--------|------|------|
| プレミアム会員 | 実装済み | 月額350円 / 年額3,500円 |
| 広告掲載 | 実装済み | Google AdSense / 忍者AdMax |

---

## 2. 技術スタック

### 2.1 フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Next.js | 16.x (App Router) | フレームワーク |
| React | 19.x | UIライブラリ |
| TypeScript | 5.x (strict mode) | 型安全な開発 |
| Tailwind CSS | 4 | スタイリング |
| shadcn/ui (Radix UI) | - | UIコンポーネント |
| React Query | 5.x | サーバー状態管理 |
| Recharts | 3.x | グラフ・チャート |
| Leaflet | 1.x | 地図表示 |
| react-leaflet | 5.x | React用Leafletラッパー |

### 2.2 バックエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Next.js Server Actions | - | API実装（85ファイル: 64ルート + 20管理者 + 1 schemas）。`'use server'` を持たず `'server-only'` のみで運用するモジュール 13 本（`dictionary.ts` / `fertilizer.ts` / `hormone.ts` / `pesticide.ts` / `search-meta.ts` の RSC データ取得 + `filter-helper.ts` / `post-include.ts` / `post-validation.ts` / `shared-includes.ts` / `prisma-filters.ts` / `pagination.ts` / `utils.ts` の内部 helper、および barrel re-export の `user.ts`）はこの数に含む |
| NextAuth.js v5 | 5.0.0-beta.31 | 認証（JWT戦略） |
| Google OAuth 2.0 | - | ソーシャルログイン |
| Prisma | 6.19.2 | ORM（`@prisma/adapter-pg` + `pg` ^8.16 ドライバアダプタ経由） |
| Zod | 4.x | バリデーション |
| Stripe | 20.x | 決済処理 |
| Resend | 6.x | メール送信 |
| @sentry/nextjs | 10.x | エラー監視 |
| Upstash Redis | 1.x | キャッシュ・レート制限 |
| web-push | 3.x | プッシュ通知 |
| Sharp | 0.34.x | 画像処理（リサイズ・WebP変換） |
| otplib | 13.x | TOTP（2段階認証） |
| FingerprintJS | 5.x | デバイス識別 |

### 2.3 テスト

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Vitest | 4.0.18 | ユニットテスト |
| @vitest/coverage-istanbul | 4.0.18 | カバレッジ計測（`vi.mock()` 多用環境での集計精度のため v8 から移行） |
| Playwright | 1.57.0 | E2Eテスト |
| React Testing Library | - | コンポーネントテスト |

### 2.4 インフラストラクチャ

ホスティングは **fly.io**（コンピュートのみ）。DB / ストレージ / キャッシュ / メール / 決済 / 監視は外部マネージドサービスを継続利用する。

| サービス | 用途 | プラン |
|---------|------|--------|
| fly.io | ホスティング・デプロイ（app `bon-log` / region `nrt` 東京 / shared-cpu-1x / 1GB / 常時 1 台稼働） | 従量課金 |
| Supabase | PostgreSQLデータベース | Free〜Pro |
| Upstash | Redis（キャッシュ・レート制限） | Free |
| Cloudflare R2 | 画像・動画ストレージ | 従量課金 |
| Resend | メール送信 | Free (100通/日) |
| Stripe | 決済処理 | 従量課金 |
| Sentry | エラー監視 | Free (5,000エラー/月) |

#### デプロイ・スケジュール実行

- **デプロイ**: GitHub Actions (`fly-deploy.yml`) で `master` push 時に `flyctl deploy --local-only` を実行（amd64 ランナー上でローカル Docker ビルド）。秘匿値は `fly secrets set` / `fly secrets import`、`NEXT_PUBLIC_*` は `fly.toml` の `[build.args]` でビルド時 inline。
- **Cron**: fly.io に組込 cron がないため GitHub Actions (`cron.yml`) の schedule で各 cron エンドポイントを Bearer `CRON_SECRET` で叩く。
  - `publish-scheduled`: 5 分毎（予約投稿の公開）
  - `update-weather`: 毎時（天気更新）
  - `check-subscriptions`: 毎日 01:00 UTC（サブスク確認）
  - `cleanup-events`: 毎月 1 日 00:00 UTC（終了イベント整理）
- **マイグレーション**: runner イメージは standalone 最小構成で prisma CLI を含まないため release_command にせず、ローカルから `prisma migrate deploy`（`DIRECT_URL` 使用）で適用する。

### 2.5 外部サービス連携（20+）

| サービス | 用途 |
|---------|------|
| Supabase | PostgreSQLデータベース（接続プーリング） |
| NextAuth.js v5 | 認証・セッション管理 |
| Google OAuth 2.0 | ソーシャルログイン |
| Cloudflare R2 | S3互換オブジェクトストレージ |
| Upstash Redis | サーバーレスRedis（キャッシュ・レート制限） |
| Resend | トランザクショナルメール |
| Stripe | サブスクリプション決済 |
| Sentry | エラー監視・パフォーマンス追跡 |
| Leaflet / OpenStreetMap | 地図表示 |
| Open-Meteo API | 天気データ取得 |
| Nominatim | ジオコーディング（住所→緯度経度） |
| 国土地理院 住所検索API | 住所オートコンプリート |
| FingerprintJS | デバイスフィンガープリント |
| Web Push API | ブラウザプッシュ通知 |
| Ninja AdMax | 広告配信 |
| Google AdSense | 広告配信 |
| fly.io | ホスティング（Docker / standalone デプロイ） |
| GitHub Actions | CI/CDパイプライン・デプロイ・cron スケジューラ |
| Lighthouse CI | パフォーマンス監査 |
| CodeQL | セキュリティ静的解析 |
| Sharp | サーバーサイド画像処理 |

### 2.6 サービス選定理由

| サービス | 選定理由 |
|---------|---------|
| fly.io | Docker そのままデプロイ可能、東京リージョン（nrt）で低レイテンシ、コンピュート従量課金、ベンダーロックインが薄い |
| Supabase | PostgreSQL + 接続プーリング、マネージドサービス |
| Upstash | サーバーレスRedis、REST API対応、Edge から利用可能 |
| Cloudflare R2 | S3互換API、エグレス料金無料、低コスト |
| Resend | シンプルなAPI、高い配信率、無料枠あり |
| Sentry | Next.js公式対応、詳細なエラートラッキング |

---

## 3. 機能仕様

### 3.1 認証機能

#### 3.1.1 ユーザー登録
- メールアドレス + パスワードによる登録
- メールアドレス確認（オプション）: 登録後に確認メール送信、`/verify-email?token=xxx` で検証完了までログイン不可とするフローを実装可能（`/register/verify-email-sent` で送信完了表示）
- パスワード要件:
  - 8文字以上
  - アルファベット（a-z, A-Z）を1文字以上含む
  - 数字（0-9）を1文字以上含む
- パスワードはbcryptでハッシュ化（ソルトラウンド12、実装は lib/constants/limits.ts の BCRYPT_SALT_ROUNDS を参照）
- メールアドレスブラックリストチェック
- デバイスフィンガープリントブラックリストチェック
- ゲストログイン対応（機能制限あり）

#### 3.1.2 ログイン
- メールアドレス + パスワード認証
- Google OAuthによるソーシャルログイン
- ゲストログイン（閲覧中心、一部機能制限）
- NextAuth.js (Auth.js v5) によるセッション管理
- JWT戦略によるセッショントークン
- ログイン履歴の記録（IPアドレス、ユーザーエージェント、成功/失敗）
- デバイスフィンガープリントブラックリストチェック
- 2段階認証（TOTP）対応（有効化している場合）

#### 3.1.3 セキュリティ対策
- ブルートフォース攻撃対策（Upstash Redisによるレート制限）
  - 5回連続失敗で15分間ロック
  - 失敗回数をRedisで追跡
- パスワードリセット
  - SHA-256ハッシュ化トークン
  - 1時間の有効期限
  - メールによるリセットリンク送信
  - IPベースのレート制限（1時間に3回まで）

#### 3.1.4 2段階認証（TOTP）
- Google Authenticator等のTOTPアプリ対応
- QRコードによるセットアップ
- 6桁の認証コード（30秒ごとに更新）
- バックアップコード（8桁 x 10個）
  - SHA-256ハッシュ化して保存
  - 使用済みコードは無効化
- TOTPシークレットはAES-256-GCMで暗号化して保存
- **暗号鍵バージョニング対応**（無停止ローテーション）:
  - 暗号文は `v{N}:base64` 形式（例: `v1:abc...`）でバージョン情報を保持
  - `TWO_FACTOR_ENCRYPTION_KEY_v1`, `_v2` ... をバージョン別に環境変数として保持
  - 現行バージョンは `TWO_FACTOR_KEY_VERSION` で切替（既定 v1）
  - `migrateToCurrentKeyVersion()` で旧鍵暗号文を現行鍵で再暗号化
- 設定ページ: `/settings/security`

#### 3.1.5 ブラックリスト機能
- **メールアドレスブラックリスト**
  - 登録禁止メールアドレスの管理
  - 管理者が追加/削除可能
  - 理由の記録

- **デバイスフィンガープリントブラックリスト**
  - FingerprintJSによるデバイス識別
  - 不正利用デバイスのブロック
  - 関連メールアドレスの記録
  - 登録時・ログイン時にチェック

#### 3.1.6 ソーシャルログイン（Google OAuth）
- Google OAuth 2.0プロバイダー対応
- 既存メール/パスワードアカウントとの自動リンク（allowDangerousEmailAccountLinking）
- 初回ログイン時にGoogleプロフィール名をnicknameに自動設定
- OAuth経由のユーザーはメール確認済み扱い
- 環境変数: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### 3.2 投稿機能

#### 3.2.1 投稿種別

| 種別 | 説明 |
|------|------|
| 通常投稿 | テキスト + メディア（画像/動画） |
| 引用投稿 | 他の投稿を引用してコメント追加 |
| リポスト | 他の投稿をそのまま共有 |

#### 3.2.2 投稿制限

| 項目 | 無料会員 | プレミアム会員 |
|------|---------|---------------|
| 文字数 | 500文字 | 2,000文字 |
| 画像 | 4枚まで | 6枚まで |
| 動画 | 1本まで | 3本まで |
| 1日の投稿数 | 20件 | 40件 |

#### 3.2.3 メディア仕様

**画像:**
| 項目 | 仕様 |
|------|------|
| 対応形式 | JPEG, PNG, GIF, WebP |
| 最大サイズ | 4MB |
| 保存先 | Cloudflare R2 |
| セキュリティ | ファイルシグネチャ検証、UUIDファイル名 |

**動画:**
| 項目 | 仕様 |
|------|------|
| 対応形式 | MP4, WebM, MOV |
| 最大サイズ | 256MB |
| 保存先 | Cloudflare R2 |

#### 3.2.4 ジャンル

投稿には最大3つのジャンルを設定可能。

**松柏類（18種）:**
黒松、赤松、五葉松、真柏、杜松、檜、椹、檜葉/翌檜、杉、一位、キャラボク、蝦夷松、落葉松、米栂、樅木、榧、槙、その他松柏類

**雑木類（38種）:**
紅葉、楓、匂楓、銀杏、欅、楡欅、梅、長寿梅/木瓜、梅擬、蔓梅擬/岩梅蔓、縮緬蔓、金豆、ピラカンサ、花梨、台湾黄楊、イボタ、群雀、香丁木/白丁木、真弓、小真弓、ブナ、梔子、グミ、桜、皐月、椿、山茶花、柿、柘榴、百日紅、姫林檎/海棠、柊、針蔓柾、蔦、イヌビワ、紫式部、レンギョウ、その他雑木類

**その他:**
- 草もの（山野草、苔）
- 用品・道具（道具、薬剤・肥料、鉢、用土、その他）
- 施設・イベント（盆栽園、展示会/イベント）
- その他（管理方法、その他）

#### 3.2.5 その他の投稿機能

| 機能 | 説明 |
|------|------|
| ハッシュタグ | #から始まるタグを自動抽出・リンク化 |
| メンション | @ユーザー名で通知送信 |
| 下書き保存 | 投稿前に一時保存 |
| 予約投稿 | 指定日時に自動投稿（プレミアム限定） |
| 投票（アンケート） | 選択肢付き投票を投稿に添付 |

### 3.3 タイムライン

#### 3.3.1 表示内容
- 自分の投稿
- フォローしているユーザーの投稿
- ブロック/ミュートしたユーザーは除外

#### 3.3.2 ページネーション
- カーソルベースの無限スクロール
- 1回のロードで20件取得

### 3.4 ソーシャル機能

#### 3.4.1 いいね
- 投稿へのいいね
- コメントへのいいね
- いいね通知の送信

#### 3.4.2 コメント
- 投稿へのコメント
- コメントへのリプライ（スレッド形式）
- コメントへのメディア添付
- コメントのソフトデリート
- コメントスレッドミュート
- メンション通知
- 1ユーザーあたり1日100件まで（`DAILY_COMMENT_LIMIT`、投稿単位の上限ではない）
- メディア添付: 画像最大2枚 + 動画最大1本（合計最大3点。`MAX_COMMENT_IMAGES` / `MAX_COMMENT_VIDEOS` / `MAX_COMMENT_MEDIA`）
- 最大文字数500文字（`MAX_COMMENT_LENGTH`）

#### 3.4.3 ブックマーク
- 投稿のブックマーク保存
- ブックマーク一覧ページ

#### 3.4.4 フォロー
- ユーザーのフォロー/アンフォロー
- フォロワー/フォロー中リスト
- フォローリクエスト機能（非公開アカウント用）
  - 承認/拒否の管理
  - リクエスト一覧ページ

#### 3.4.5 ブロック・ミュート

| 機能 | 効果 |
|------|------|
| ブロック | 相手の投稿が非表示、相手からも見えなくなる |
| ミュート | 相手の投稿がタイムラインに表示されない（フォロー維持） |

### 3.5 通知機能

#### 3.5.1 通知種別

| 種別 | トリガー |
|------|---------|
| like | 投稿にいいねされた |
| comment | 投稿にコメントされた |
| reply | コメントにリプライされた |
| follow | フォローされた |
| follow_request | フォローリクエストを受けた |
| follow_request_approved | フォローリクエストが承認された |
| quote | 投稿が引用された |
| comment_like | コメントにいいねされた |
| mention | @メンションされた |
| repost | 投稿がリポストされた |
| subscription_expiring | サブスクリプションの期限が近づいている |
| system | システム通知 |
| warning | 管理者からの警告 |
| poll_ended | 投票が終了した |
| announcement | 運営からのお知らせ |

#### 3.5.2 通知配信チャネル
- **アプリ内通知**: 一覧表示、既読/未読管理、個別削除
- **Web Push通知**: ブラウザプッシュ通知（PushSubscriptionモデル）
- **メール通知**: Resend経由

#### 3.5.3 通知設定
- 通知種別ごとのオン/オフ設定（notification_preferences）
- 設定ページ: `/settings/notifications`

### 3.6 ダイレクトメッセージ

#### 3.6.1 機能
- 1対1のメッセージ送受信
- 会話スレッド管理
- 既読/未読管理
- 日次送信制限
- ブロック連動（ブロック時はメッセージ送信不可）

### 3.7 検索機能

#### 3.7.1 検索対象

| 対象 | 検索項目 |
|------|---------|
| 投稿 | 本文テキスト |
| ユーザー | ニックネーム |
| ハッシュタグ | タグ名 |

#### 3.7.2 検索仕様
- 複数ワードでのAND検索
- ハッシュタグ検索（#付き）
- ジャンルでのフィルタリング
- 全文検索（FTS: LIKE / pg_trgm / pg_bigm対応）
- グローバル検索

### 3.8 盆栽園マップ

#### 3.8.1 盆栽園情報

| 項目 | 必須 | 説明 |
|------|------|------|
| 店名 | ○ | 盆栽園名 |
| 住所 | ○ | 都道府県〜番地 |
| 緯度・経度 | 自動 | 住所から自動取得 |
| 電話番号 | - | 連絡先 |
| ウェブサイト | - | URL |
| 営業時間 | - | テキスト形式 |
| 定休日 | - | テキスト形式 |
| ジャンル | - | 複数選択可 |

#### 3.8.2 盆栽園ジャンル
- サイズ: ミニ盆栽、小品盆栽、貴風盆栽、大品盆栽
- 用品: 道具、鉢、展示用具、肥料・用土・薬剤、書籍

#### 3.8.3 地図機能
- Leaflet + OpenStreetMap による地図表示
- マーカークリックで詳細表示
- 現在地からの距離表示

#### 3.8.4 ジオコーディング
- 国土地理院 住所検索APIを使用
- 住所入力時のオートコンプリート
- 住所から緯度経度を自動取得

#### 3.8.5 レビュー機能
- 星評価（1〜5段階）
- テキストコメント（任意）
- 画像添付（最大3枚）

#### 3.8.6 変更リクエスト
- ユーザーから盆栽園情報の修正をリクエスト可能
- 管理者が承認/却下

### 3.9 イベント機能

#### 3.9.1 イベント情報

| 項目 | 必須 | 説明 |
|------|------|------|
| タイトル | ○ | イベント名 |
| 説明 | - | 詳細説明 |
| 開始日 | ○ | 開催開始日 |
| 終了日 | - | 開催終了日 |
| 都道府県 | ○ | 開催地域 |
| 市区町村 | - | 開催市区町村 |
| 会場名 | - | 会場名称 |
| 主催者 | - | 主催者名 |
| 入場料 | - | 料金情報 |
| 販売有無 | - | 物販の有無 |
| 外部URL | - | 詳細ページURL |

#### 3.9.2 地域フィルター

**8つの地方ブロック:**
- 北海道
- 東北（青森、岩手、宮城、秋田、山形、福島）
- 関東（茨城、栃木、群馬、埼玉、千葉、東京、神奈川）
- 中部（新潟、富山、石川、福井、山梨、長野、岐阜、静岡、愛知）
- 近畿（三重、滋賀、京都、大阪、兵庫、奈良、和歌山）
- 中国（鳥取、島根、岡山、広島、山口）
- 四国（徳島、香川、愛媛、高知）
- 九州・沖縄（福岡、佐賀、長崎、熊本、大分、宮崎、鹿児島、沖縄）

#### 3.9.3 表示仕様
- カレンダー形式での表示
- 終了したイベントは自動的に非表示
- 日付範囲でのフィルタリング
- 月別・地域フィルタ
- 終了後6ヶ月で自動クリーンアップ（cronジョブ）

### 3.10 盆栽用語辞典

#### 3.10.1 概要
- 盆栽に関する用語を解説する辞典機能
- ログインユーザーが閲覧可能

#### 3.10.2 機能
- 用語一覧ページ（`/dictionary`）
- 用語詳細ページ（`/dictionary/[slug]`）
- キーワード検索（`DictionarySearch` コンポーネント）
- カテゴリ別分類
- DBモデル: `BonsaiTerm`（slug, name, reading, description, category）

### 3.11 盆栽成長記録

#### 3.11.1 盆栽情報

| 項目 | 説明 |
|------|------|
| 盆栽名 | 識別用の名前 |
| 樹種 | 種類 |
| 取得日 | 入手日 |
| 説明 | 詳細メモ |

#### 3.11.2 成長記録
- テキスト + 画像（最大4枚、`MAX_BONSAI_RECORD_IMAGES`）
- 記録日時の保存
- 時系列での一覧表示（タイムライン）
- フォトギャラリー表示

#### 3.11.3 盆栽手入れログ（カレンダービュー）
- カレンダービュー専用の構造化メモ機能
- 種別: `watering`（水やり）/ `fertilizing`（施肥）/ `pruning`（剪定）/ `wiring`（針金掛け）/ `repotting`（植替え）/ その他（`BonsaiCareType` enum）
- 記録項目: 種別・実施日時・任意のメモ（最大文字数は `MAX_BONSAI_CARE_NOTE_LENGTH`）
- 個別の盆栽 ID には紐付けず、ユーザー全体のログとして扱う（タイムラインや盆栽詳細には漏出しない）
- 期間指定で取得（`MAX_CARE_LOG_RANGE_DAYS` を上限に）
- DBモデル: `BonsaiCareLog`（マイグレーション `20260426000000_add_bonsai_care_log`）

### 3.12 農薬・病害虫機能（ログインユーザー向け）

#### 3.12.1 概要
- ログインユーザー（ゲスト除く）が利用可能。ゲストはオーバーレイで制限。
- 薬剤（農薬）と病害虫の情報検索・閲覧。農水省登録情報の参考表示。

#### 3.12.2 データ規模
- 有効成分（原体）: 105種
- 農薬製品: 154製品（展着剤16種含む）
- 病害虫: 229種
- 効果紐付け: 1,437件
- 混用不可: 134ペア（双方向登録で67組）

#### 3.12.3 薬剤（Pesticide）
- 薬剤タイプ: 殺菌剤（fungicide）、殺虫剤（insecticide）、殺ダニ剤（acaricide）、その他（other）
- 薬剤名・登録番号での検索、タイプ絞り、病害虫から「効く薬剤」を検索、剤型コード（formulationTypeCode）での絞り込み
- 製品詳細: 剤型、成分（原体）、病害虫への効果（予防/治療/効果/持続の評価表示）。効果のある病害虫は病害虫図鑑（/pesticides/diseases-pests/[slug]）へのリンク
- 農水省の詳細ページへのリンク（登録番号からURL生成）
- 農薬トップ（/pesticides）で薬剤・展着剤の検索・一覧を表示。展着剤は type=spreader または /pesticides/spreaders で表示

#### 3.12.4 病害虫（DiseasePest）
- 病害（disease）・害虫（pest）の図鑑
- 各病害虫に対して効く薬剤一覧を表示

#### 3.12.5 その他
- 原体（ActiveIngredient）一覧・詳細（FRAC/IRACコード等）
- 剤型（FormulationType）一覧。剤型クリックで該当剤型の薬剤一覧（/pesticides/formulations?formulation=CODE）
- 展着剤（SpreaderType）一覧。型クリックで該当型の展着剤一覧を表示。製品リンクは **/pesticides/products/[slug]** へ直接遷移。展着剤詳細（/pesticides/spreaders/[slug]）は、製品の slug の場合は /pesticides/products/[slug] へリダイレクト、型の slug の場合は型の説明・効果・利用時の注意を表示
- コラム（PesticideColumn）一覧・詳細（カテゴリ別）
- 混用不可データ（PesticideIncompatibility）: 石灰硫黄合剤xマシン油、石灰硫黄合剤x銅系殺菌剤、マシン油x銅剤等134ペア（双方向登録で67組）

#### 3.12.6 農薬データバリデーション
- `prisma/validation/` にCSVエクスポート + 26項目自動バリデーション
- MAFF農薬登録情報提供システムとの機械的突合（maff-reference.csv: 61製品検証済み）
- FRAC/IRACコードの公式分類との照合
- 効果データの論理整合性チェック（殺菌剤→害虫誤紐付け検出等）

### 3.13 肥料ガイド機能

#### 3.13.1 概要
- 盆栽の施肥に関する栄養素辞典・樹種別施肥カレンダー・コラム機能
- ログインユーザーが利用可能
- データ: 16栄養素、5樹種×12月の施肥スケジュール、13コラム

#### 3.13.2 機能
- 栄養素一覧（三大要素・二次要素・微量要素のカテゴリ分類）
- 栄養素詳細（役割、過不足の症状、盆栽における役割）
- 肥料カテゴリ比較（有機肥料・化成肥料・液体肥料等の特徴比較）
- 樹種別施肥スケジュール（月別の施肥カレンダー）
- 肥料コラム（施肥のコツ等の記事）

#### 3.13.3 ページ構成
| パス | 説明 |
|------|------|
| `/fertilizers` | 施肥ガイドトップ |
| `/fertilizers/nutrients` | 栄養素一覧 |
| `/fertilizers/nutrients/[slug]` | 栄養素詳細 |
| `/fertilizers/categories` | 肥料カテゴリ比較 |
| `/fertilizers/schedules` | 樹種別施肥スケジュール |
| `/fertilizers/schedules/[slug]` | 樹種別スケジュール詳細 |
| `/fertilizers/columns` | コラム一覧 |
| `/fertilizers/columns/[slug]` | コラム詳細 |

### 3.14 植物ホルモンガイド機能

#### 3.14.1 概要
- 盆栽に関連する植物ホルモンの解説機能
- ホルモンの種類・効果・季節変動・相互作用の情報を提供
- ログインユーザーが利用可能

#### 3.14.2 データモデル
- HormoneType: ホルモン種別（名称、説明、カテゴリ等）
- HormoneEffect: ホルモンの効果（isPromotingフラグ含む）
- HormoneSeasonalLevel: 季節別のホルモンレベル変動（関東地方・落葉広葉樹基準）
- HormoneInteraction: ホルモン間の相互作用（synergistic/antagonistic/modulatory）
- HormoneTechnique: 盆栽技法×ホルモン効果マッピング（effectType/magnitude/出典）
- HormoneColumn: ホルモン関連コラム記事

#### 3.14.3 ページ構成
| パス | 説明 |
|------|------|
| `/hormones` | 植物ホルモンガイドトップ |
| `/hormones/[slug]` | ホルモン詳細（効果・季節レベル・技法影響） |
| `/hormones/techniques` | 盆栽技法×ホルモンマッピング（9技法: 摘芯・剪定・針金掛け・植替え・葉刈り・取り木・挿し木・水やり管理・日照管理） |
| `/hormones/diagram` | ホルモン相互作用ダイアグラム（ノードグラフ表示） |
| `/hormones/calendar` | 年間ホルモン活性カレンダー（月別変動チャート） |
| `/hormones/simulator` | ホルモンバランスシミュレーター（技法選択で変動を可視化） |
| `/hormones/interactions` | ホルモン相互作用一覧 |
| `/hormones/columns` | コラム一覧 |
| `/hormones/columns/[slug]` | コラム詳細 |

### 3.15 プレミアム会員機能

#### 3.15.1 料金プラン

| プラン | 価格（税込） | 特典 |
|--------|-------------|------|
| 月額プラン | 350円/月 | 下記特典すべて |
| 年額プラン | 3,500円/年 | 2ヶ月分お得 |

#### 3.15.2 プレミアム特典

| 特典 | 説明 |
|------|------|
| 投稿文字数 | 最大2,000文字（通常500文字） |
| 画像添付 | 最大6枚（通常4枚） |
| 動画添付 | 最大3本（通常1本） |
| 予約投稿 | 指定日時の自動投稿 |
| アナリティクス | プロフィール閲覧数、投稿閲覧数、いいね数、フォロワー推移 |

#### 3.15.3 決済
- Stripe Checkoutによる決済
- クレジットカード対応
- 自動更新（サブスクリプション）
- カスタマーポータルでの管理
- Webhookによる決済イベント処理
- **Webhook 冪等性ガード**（`webhook_events` テーブル + `ensureWebhookEventOnce()`）
  により Stripe のリトライによる重複処理（重複通知作成・残高重複加算）を防止

#### 3.15.4 プレミアムUI装飾
- プレミアム会員のプロフィールヘッダーにゴールドフレームをオーバーレイ表示
- 菊紋画像によるプレミアムバッジ（sm/md/lg 3サイズ、ライト/ダーク対応、ツールチップ付き）
- サブスクリプション設定ページに金箔背景パターン

### 3.16 アナリティクス

#### 3.16.1 ユーザー向け（プレミアム限定）
- プロフィール閲覧数
- 投稿閲覧数
- いいね数推移
- フォロワー推移

#### 3.16.2 管理者ダッシュボード
- 総ユーザー数 / 今日の新規ユーザー
- 総投稿数 / 今日の投稿数
- 未処理の通報数
- イベント総数 / 盆栽園総数
- 週間アクティブユーザー数
- 過去 30 日間の統計グラフ
- アクセス推移グラフ（直近 30 / 90 / 180 日切替対応、`daily_visitors` 由来）
- DAU（デイリーアクティブユーザー）
- コホート分析 / コンテンツ分析

### 3.17 通報・モデレーション

#### 3.17.1 通報理由

| 理由 | 説明 |
|------|------|
| spam | スパム |
| inappropriate | 不適切な内容 |
| harassment | 誹謗中傷 |
| copyright | 著作権侵害 |
| other | その他 |

#### 3.17.2 通報対象
- 投稿
- コメント
- イベント
- 盆栽園
- レビュー
- ユーザー

#### 3.17.3 自動モデレーション
- 同一コンテンツへの通報が10件を超えると自動非表示
- 自動非表示時は管理者に通知
- NGワードフィルタリング
- モデレーションキュー

### 3.18 管理者機能

#### 3.18.1 管理者ロール（5段階）

| ロール | 権限 |
|--------|------|
| super_admin | 全権限 |
| admin | ユーザー管理・コンテンツ管理 |
| moderator | コンテンツモデレーション |
| support | お問い合わせ対応 |
| viewer | 閲覧のみ |

#### 3.18.2 ユーザー管理
- ユーザー一覧（検索、フィルター、ソート）
- ユーザー詳細表示・アクティビティ
- ユーザー停止/復帰
- ユーザー完全削除
- ユーザー警告（warning）の発行

#### 3.18.3 コンテンツ管理
- 投稿管理（一覧、強制削除）
- イベント管理（一覧、削除、CSVインポート）
- 盆栽園管理（一覧、削除）
- 非表示コンテンツ管理（確認、復元）
- レビュー管理
- 農薬データ管理

#### 3.18.4 通報管理
- 通報一覧
- ステータス管理（保留/確認済み/解決/却下）
- コンテンツの非表示/削除

#### 3.18.5 モデレーション
- NGワード管理
- モデレーションキュー
- ユーザー警告
- ユーザーセグメント

#### 3.18.6 お知らせ・CMS
- お知らせ（announcements）管理
- CMSページ管理（バージョン管理付き）

#### 3.18.7 セキュリティ管理
- ブラックリスト管理（メール / デバイス）
- IP管理
- セキュリティイベント監視
- 管理者ログ

#### 3.18.8 メンテナンスモード
- メンテナンスモードの有効/無効切り替え
- 予約メンテナンス（開始日時・終了日時の設定）
- カスタムメンテナンスメッセージ
- 管理者はメンテナンス中もアクセス可能

#### 3.18.9 システム監視
- Sentry連携エラー監視
- システム利用統計
- バックアップ管理

#### 3.18.10 管理画面規模
- 管理者ページ: 35画面（28サブディレクトリ）

### 3.19 お問い合わせ機能

#### 3.19.1 お問い合わせフォーム
- ページ: `/contact`
- 入力項目: お名前、メールアドレス、カテゴリ、件名、お問い合わせ内容
- カテゴリ: 一般的なお問い合わせ、アカウントについて、不具合の報告、機能のリクエスト、プレミアム会員について、その他
- バリデーション: 必須チェック、メール形式、内容10文字以上2,000文字以下
- レート制限: 同一メールアドレスから1時間に3件まで

#### 3.19.2 管理者側
- お問い合わせ一覧: `/admin/contact`
- お問い合わせ詳細: `/admin/contact/[id]`
- ステータス管理: 未対応 → 対応中 → 解決済み
- 管理者メモ機能

### 3.20 天気アドバイス機能

#### 3.20.1 概要
- Open-Meteo API連携により、ユーザーの設定地域の天気に基づいた盆栽管理アドバイスを自動表示
- フィードページの右サイドバー（デスクトップ）に天気アドバイスカードを表示
- 3時間の非表示永続化（dismiss）

#### 3.20.2 地域設定
- 設定ページ（`/settings`）でユーザーの地域（都道府県・市区町村）を設定
- Nominatimジオコーディングにより住所から緯度経度を自動取得
- Userモデルに `weatherPrefecture`, `weatherCity`, `weatherLatitude`, `weatherLongitude` フィールドを保持

#### 3.20.3 天気データ取得
- Open-Meteo APIから天気データを取得（`lib/services/weather-service.ts`）
- 天気条件に基づいた盆栽管理アドバイスを生成
- Cronジョブ（`/api/cron/update-weather`）による定期更新

### 3.21 広告機能（Google AdSense / 忍者AdMax）

#### 3.21.1 実装状況
- Google AdSenseコード統合済み
- 忍者AdMax対応済み（`NEXT_PUBLIC_AD_PROVIDER` 環境変数で切り替え）
- 広告コンポーネント実装済み

#### 3.21.2 広告配置

| 配置場所 | コンポーネント | 説明 |
|---------|---------------|------|
| サイドバー | SidebarAd | 右サイドバー内の広告枠 |
| フィード内 | AdBanner | タイムライン内のインフィード広告 |
| 汎用 | GoogleAdSense | 任意の場所に配置可能 |

### 3.22 季節テーマ機能

#### 3.22.1 季節バナー
- 現在の月から四季を自動判定（春3-5月、夏6-8月、秋9-11月、冬12-2月）
- 季節ごとの水墨画バナーをフィードページ（モバイル）・右サイドバー（デスクトップ）に表示
- ライト/ダーク x デスクトップ/モバイル の4パターンを自動切替
- 下端フェードアウトで背景に自然に溶け込むデザイン

#### 3.22.2 背景アニメーション季節自動切替
- デフォルトは「季節自動」モード
- 月ごとのマッピング:
  - 3-4月: 桜の花びら（sakura）
  - 5月: 春の綿毛（dandelion）
  - 6月: 雨（rain-drops）
  - 7-9月: 水面の波紋（rain）
  - 10-11月: 秋の紅葉（momiji）
  - 12-2月: 冬の雪（snow）
- 設定画面で個別に選択した場合はその設定を優先
- localStorage に `bg-animation-type` として保存

#### 3.22.3 季節画像アセット
- `public/images/generated/seasons/season-{spring,summer,autumn,winter}{,-dark,-mobile,-dark-mobile}.webp`（計16枚）

### 3.23 OGP（Open Graph Protocol）

#### 3.23.1 動的OG画像生成
- エンドポイント: `/api/og`（Edge Runtime）
- 水墨画背景（`og-default.webp`）にテキストをオーバーレイ
- クエリパラメータ `?title=` でカスタムタイトル対応
- 画像サイズ: 1200x630px

#### 3.23.2 ページ別OGP
- ルートレイアウト: `/api/og` をデフォルトOG画像として設定
- 投稿詳細: 投稿の最初のメディア画像、なければ `/api/og`
- ユーザープロフィール: アバター画像、なければ `/api/og`
- 盆栽園・イベント・盆栽詳細: 同様のフォールバック

### 3.24 UI/UXアニメーション

#### 3.24.1 墨筆ストロークアニメーション（SumiStrokeReveal）
- ランディングページの「主な機能」「特徴」見出しに適用
- Intersection Observer連動で画面に入った瞬間にSVGの`stroke-dashoffset`アニメーション発火
- 筆が左→右に走る演出とコンテンツのフェードイン

#### 3.24.2 墨滴リップルボタン（InkRippleInit）
- `.btn-washi` クラスのボタンクリック時にクリック位置から墨の波紋が広がるマイクロインタラクション
- グローバルイベントデリゲーションで全btn-washiに自動適用
- ダークモードでは白い波紋に自動切替
- `globals.css` の `@keyframes ink-ripple-spread` で0.8秒アニメーション

#### 3.24.3 墨の滴る投稿送信エフェクト（InkDropOverlay）
- 投稿送信時に墨が上から円形に広がって画面を覆い、下に引いて消える全画面エフェクト
- `clip-path: circle()` のCSS transitionで実装
- PostFormModalに統合、モーダルが閉じた後もエフェクトが表示される

### 3.25 クライアントサイドロガー

- `lib/client-logger.ts` による環境別ログ管理
- 開発環境: console出力を維持
- 本番環境: console出力を抑制し、Sentryにエラーを送信
- Client Componentでは`console.error`の代わりに`clientLogger.error`を使用

### 3.26 SEO対策

#### 3.26.1 メタデータ
- 各ページに適切なtitle, description設定
- Open Graphタグ対応
- Twitterカード対応

#### 3.26.2 JSON-LD構造化データ（9種類）

| 種類 | 用途 |
|------|------|
| WebSite | サイト全体の情報 |
| Organization | 運営組織情報 |
| Person | ユーザープロフィール |
| Article | 投稿・コラム記事 |
| BreadcrumbList | パンくずリスト |
| Event | イベント情報 |
| LocalBusiness | 盆栽園情報 |
| DefinedTerm | 用語辞典 |
| FAQPage | ヘルプ・FAQ |

#### 3.26.3 サイトマップ
- 動的サイトマップ生成（`app/sitemap.ts`）
- 主要ページの自動収集
- 投稿、盆栽園、イベント、ユーザーの動的URL生成
- 並列化による高速生成

#### 3.26.4 RSSフィード
- XMLフォーマットによるRSSフィード生成（`/feed.xml`）
- 最新投稿の配信
- RSSリーダーからの購読対応

#### 3.26.5 robots.txt
- 検索エンジンクローラー制御（`public/robots.txt`）
- 管理画面、API、プライベートページの除外

### 3.27 PWA対応

#### 3.27.1 Service Worker
- キャッシュ戦略:
  - 静的アセット: Cache First（キャッシュ優先）
  - API/動的コンテンツ: Network First（ネットワーク優先）
  - 画像: Stale While Revalidate（キャッシュ即返し、バックグラウンド更新）
- オフラインページ表示（`/offline.html`）
- 更新通知とユーザー確認による適用

#### 3.27.2 Web App Manifest
- ホーム画面追加対応
- アプリショートカット（新規投稿、盆栽園マップ、イベント、検索）
- スタンドアロンモード表示
- アイコン（192px、512px、maskable）

#### 3.27.3 Web Push通知
- PushSubscriptionモデルによるサブスクリプション管理
- `/api/push/vapid-key` エンドポイント
- ブラウザプッシュ通知の送信

#### 3.27.4 インストールプロンプト
- PWAインストール促進UI

### 3.28 アクセシビリティ

- スキップリンク
- ARIA labels / aria-live
- キーボードショートカット
- フォーカス表示強化
- セマンティックHTML
- WCAG 2.1 AA 目標

---

## 4. データベース設計

### 4.1 概要

| 項目 | 数 |
|------|-----|
| モデル数 | 90 |
| Enum数 | 24 |
| ORM | Prisma 6.x |
| DB | PostgreSQL（Supabase） |

### 4.2 主要テーブル

#### ユーザー関連
| テーブル | 説明 |
|---------|------|
| users | ユーザー情報（2FAフィールド、天気設定含む） |
| accounts | OAuth連携（NextAuth.js用） |
| sessions | セッション（JWT使用時は補助的） |
| follows | フォロー関係 |
| follow_requests | フォローリクエスト |
| blocks | ブロック関係 |
| mutes | ミュート関係 |
| login_histories | ログイン履歴 |
| user_devices | ユーザーのデバイス情報 |
| notification_preferences | 通知設定 |
| push_subscriptions | Web Push購読情報 |

#### セキュリティ関連
| テーブル | 説明 |
|---------|------|
| email_blacklist | メールアドレスブラックリスト |
| device_blacklist | デバイスフィンガープリントブラックリスト |
| security_events | セキュリティイベント記録 |
| verification_tokens | メール確認トークン |
| password_reset_tokens | パスワードリセットトークン |
| email_verification_tokens | メールアドレス確認トークン |

#### 投稿関連
| テーブル | 説明 |
|---------|------|
| posts | 投稿 |
| post_media | 投稿メディア |
| post_genres | 投稿ジャンル |
| comments | コメント |
| comment_media | コメントメディア |
| likes | いいね |
| bookmarks | ブックマーク |
| hashtags | ハッシュタグ |
| post_hashtags | 投稿ハッシュタグ関連 |
| user_hidden_posts | ユーザーが非表示にした投稿 |
| comment_thread_mutes | コメントスレッドミュート |

#### 機能関連
| テーブル | 説明 |
|---------|------|
| genres | ジャンルマスタ |
| notifications | 通知 |
| draft_posts | 下書き |
| draft_post_media | 下書きメディア |
| draft_post_genres | 下書きジャンル |
| scheduled_posts | 予約投稿 |
| scheduled_post_media | 予約投稿メディア |
| scheduled_post_genres | 予約投稿ジャンル |

#### 投票
| テーブル | 説明 |
|---------|------|
| polls | 投稿アンケート |
| poll_options | アンケート選択肢 |
| poll_votes | アンケート投票（User Cascade Delete） |

#### 農薬・病害虫（10モデル）
| テーブル | 説明 |
|---------|------|
| disease_pests | 病害虫（病害/害虫） |
| pesticides | 薬剤（農薬） |
| pesticide_effects | 薬剤x病害虫の効果（予防/治療/効果/持続評価） |
| pesticide_active_ingredients | 薬剤x原体（成分） |
| active_ingredients | 原体（FRAC/IRACコード等） |
| formulation_types | 剤型マスタ |
| spreader_types | 展着剤タイプ |
| pesticide_spreader_types | 薬剤x展着剤（多対多） |
| pesticide_incompatibilities | 薬剤間の混用不可データ（134ペア = 双方向登録で67組） |
| pesticide_columns | 農薬コラム（カテゴリ別） |

#### 肥料ガイド（5モデル）
| テーブル | 説明 |
|---------|------|
| fertilizer_nutrients | 肥料栄養素 |
| fertilizer_categories | 肥料カテゴリ |
| tree_species | 樹種 |
| fertilization_plans | 施肥計画 |
| fertilizer_columns | 肥料コラム |

#### 植物ホルモン（6モデル）
| テーブル | 説明 |
|---------|------|
| hormone_types | ホルモン種別 |
| hormone_effects | ホルモン効果 |
| hormone_seasonal_levels | 季節別ホルモンレベル |
| hormone_interactions | ホルモン間相互作用 |
| hormone_techniques | 盆栽技法×ホルモン効果マッピング（effectType/magnitude/出典） |
| hormone_columns | ホルモンコラム |

#### 盆栽園・イベント
| テーブル | 説明 |
|---------|------|
| bonsai_shops | 盆栽園 |
| shop_genres | 盆栽園ジャンル |
| shop_reviews | 盆栽園レビュー |
| shop_review_images | レビュー画像 |
| shop_change_requests | 盆栽園情報変更リクエスト |
| events | イベント |

#### 盆栽記録・辞典
| テーブル | 説明 |
|---------|------|
| bonsais | 盆栽 |
| bonsai_records | 成長記録 |
| bonsai_record_images | 記録画像 |
| bonsai_care_logs | 盆栽手入れログ（カレンダービュー専用、type/performedAt/note） |
| bonsai_terms | 盆栽用語辞典 |

#### メッセージ
| テーブル | 説明 |
|---------|------|
| conversations | 会話 |
| conversation_participants | 会話参加者 |
| messages | メッセージ |

#### 決済
| テーブル | 説明 |
|---------|------|
| payments | 支払い履歴 |

#### お問い合わせ
| テーブル | 説明 |
|---------|------|
| contact_inquiries | お問い合わせ |

#### 管理
| テーブル | 説明 |
|---------|------|
| reports | 通報 |
| admin_users | 管理者 |
| admin_logs | 管理者ログ |
| admin_notifications | 管理者通知 |
| system_settings | システム設定（メンテナンスモード等） |
| webhook_events | 外部 Webhook の冪等性管理（provider + event_id UNIQUE、Stripe 等のリトライ抑止） |

#### モデレーション・CMS
| テーブル | 説明 |
|---------|------|
| ng_words | NGワード |
| moderation_queues | モデレーションキュー |
| user_warnings | ユーザー警告 |
| user_segments | ユーザーセグメント |
| announcements | お知らせ |
| cms_pages | CMSページ |
| cms_page_versions | CMSページバージョン |
| pesticide_data_histories | 農薬データ変更履歴 |

#### アナリティクス
| テーブル | 説明 |
|---------|------|
| user_analytics | ユーザー分析データ |
| daily_visitors | 日次の実訪問者ログ（`(date, visitor_id)` UNIQUE で同日重複抑止、HttpOnly Cookie の opaque UUID で識別。管理ダッシュボードのアクセス推移グラフが参照） |

### 4.3 Enum一覧（24種）

| Enum | 用途 |
|------|------|
| AdminRole | 管理者ロール（super_admin/admin/moderator/support/viewer） |
| AnnouncementType | お知らせ種別 |
| BonsaiCareType | 盆栽手入れログ種別（watering/fertilizing/pruning/wiring/repotting/other 等） |
| ContactStatus | お問い合わせステータス |
| DiseasePestCategory | 病害虫カテゴリ（disease/pest） |
| EffectRating | 薬剤効果評価 |
| FertilizerAction | 施肥アクション |
| GenreType | ジャンル分類 |
| HormoneCategory | ホルモンカテゴリ |
| MediaType | メディア種別（image/video） |
| ModerationStatus | モデレーションステータス |
| NotificationType | 通知種別 |
| NutrientCategory | 栄養素カテゴリ |
| NutrientLevel | 栄養素レベル |
| PaymentStatus | 決済ステータス |
| PesticideType | 農薬種別（fungicide/insecticide/acaricide/other） |
| ReportReason | 通報理由 |
| ReportStatus | 通報ステータス |
| ReportTargetType | 通報対象種別 |
| RequestStatus | リクエストステータス |
| ResistanceRisk | 耐性リスク |
| ScheduledPostStatus | 予約投稿ステータス |
| TreeCategory | 樹種カテゴリ |
| WarningLevel | 警告レベル |

### 4.4 主要な複合インデックス

| テーブル | インデックス列 | 用途 |
|---------|---------------|------|
| reports | status + createdAt | 通報一覧のステータス別ソート |
| events | isHidden + startDate + createdAt | イベント一覧の表示・日付ソート |
| users | isSuspended + createdAt | ユーザー管理のステータス別ソート |
| shop_change_requests | status + createdAt | 変更リクエスト一覧のステータス別ソート |

---

## 5. API設計

### 5.1 認証 API

| 関数 | 説明 |
|------|------|
| `registerUser` | ユーザー登録（ブラックリストチェック含む） |
| `checkLoginAllowed` | ログイン許可チェック |
| `recordLoginFailure` | ログイン失敗記録 |
| `clearLoginAttempts` | 失敗カウントクリア |
| `requestPasswordReset` | パスワードリセット要求（レート制限付き） |
| `resetPassword` | パスワードリセット実行 |

### 5.2 2段階認証 API

| 関数 | 説明 |
|------|------|
| `setup2FA` | 2FAセットアップ開始（QRコード生成） |
| `enable2FA` | 2FA有効化（TOTP検証後） |
| `disable2FA` | 2FA無効化（パスワード確認） |
| `verify2FAToken` | ログイン時の2FA検証 |
| `check2FARequired` | 2FA必要性チェック |
| `regenerateBackupCodes` | バックアップコード再生成 |
| `get2FAStatus` | 2FA状態取得 |

### 5.3 ブラックリスト API

| 関数 | 説明 |
|------|------|
| `addEmailToBlacklist` | メールアドレスをブラックリストに追加 |
| `removeEmailFromBlacklist` | メールアドレスをブラックリストから削除 |
| `getEmailBlacklist` | メールブラックリスト一覧取得 |
| `isEmailBlacklisted` | メールアドレスのブラックリストチェック |
| `addDeviceToBlacklist` | デバイスをブラックリストに追加 |
| `removeDeviceFromBlacklist` | デバイスをブラックリストから削除 |
| `getDeviceBlacklist` | デバイスブラックリスト一覧取得 |
| `isDeviceBlacklisted` | デバイスのブラックリストチェック |
| `recordUserDevice` | ユーザーのデバイス情報を記録 |

### 5.4 投稿 API

| 関数 | 説明 |
|------|------|
| `createPost` | 投稿作成 |
| `createQuotePost` | 引用投稿作成 |
| `createRepost` | リポスト作成/解除 |
| `deletePost` | 投稿削除 |
| `getPost` | 投稿取得 |
| `getPosts` | タイムライン取得 |

### 5.5 投票 API

| 関数 | 説明 |
|------|------|
| `createPoll` | アンケート作成 |
| `votePoll` | アンケートに投票 |
| `getPollResults` | アンケート結果取得 |

### 5.6 ソーシャル API

| 関数 | 説明 |
|------|------|
| `toggleLike` | いいね切り替え |
| `toggleBookmark` | ブックマーク切り替え |
| `toggleFollow` | フォロー切り替え |
| `toggleBlock` | ブロック切り替え |
| `toggleMute` | ミュート切り替え |
| `createComment` | コメント作成 |

### 5.7 フォローリクエスト API

| 関数 | 説明 |
|------|------|
| `getFollowRequests` | リクエスト一覧取得 |
| `acceptFollowRequest` | リクエスト承認 |
| `rejectFollowRequest` | リクエスト拒否 |

### 5.8 盆栽園 API

| 関数 | 説明 |
|------|------|
| `getShops` | 一覧取得 |
| `getShop` | 詳細取得 |
| `createShop` | 登録 |
| `updateShop` | 更新 |
| `deleteShop` | 削除 |
| `geocodeAddress` | ジオコーディング |
| `createShopReview` | レビュー作成 |

### 5.9 イベント API

| 関数 | 説明 |
|------|------|
| `getEvents` | 一覧取得 |
| `getEvent` | 詳細取得 |
| `createEvent` | 作成 |
| `updateEvent` | 更新 |
| `deleteEvent` | 削除 |

### 5.10 決済 API

| 関数 | 説明 |
|------|------|
| `createCheckoutSession` | 決済セッション作成 |
| `createCustomerPortalSession` | ポータルセッション作成 |
| `getSubscriptionStatus` | サブスクリプション状態取得 |

### 5.11 メンテナンス API

| 関数 | 説明 |
|------|------|
| `getMaintenanceSettings` | メンテナンス設定取得 |
| `updateMaintenanceSettings` | メンテナンス設定更新 |
| `isMaintenanceMode` | メンテナンスモード判定 |
| `toggleMaintenanceMode` | メンテナンス有効/無効切替 |

### 5.12 API Routes（`app/api/` 24 ハンドラ + `/feed.xml` + `/auth/callback` = 26 エンドポイント）

| パス | 説明 |
|------|------|
| `/api/auth/[...nextauth]` | NextAuth.js 認証 |
| `/api/upload/avatar` | アバターアップロード（`_shared/profile-image-upload.ts` / `validate-upload-file.ts` 経由） |
| `/api/upload/header` | ヘッダーアップロード（同上） |
| `/api/upload/presigned` | presigned URL 発行（フォルダ検証付き） |
| `/api/upload` | 汎用ファイルアップロード（`_shared/validate-upload-file.ts` で検証順序を共通化） |
| `/api/push/vapid-key` | VAPID 公開鍵取得 |
| `/api/cron/publish-scheduled` | 予約投稿実行（5 分毎） |
| `/api/cron/check-subscriptions` | サブスクリプション確認（毎日 1 時 UTC） |
| `/api/cron/cleanup-events` | 終了イベント自動クリーンアップ（毎月 1 日 00:00 UTC） |
| `/api/cron/update-weather` | 天気データ更新（Open-Meteo 連携） |
| `/api/webhooks/stripe` | Stripe Webhook（`webhook_events` による冪等性保証） |
| `/api/health` | ヘルスチェック（DB 接続検証 + IP レート制限） |
| `/api/maintenance/status` | メンテナンス状態確認 |
| `/api/badges` | 未読通知・メッセージ数 |
| `/api/ad-frame` | AdSense / 忍者AdMax 広告 iframe（独自 CSP） |
| `/api/og` | OG 画像動的生成（Node.js ランタイム、墨絵背景） |
| `/api/analytics/track` | 日次の実訪問者ログ記録（HttpOnly Cookie、PII なし、`daily_visitors` テーブルへ upsert） |
| `/api/analytics/view` | 投稿 / プロフィール閲覧の beacon 受信口。`recordPostViewService` / `recordProfileViewService` 経由で `user_analytics` に集計。Redis dedupe・block/非公開チェック付き |
| `/feed.xml` | RSS 2.0 公開投稿フィード（1 時間キャッシュ） |
| `/api/admin/sentry` | Sentry エラー監視連携（管理者） |
| `/api/admin/usage` | システム利用統計（管理者） |
| `/api/admin/search/setup` | FTS 検索セットアップ（管理者） |
| `/api/admin/seed-pesticide` | 農薬シードデータ（Bearer トークン） |
| `/api/admin/seed` | 統合シード投入（Bearer トークン、5 ドメイン） |
| `/api/admin/apply-migration` | 一回限りのマイグレーション適用バックドア（Bearer トークン + allowlist 内 SQL のみ） |
| `/auth/callback` | NextAuth コールバック（OAuth フロー内部用 Route Handler） |

---

## 6. ページ構成

### 6.1 認証ページ

| パス | 説明 |
|------|------|
| `/login` | ログイン |
| `/register` | ユーザー登録 |
| `/register/verify-email-sent` | 確認メール送信完了ページ（登録後） |
| `/verify-email` | メールアドレス確認（トークン検証後ログイン可能） |
| `/password-reset` | パスワードリセット要求 |
| `/password-reset/confirm` | パスワードリセット実行 |

### 6.2 メインページ

| パス | 説明 |
|------|------|
| `/feed` | タイムライン |
| `/posts/[id]` | 投稿詳細 |
| `/bookmarks` | ブックマーク一覧 |
| `/drafts` | 下書き一覧 |
| `/search` | 検索結果 |
| `/notifications` | 通知一覧 |
| `/messages` | メッセージ一覧 |
| `/analytics` | アナリティクス（プレミアム） |

### 6.3 ユーザーページ

| パス | 説明 |
|------|------|
| `/users/[id]` | プロフィール |
| `/users/[id]/posts` | ユーザーの投稿 |
| `/users/[id]/likes` | いいねした投稿 |
| `/users/[id]/followers` | フォロワー一覧 |
| `/users/[id]/following` | フォロー中一覧 |

### 6.4 盆栽用語辞典

| パス | 説明 |
|------|------|
| `/dictionary` | 盆栽用語辞典一覧 |
| `/dictionary/[slug]` | 用語詳細 |

### 6.5 農薬・病害虫（ログインユーザー向け）

| パス | 説明 |
|------|------|
| `/pesticides` | 農薬・病害虫トップ（検索・病害虫から探す） |
| `/pesticides/products/[slug]` | 薬剤製品詳細 |
| `/pesticides/diseases-pests` | 病害虫図鑑一覧 |
| `/pesticides/diseases-pests/[slug]` | 病害虫詳細（効く薬剤） |
| `/pesticides/ingredients` | 原体一覧 |
| `/pesticides/ingredients/[slug]` | 原体詳細 |
| `/pesticides/formulations` | 剤型の違い |
| `/pesticides/spreaders` | 展着剤一覧 |
| `/pesticides/spreaders/[slug]` | 展着剤詳細（製品→リダイレクト、型→説明表示） |
| `/pesticides/columns` | コラム一覧 |
| `/pesticides/columns/[slug]` | コラム詳細 |

### 6.6 肥料ガイド

| パス | 説明 |
|------|------|
| `/fertilizers` | 施肥ガイドトップ |
| `/fertilizers/nutrients` | 栄養素一覧 |
| `/fertilizers/nutrients/[slug]` | 栄養素詳細 |
| `/fertilizers/categories` | 肥料カテゴリ比較 |
| `/fertilizers/schedules` | 樹種別施肥スケジュール |
| `/fertilizers/schedules/[slug]` | 樹種別スケジュール詳細 |
| `/fertilizers/columns` | コラム一覧 |
| `/fertilizers/columns/[slug]` | コラム詳細 |

### 6.7 植物ホルモンガイド

| パス | 説明 |
|------|------|
| `/hormones` | 植物ホルモンガイドトップ |
| `/hormones/[slug]` | ホルモン詳細 |
| `/hormones/techniques` | 盆栽技法×ホルモンマッピング |
| `/hormones/diagram` | ホルモン相互作用ダイアグラム |
| `/hormones/calendar` | 年間ホルモン活性カレンダー |
| `/hormones/simulator` | ホルモンバランスシミュレーター |
| `/hormones/interactions` | ホルモン相互作用一覧 |
| `/hormones/columns` | コラム一覧 |
| `/hormones/columns/[slug]` | コラム詳細 |

### 6.8 盆栽園・イベント

| パス | 説明 |
|------|------|
| `/shops` | 盆栽園マップ |
| `/shops/new` | 盆栽園登録 |
| `/shops/[id]` | 盆栽園詳細 |
| `/events` | イベント一覧 |
| `/events/new` | イベント作成 |
| `/events/[id]` | イベント詳細 |

### 6.9 盆栽記録

| パス | 説明 |
|------|------|
| `/bonsai` | 盆栽一覧（カレンダービュー切替で `?view=calendar`） |
| `/bonsai/new` | 盆栽登録 |
| `/bonsai/[id]` | 盆栽詳細 |
| `/bonsai/[id]/edit` | 盆栽編集 |

### 6.10 設定

| パス | 説明 |
|------|------|
| `/settings` | 設定メニュー |
| `/settings/profile` | プロフィール編集 |
| `/settings/account` | アカウント設定 |
| `/settings/security` | セキュリティ設定（2FA） |
| `/settings/subscription` | プレミアム会員 |
| `/settings/blocked` | ブロック一覧 |
| `/settings/muted` | ミュート一覧 |
| `/settings/follow-requests` | フォローリクエスト管理 |
| `/settings/notifications` | 通知設定 |

### 6.11 管理者（35画面）

| パス | 説明 |
|------|------|
| `/admin` | ダッシュボード |
| `/admin/users` | ユーザー管理 |
| `/admin/users/[id]` | ユーザー詳細 |
| `/admin/users/[id]/activity` | ユーザーアクティビティ |
| `/admin/posts` | 投稿管理 |
| `/admin/events` | イベント管理 |
| `/admin/events/import` | イベントCSVインポート |
| `/admin/shops` | 盆栽園管理 |
| `/admin/reports` | 通報管理 |
| `/admin/blacklist` | ブラックリスト管理 |
| `/admin/maintenance` | メンテナンスモード管理 |
| `/admin/contact` | お問い合わせ管理 |
| `/admin/contact/[id]` | お問い合わせ詳細 |
| `/admin/logs` | 管理者ログ |
| `/admin/hidden` | 非表示コンテンツ管理 |
| `/admin/premium` | プレミアム会員管理 |
| `/admin/reviews` | レビュー管理 |
| `/admin/shop-requests` | 盆栽園変更リクエスト管理 |
| `/admin/stats` | 統計ダッシュボード |
| `/admin/usage` | システム利用統計 |
| `/admin/roles` | 管理者ロール管理 |
| `/admin/warnings` | ユーザー警告管理 |
| `/admin/ng-words` | NGワード管理 |
| `/admin/moderation-queue` | モデレーションキュー |
| `/admin/announcements` | お知らせ管理 |
| `/admin/content-management` | CMSページ管理 |
| `/admin/segments` | ユーザーセグメント管理 |
| `/admin/security` | セキュリティ管理 |
| `/admin/ip-management` | IP管理 |
| `/admin/monitoring` | システム監視 |
| `/admin/backups` | バックアップ管理 |
| `/admin/analytics` | 管理者アナリティクス |
| `/admin/analytics/cohort` | コホート分析 |
| `/admin/analytics/content` | コンテンツ分析 |
| `/admin/pesticide-data` | 農薬データ管理 |

### 6.12 静的ページ

| パス | 説明 |
|------|------|
| `/` | ホーム（LP） |
| `/about` | BON-LOGについて |
| `/terms` | 利用規約 |
| `/privacy` | プライバシーポリシー |
| `/tokushoho` | 特定商取引法に基づく表記 |
| `/help` | ヘルプ |
| `/contact` | お問い合わせ |
| `/maintenance` | メンテナンス中ページ |

---

## 7. セキュリティ

### 7.1 認証・認可
- NextAuth.js v5によるセッション管理
- JWT戦略
- CSRF保護（自動）
- proxy.ts（Edge Middleware）によるルート保護

### 7.2 データ保護
- パスワード: bcryptハッシュ化（ソルトラウンド12）
- リセットトークン: SHA-256ハッシュ化
- 2FAシークレット: AES-256-GCM暗号化
- 2FAバックアップコード: SHA-256ハッシュ化
- SQLインジェクション対策: Prismaによるパラメータ化クエリ
- XSS対策: HTMLサニタイズ（sanitize.ts）
- SSL証明書検証: rejectUnauthorized: true（Supabase CA証明書Base64デコード対応、MITM攻撃防止）

### 7.3 アクセス制御
- ログインレート制限（5回失敗で15分ロック）
- パスワードリセットレート制限（1時間に3回）
- 管理者権限の分離（5段階ロール）
- 自分のコンテンツのみ編集/削除可能
- 2段階認証（TOTP）によるアカウント保護
- メールアドレスブラックリストによる登録制限
- デバイスフィンガープリントブラックリストによるアクセス制限

### 7.4 ファイルアップロードセキュリティ
- ファイルシグネチャ（マジックバイト）検証
- MIMEタイプと実際のファイル形式の一致確認
- UUID v4によるファイル名生成（オリジナルファイル名非使用）
- presigned URLのフォルダ制限（ホワイトリスト方式）
- 対応ファイル形式の厳格な制限

### 7.5 入力検証・サニタイズ
- Zod v4によるスキーマバリデーション
- HTMLタグのサニタイズ（危険なタグ・属性の除去）
- 許可されたHTML要素のホワイトリスト管理

### 7.6 監視・ログ
- Sentryによるエラー監視
- 管理者操作のログ記録
- ログイン履歴の記録
- セキュリティイベントのロギング（security-logger.ts）

### 7.7 レート制限
- Upstash Redisによる分散レート制限
- エンドポイントごとのカスタマイズ可能な制限設定
- IPベース + ユーザーベースの制限
- いいね・ブックマーク・フォロー等のソーシャルアクションにもレート制限を適用

### 7.8 IP検出・通知・DB接続の堅牢化
- IP検出: `lib/utils/client-ip.ts` の `extractClientIp()` に一元化。優先順位は `cf-connecting-ip` → `x-vercel-forwarded-for` → `x-forwarded-for`（チェーンが3要素以上なら末尾から2番目、それ以下は先頭）→ `x-real-ip` → `'unknown'`。クライアント偽装可能な先頭IPの単純採用を排除（スプーフィング耐性）
- 通知作成: パラメータをZodでバリデーション
- データベース接続プール: `@prisma/adapter-pg` + `pg` Pool でエラーイベントハンドラを設定

### 7.9 セキュリティヘッダー
- `X-XSS-Protection`: XSS攻撃対策
- `X-Content-Type-Options`: MIMEタイプスニッフィング防止
- `X-Frame-Options`: クリックジャッキング防止
- `Referrer-Policy`: リファラー情報の制御
- `Permissions-Policy`: ブラウザ機能の制限
- `Content-Security-Policy`: コンテンツセキュリティポリシー（nonce対応）
- `Strict-Transport-Security`: HTTPS強制（本番環境）
- `Cross-Origin-Opener-Policy`: クロスオリジン保護
- `Cross-Origin-Resource-Policy`: リソース共有制御

### 7.10 CSP nonce実装
- 各リクエストで暗号的に安全な一意のnonceを生成
- インラインスクリプトをnonce属性で個別許可
- nonce対応ブラウザでは`'unsafe-inline'`を自動無視（CSP Level 2+）
- 外部広告スクリプトはドメインホワイトリストで許可
- Server ComponentでnonceをカスタムHTTPヘッダー経由で取得可能

### 7.11 Cookie セキュリティ（SameSite）
- セッションCookie: `SameSite=Lax`（CSRF攻撃対策）
- `httpOnly`: JavaScriptからのCookieアクセスを禁止（XSS対策）
- `Secure`: HTTPS接続でのみCookieを送信（本番環境）
- `__Secure-`/`__Host-`プレフィックス: ブラウザによる追加検証（本番環境）
- CSRFトークンCookie: `SameSite=Lax` + `httpOnly`

### 7.12 Origin検証
- POSTリクエストのOriginヘッダー検証
- Server Actions保護
- 許可されたオリジンのホワイトリスト管理

### 7.13 Basic認証（オプション）
- 環境変数で有効/無効を制御
- ステージング環境での保護に使用
- APIルートは除外（Webhook対応）

---

## 8. パフォーマンス

### 8.1 最適化施策
- Server Componentsによるサーバーサイドレンダリング
- React Queryによるキャッシュ管理
- next/imageによる画像最適化（Sharp / WebP変換）
- カーソルベースページネーション
- Upstash Redisによるキャッシュ（getUserRelationSets 5分TTL等）
- unstable_cache / React cache() によるメモ化
- include→select最適化（N+1クエリ防止）
- サイトマップの並列生成

### 8.2 目標値
- タイムライン読み込み: 1秒以内
- 画像表示: X（旧Twitter）並みの高速表示

---

## 9. テスト

### 9.1 テスト構成

| 種別 | ツール | 対象 | テスト数 |
|------|--------|------|---------|
| ユニットテスト | Vitest + React Testing Library | コンポーネント、ユーティリティ、Server Actions、Instrumentation | 805 テストファイル / 全 PASS |
| E2Eテスト | Playwright | ユーザーフロー全般 | 60 spec ファイル |

### 9.2 カバレッジ閾値

| メトリクス | 閾値 |
|-----------|------|
| Statements | 85% |
| Branches | 80% |
| Functions | 85% |
| Lines | 85% |

**閾値**: 上記の通り（`vitest.config.ts` で `@vitest/coverage-istanbul` により CI で強制）。実測値は `npm run test:coverage` で確認。
**TypeScript 厳格設定**: `strict: true` + `noUncheckedIndexedAccess: true`（2026-05-13 に true 化）。配列インデックス・`Map.get` の戻り値は `T | undefined` として絞り込み必須。

### 9.3 E2Eテスト構成

| テストファイル | 内容 |
|--------------|------|
| `e2e/auth.setup.ts` | 認証セットアップ |
| `e2e/accessibility.spec.ts` | アクセシビリティ |
| `e2e/admin.spec.ts` | 管理者ページ |
| `e2e/admin-extended.spec.ts` | 管理者拡張 |
| `e2e/admin-moderation.spec.ts` | 管理者モデレーション |
| `e2e/admin-new-pages.spec.ts` | 管理者新規ページ |
| `e2e/analytics.spec.ts` | アナリティクス |
| `e2e/analytics-extended.spec.ts` | アナリティクス拡張（プレミアム指標の境界条件） |
| `e2e/auth.spec.ts` | ログイン・登録フロー |
| `e2e/block-mute.spec.ts` | ブロック・ミュート |
| `e2e/bonsai.spec.ts` | 盆栽成長記録 |
| `e2e/bonsai-calendar.spec.ts` | 盆栽カレンダービュー（手入れログ・成長記録・タグ付け投稿の重ね表示） |
| `e2e/bonsai-crud.spec.ts` | 盆栽CRUD |
| `e2e/bonsai-filtering.spec.ts` | 盆栽フィルタリング |
| `e2e/bookmarks.spec.ts` | ブックマーク |
| `e2e/bookmarks-extended.spec.ts` | ブックマーク拡張（一覧・無限スクロールの追加検証） |
| `e2e/comment-interactions.spec.ts` | コメントインタラクション |
| `e2e/comment-thread-mute.spec.ts` | コメントスレッドミュート |
| `e2e/contact-form.spec.ts` | お問い合わせ |
| `e2e/content-crud.spec.ts` | コンテンツCRUD |
| `e2e/content-detail.spec.ts` | コンテンツ詳細 |
| `e2e/dictionary.spec.ts` | 盆栽用語辞典 |
| `e2e/dictionary-extended.spec.ts` | 盆栽用語辞典拡張 |
| `e2e/drafts.spec.ts` | 下書き |
| `e2e/drafts-crud.spec.ts` | 下書きCRUD |
| `e2e/error-handling.spec.ts` | エラーハンドリング |
| `e2e/event-crud.spec.ts` | イベントCRUD |
| `e2e/events.spec.ts` | イベント |
| `e2e/feed.spec.ts` | フィードページ |
| `e2e/fertilizers.spec.ts` | 肥料ガイド |
| `e2e/hashtag-navigation.spec.ts` | ハッシュタグナビゲーション |
| `e2e/hormones.spec.ts` | 植物ホルモンガイド |
| `e2e/legal-pages.spec.ts` | 法的ページ |
| `e2e/maintenance.spec.ts` | メンテナンス |
| `e2e/messages.spec.ts` | ダイレクトメッセージ |
| `e2e/messages-flow.spec.ts` | メッセージフロー |
| `e2e/navigation.spec.ts` | ナビゲーション |
| `e2e/notification-actions.spec.ts` | 通知アクション |
| `e2e/notifications.spec.ts` | 通知 |
| `e2e/notifications-extended.spec.ts` | 通知拡張（種別ごとの遷移・既読フロー） |
| `e2e/pesticides.spec.ts` | 農薬・病害虫 |
| `e2e/polls.spec.ts` | 投票 |
| `e2e/post-interactions.spec.ts` | 投稿インタラクション |
| `e2e/public-pages.spec.ts` | 公開ページ |
| `e2e/quote-repost.spec.ts` | 引用投稿・リポスト |
| `e2e/report.spec.ts` | 通報 |
| `e2e/responsive.spec.ts` | レスポンシブデザイン |
| `e2e/scheduled-posts.spec.ts` | 予約投稿 |
| `e2e/search.spec.ts` | 検索 |
| `e2e/settings.spec.ts` | 設定 |
| `e2e/settings-advanced.spec.ts` | 高度な設定 |
| `e2e/settings-guest.spec.ts` | ゲスト設定 |
| `e2e/shop-reviews.spec.ts` | 盆栽園レビュー |
| `e2e/shops.spec.ts` | 盆栽園マップ |
| `e2e/social-interactions.spec.ts` | ソーシャルインタラクション |
| `e2e/subscription.spec.ts` | サブスクリプション |
| `e2e/two-factor-auth.spec.ts` | 2段階認証 |
| `e2e/user-actions.spec.ts` | ユーザーアクション |
| `e2e/user-profile.spec.ts` | プロフィールページ |
| `e2e/user-profile-detail.spec.ts` | プロフィール詳細 |
| `e2e/user-profile-extended.spec.ts` | プロフィール拡張（タブ切替・追加ケース） |

### 9.4 テストコマンド

```bash
npm test                # ユニットテスト
npm run test:coverage   # カバレッジ付き
npm run test:e2e        # E2Eテスト
npm run test:all        # 全テスト実行
```

### 9.5 CI/CD（GitHub Actions）

| ジョブ | 内容 | 実行タイミング |
|--------|------|--------------|
| lint | ESLint + TypeScript型チェック | 常時 |
| security | npm audit（high+）+ CodeQL 静的解析 | 常時 |
| test | ユニットテスト | 常時 |
| build | ビルド確認 | 常時 |
| e2e | E2Eテスト（Playwright） | push + PR |
| lighthouse | Lighthouse CI パフォーマンス監査 | push + PR |

---

## 10. 運用コスト

### 10.1 初期段階（〜100ユーザー）

| サービス | プラン | 月額 |
|---------|--------|------|
| fly.io | shared-cpu-1x / 1GB / 1台常時稼働 | 約$5〜10 |
| Supabase | Free | $0 |
| Upstash | Free | $0 |
| Cloudflare R2 | Free枠 | $0 |
| Resend | Free | $0 |
| Sentry | Free | $0 |
| **合計** | | **約$5〜10（\1,000〜1,500）** |

### 10.2 成長期（〜1,000ユーザー）

| サービス | プラン | 月額 |
|---------|--------|------|
| fly.io | スケールアップ / 複数台 | $10〜30 |
| Supabase | Pro | $25 |
| Upstash | Pay as you go | $5 |
| Cloudflare R2 | 従量課金 | $5 |
| Resend | Pro | $20 |
| Stripe | 従量課金 | 決済額の3.6% |
| Sentry | Free/Team | $0〜$26 |
| **合計** | | **約$65〜110（\10,000〜16,000）** |

---

## 11. 環境変数

> 本番（fly.io）では秘匿値を `fly secrets set` / `fly secrets import` で投入し、`NEXT_PUBLIC_*` は `fly.toml` の `[build.args]` でビルド時 inline する。

### 11.1 必須環境変数

```bash
# データベース（Supabase）
DATABASE_URL="postgresql://..."   # pooler 経由（?sslmode 等は付けない）
DIRECT_URL="postgresql://..."      # 直接接続（マイグレーション用）
SUPABASE_CA_CERT="<Base64エンコードしたCA証明書>"  # 本番でDB接続のSSL検証に必須（fail-closed）

# 認証
NEXTAUTH_URL="https://www.bon-log.com"
NEXTAUTH_SECRET="..."              # openssl rand -base64 32
AUTH_TRUST_HOST="true"            # fly.io 等プロキシ配下で必須

# アプリケーション
NEXT_PUBLIC_APP_URL="https://www.bon-log.com"

# Redis（Upstash）
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# エラー監視（Sentry）
SENTRY_DSN="https://..."
NEXT_PUBLIC_SENTRY_DSN="https://..."

# 2段階認証
TWO_FACTOR_ENCRYPTION_KEY="..."  # 32バイトのhex文字列

# Cron（GitHub Actions の schedule から Bearer 認証で叩く）
CRON_SECRET="..."
```

### 11.2 オプション環境変数

```bash
# ストレージ（Cloudflare R2）
STORAGE_PROVIDER="r2"
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="..."
R2_PUBLIC_URL="..."

# メール（Resend）
EMAIL_PROVIDER="resend"
RESEND_API_KEY="..."
EMAIL_FROM="BON-LOG <noreply@bon-log.com>"

# 検索（PostgreSQL 全文検索）
SEARCH_MODE="trgm"   # like / trgm（pg_trgm）/ bigm（pg_bigm）

# 決済（Stripe）
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="..."
STRIPE_PRICE_ID_MONTHLY="..."
STRIPE_PRICE_ID_YEARLY="..."

# 広告（忍者AdMax / Google AdSense）
NEXT_PUBLIC_AD_PROVIDER="ninja"   # ninja / adsense
# 忍者AdMax（広告枠ID）
NEXT_PUBLIC_NINJA_AD_ID_SIDEBAR="..."
NEXT_PUBLIC_NINJA_AD_ID_INFEED="..."
NEXT_PUBLIC_NINJA_AD_ID_POST_DETAIL="..."
# Google AdSense
NEXT_PUBLIC_ADSENSE_CLIENT_ID="..."
NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR="..."
NEXT_PUBLIC_ADSENSE_SLOT_INFEED="..."
NEXT_PUBLIC_ADSENSE_SLOT_POST_DETAIL="..."

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Web Push（npx web-push generate-vapid-keys で生成）
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:noreply@bon-log.com"

# ゲスト（のぞいてみる）ログイン
GUEST_PASSWORD="..."

# Basic認証（ステージング環境用）
BASIC_AUTH_USER="..."
BASIC_AUTH_PASSWORD="..."
```

---

## 12. 将来の拡張案

| 機能 | 優先度 | 状態 | 説明 |
|------|--------|------|------|
| 多言語対応 | 中 | 未実装 | 英語、中国語対応 |
| AI機能 | 中 | 未実装 | 樹種の画像認識、育成アドバイス |
| マーケットプレイス | 低 | 未実装 | 盆栽・用品の売買機能 |
| ライブ配信 | 低 | 未実装 | 展示会などのリアルタイム配信 |

---

## 13. 変更履歴

| 日付 | 内容 |
|------|------|
| 2025-01-05 | 初版作成 |
| 2026-04-23 | プロジェクト状態に合わせて更新（Prisma 6.19.2 / モデル 88 / Server Actions 83ファイル / テスト 748 / E2E 59 / 構造整理） |
| 2026-04-26 | 盆栽手入れログ追加・Server Actions ActionResult 統一・SEO canonical 修正に追従（モデル 89 / Enum 24 / Server Actions 85 / テスト 773 / E2E 60 / マイグレーション 31） |
| 2026-04-27 | 可読性リファクタ（POST_QUOTE/REPOST/POLL include 共有化、shop.ts FormData パース集約、PostForm state スナップショット化、analytics.ts コメント整理、pesticide.ts Zod 集約、auth.ts ドメイン別 sub-import、two-factor.ts WHAT コメント削減、feed.ts JSDoc 簡素化、post.ts getPosts 平坦化）に追従。components 246 / テスト 774 / カバレッジ Lines 95.97% / Branches 89.91% / マイグレーション 32 / `app/api/` 20 ハンドラ + `/feed.xml` + `/auth/callback` = 22 エンドポイント。本番コードの非 null アサーション全廃 |
| 2026-04-30 | 品質一括対応に追従。USER_MINIMAL_RELATION 24 箇所統一、DOM event target を `instanceof` 型ガード化（5 ファイル）、HormoneBalanceSimulator マジックナンバー除去、SearchBar 過剰 JSDoc 整理（522→257 行）、SearchBar の nested `<button>` 解消（HTML5 仕様 / a11y 準拠）、MobileNav の MenuLink/InkSeparator/AccordionToggle 抽出、`createPost` 検証ロジックを `parseAndValidateCreatePostInput` に抽出（ok 判別子 union）、follow-request.ts の approve/reject/cancel/sendFollowRequest に Zod 検証 + `requireActiveNonGuestUser('engagement')` 統一（CLAUDE.md ルール 3 完全準拠）。テスト 795 / 14,959 ケース全 PASS |
| 2026-04-30 | 本番シード API 拡充 — 既存の `/api/admin/seed-pesticide` に加え `/api/admin/seed`（ジャンル / 辞典 / 肥料 / ホルモン / ゲスト 5 ドメイン統合）を新設。Bearer 認証 + IP allowlist + maxDuration=300 + 例外詳細返却の同一パターン。`npm run db:seed-production [domain]` で呼び出し。`prisma/seed/shared/create-client.ts` を Vercel 環境では `DATABASE_URL`（pooler）優先に修正し IPv6 直接接続不能の問題を解消。`/api/admin/seed-pesticide` も `maxDuration=300` 追加・例外詳細返却を実装。テスト 796 / 14,971 ケース全 PASS |
| 2026-04-30 | 管理者ダッシュボードに「過去30日のアクセス推移」グラフ追加。`getDailyActiveUsersHistory(days)` を `lib/actions/admin/stats.ts` に新設し、posts / comments / likes / follows の `UNION ALL` を `DATE_TRUNC('day') + COUNT(DISTINCT user_id)` で 1 クエリ集計。`app/admin/DailyActiveUsersChart.tsx` を recharts エリアチャートで実装し `next/dynamic` で SSR 回避。テスト 796 / 14,979 ケース全 PASS |
| 2026-05-02 | 実訪問者ログ機能追加。`daily_visitors` テーブル（HttpOnly Cookie の opaque UUID で識別、PII 非格納、`(date, visitor_id)` UNIQUE）と `POST /api/analytics/track` Route Handler、`POST /api/admin/apply-migration` バックドア（allowlist 内 SQL のみ実行可）を実装。管理ダッシュボードのアクセス推移グラフを 30 / 90 / 180 日切替対応に拡張。マイグレーション 33（`20260502000000_add_daily_visitors`）。 |
| 2026-05-08 | レビュー指摘の横断対応。SEO: 残り 4 ページに metadata + robots:noindex 追加（メタデータ全 128 ページ 100% カバー）。アーキ: `lib/actions/post.ts` 817→659 行に縮小し、純粋検証ロジック（`validatePollOptions` / `parseCreatePostShape` / `applyCreatePostBusinessRules`）を `lib/actions/post-validation.ts` (`'server-only'`) に分離。型安全: `lib/ng-word-checker.ts` の `as NgWordEntry[]` キャストを `z.array(...).safeParse() + .loose()` で排除。観測性: `proxy.ts` の `[SECURITY]` / `[MAINTENANCE]` ログを `Sentry.captureMessage` にも送る `reportSecurityEvent` ヘルパーで統一（Edge Runtime 互換、本番以外は no-op）。定数化: `EVENT_TITLE_SIMILARITY_PREFIX_LENGTH` を `lib/constants/limits/event.ts` に昇格、`REFERER_LOG_PREVIEW_LENGTH` を `lib/constants/limits/auth.ts` に追加。Server Actions 86 / lib/constants/limits 16 / テスト 798 / 15,103 ケース全 PASS / カバレッジ Lines 98.09% / Statements 97.32% / Functions 97.68% / Branches 92.13%。 |
| 2026-05-12 | 2026-05-12 レビュー指摘の追加対応。大型ファイル機能分割（message → message-conversations / message-messages、scheduled-post → scheduled-post-crud / scheduled-post-publish、search → search-posts / search-users / search-entities）。Vitest 並列度を `maxWorkers='50%'` に固定して flaky 解消。`bonsai_care_logs` / `daily_visitors` の RLS ポリシー追加（マイグレーション `20260512100000_add_rls_policies_bonsai_care_logs_daily_visitors`）。`handle_new_user` セキュリティ強化（`20260512000000_lock_handle_new_user_security`）。 |
| 2026-05-13 | エンジニアリングレビュー (engineering-review-verified 2026-05-13) の P0/P1/P2 全対応（目標 92 点）。**strict: true + `noUncheckedIndexedAccess: true` に切替**、ESLint 厳格化（`1d91b468`）。Server Action の認証→Zod→レート制限 順序を全 Action で再点検し、`as` キャスト排除・route リテラル統一を実施。CI 3 ジョブ（env-validation / Lighthouse / npm audit）の失敗を根本対応（`8c0978f2`）。 |
| 2026-05-14 | **5 ドキュメントを 2026-05-14 時点の現状に追従**。`fertilizer.ts` / `hormone.ts` / `pesticide.ts` を `'use server'` から `'server-only'` の RSC データ取得モジュールに移行（page.tsx から直接 await）。`/api/analytics/view` Route Handler 追加（Server Component からの書き込み分離、Zod discriminated union、Redis dedupe、block/非公開ガード）。`lib/services/` に `analytics-recording.ts` / `analytics-service.ts` / `hashtag-recount.ts` を追加（13 ファイル化）。`lib/constants/dictionary.ts` 追加。`app/api/upload/_shared/validate-upload-file.ts` 共有検証を導入。テスト 805ファイル。マイグレーション 35 ディレクトリ。Server Actions 86 ファイル中 `'use server'` 持ちは 53 + admin 19、`'server-only'` 内部 helper / RSC データ取得 13 + barrel 1。 |
| 2026-05-27 | エンジニアリングレビュー (engineering-review-verified 2026-05-27) の妥当な指摘へ全対応。**規約逸脱**: `lib/services/shop-change-helpers.ts`（純粋型・schema・parser のみ）を layer 規約遵守のため `lib/shop/change-request.ts` へ移設、admin page からの直接 import を解消。**SEO**: `app/(main)/settings/subscription/page.tsx` に `robots: { index: false, follow: false }` 追加（他 settings/auth ページは既に対応済み）。**セキュリティ**: `/api/webhooks/stripe` と `/api/ad-frame` に `RATE_LIMITS.api`（60req/分・IPベース fail-open）を追加し DoS 保険強化。**型安全**: `tsconfig.json` に `noImplicitOverride: true` を追加（class override 強制）。**P3 配慮**: `UserCard` を `memo()` 化、`lib/services/analytics-service.ts` の `gId` → `genreId` リネーム、admin events / contact ページのハードコード href を `ROUTE_ADMIN_EVENTS_IMPORT` / `ROUTE_ADMIN_CONTACT` 定数化。**comments.md 規約**: `lib/constants/locations.ts` の `// === REGION ===` 装飾区切り 15 箇所を空行 + シンプルコメントへ置換、`lib/actions/blacklist.ts` / `two-factor.ts` / `admin/ip-management.ts` の WHAT コメント計 7 箇所を削除。**count update**: Server Actions 85（64 ルート + 20 admin + 1 schemas）、lib/services 14、lib/shop 新設、lib/constants 47（ルート 22 + limits 18 + errors 7）、lib/utils 12、構成サマリ修正。lint / 全 15,168 テスト / build いずれもエラー警告ゼロで通過。 |
| 2026-05-30 | 制限値・機能リストをコード（`lib/constants/limits/`）と `app/(main)` 構成に対して再検証し追従。**修正**: コメント上限を「1投稿あたり最大100件」→「1ユーザーあたり1日100件（`DAILY_COMMENT_LIMIT`、投稿単位ではない）」に訂正、コメントのメディア添付仕様（画像2 + 動画1 = 最大3点）と最大文字数500を明記。成長記録の画像枚数を「最大3枚」→「最大4枚」（`MAX_BONSAI_RECORD_IMAGES=4`）に訂正。ページ構成 6.7 の `/hormones` 配下に techniques / diagram / calendar / simulator / interactions を追加（3.14.3 と整合）。**検証済み（変更なし）**: 投稿制限（無料 500字 / 4画像 / 1動画 / 20件/日、プレミアム 2000字 / 6画像 / 3動画 / 40件/日）、ジャンル最大3、レビュー画像最大3、2FA バックアップコード 8桁×10個、動画形式 MP4/WebM/MOV、`lib/actions` 全機能の実在。 |
| 2026-06-07 | **ホスティングを Vercel から fly.io へ移行**（本番ドメイン `https://www.bon-log.com` を fly.io app `bon-log` / region `nrt` 東京へ切替）。コンピュートのみ fly.io、DB(Supabase) / Storage(R2) / Cache(Upstash) / Stripe / Resend / Sentry は外部サービス継続。**デプロイ**: GitHub Actions `fly-deploy.yml`（master push → `flyctl deploy --local-only`）。秘匿値は `fly secrets`、`NEXT_PUBLIC_*` は `fly.toml [build.args]`。**Cron**: fly に組込 cron が無いため GitHub Actions `cron.yml` の schedule から Bearer `CRON_SECRET` で叩く（publish-scheduled */5分・update-weather 毎時・check-subscriptions 毎日01:00 UTC・cleanup-events 毎月1日00:00 UTC）。**環境変数**: `AUTH_TRUST_HOST=true` / `CRON_SECRET` / `SUPABASE_CA_CERT` / `SEARCH_MODE` / `EMAIL_FROM` / `VAPID_SUBJECT` / `NEXT_PUBLIC_NINJA_AD_ID_*` / `GUEST_PASSWORD` を env 一覧に反映、広告スロット名を `_INFEED` / `_POST_DETAIL` に訂正。インフラ・運用コスト・サービス選定理由・IP検出（`cf-connecting-ip` 優先）の記述を fly.io 構成に追従。Prisma は `@prisma/adapter-pg` + `pg` ドライバアダプタ経由であることを明記。 |
| 2026-05-27 (追) | Supabase 2026-10-30 仕様変更 (public schema テーブルが Data API デフォルト非露出化) への先回り対応。Security Advisor で全 90 テーブルが anon / authenticated に GRANT ALL されている状態を検出 (旧 Supabase デフォルト)、Defense in Depth で API + DB 両層を遮断。**API 層**: Dashboard 操作で Exposed schemas から `public` を削除し Exposed tables を 0/90 化（`graphql_public` のみ残置で REST/GraphQL から public テーブル不可視）。**DB 層**: `prisma/migrations/20260527000000_revoke_data_api_grants_from_public/` 新設で `REVOKE ALL ON ALL TABLES/SEQUENCES/ROUTINES IN SCHEMA public FROM anon, authenticated` + `REVOKE USAGE ON SCHEMA public` + `ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE ALL` を一括適用。`pg_roles` 存在チェック付き DO block でローカル Docker postgres では noop。`app/api/admin/apply-migration/route.ts` の `MIGRATION_NAMES` に `revoke_data_api_grants_from_public` を追加し本番手動適用経路 (`npm run db:apply-migration-production`) を確保。**規約**: `.claude/rules/prisma-database.md` に「Supabase Data API 非使用方針」を明文化、`eslint.config.mjs` に `no-restricted-imports` で `@supabase/supabase-js` 等を禁止。**検証**: `__tests__/app/api/admin/apply-migration/route.test.ts` に新 migration の allowlist 包含 + SQL 内容（REVOKE / ALTER DEFAULT PRIVILEGES / ロール存在チェック）を assert するテスト追加。マイグレーション数 37 ディレクトリ。 |

