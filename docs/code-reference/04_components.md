# components/ 全ファイル解説

React コンポーネントをディレクトリ別に解説します。  
`'use client'` が付いているものは Client Component、それ以外は Server Component として利用可能です。

---

## layout/ — レイアウト

| ファイル | 役割・解説 |
|----------|------------|
| `Sidebar.tsx` | 左サイドバー。フィード・検索・通知・DM・盆栽・イベント・設定等へのリンク。アクティブパスのハイライト。 |
| `RightSidebar.tsx` | 右サイドバー。トレンドジャンル・おすすめユーザー・広告等。 |
| `Header.tsx` | ヘッダーバー。ロゴ・検索・通知バッジ・メッセージバッジ・プロフィールメニュー。 |
| `MobileNav.tsx` | モバイル用ボトムナビ。フィード・検索・投稿・通知・プロフィール等。 |

---

## feed/ — タイムライン

| ファイル | 役割・解説 |
|----------|------------|
| `Timeline.tsx` | タイムライン本体。無限スクロールで `getFeed()` を呼び、`PostCard` を並べる。広告を一定間隔で挿入。 |
| `TimelineSkeleton.tsx` | ローディング時のスケルトン表示。 |
| `EmptyTimeline.tsx` | 投稿が 0 件のときの空状態メッセージ。 |
| `FeedWithCompose.tsx` | 投稿フォーム（または Compose ボタン）とタイムラインをまとめた構成。 |
| `ComposeButton.tsx` | モバイル用の投稿作成 FAB。押下で `PostFormModal` を開く。 |

---

## post/ — 投稿

| ファイル | 役割・解説 |
|----------|------------|
| `PostCard.tsx` | 1 件の投稿表示。ヘッダー（ユーザー・日時）、本文・メディア・ジャンル・投票・引用・アクション（いいね・ブックマーク・削除等）。 |
| `PostCardHeader.tsx` | 投稿カードのヘッダー部分。アバター・ニックネーム・日時・メニュー。 |
| `PostCardActions.tsx` | いいね・コメント・ブックマーク・シェア・削除等のボタン群。 |
| `PostCardIcons.tsx` | アクションのアイコン表示。 |
| `PostCard.types.ts` | PostCard 関連の型定義。 |
| `PostForm.tsx` | 投稿作成フォーム。本文・ジャンル・メディア・盆栽紐付け・投票。`createPost` Action を呼ぶ。 |
| `PostFormModal.tsx` | 投稿フォームをモーダルで表示。 |
| `ImageGallery.tsx` | 投稿の画像をギャラリー表示（複数枚対応）。 |
| `QuotedPost.tsx` | 引用投稿のプレビュー表示。 |
| `GenreSelector.tsx` | ジャンル選択 UI。カテゴリ別にチェックボックス。 |
| `PollForm.tsx` | 投票の選択肢・期間を設定するフォーム。 |
| `PollDisplay.tsx` | 投票の表示と投票ボタン。投票済みは結果表示。 |
| `LikeButton.tsx` | いいねトグル。`togglePostLike`。 |
| `BookmarkButton.tsx` | ブックマーク追加/削除。 |
| `DeletePostButton.tsx` | 投稿削除。オーナーまたは管理者のみ表示。 |
| `ShareButtons.tsx` | SNS シェア用ボタン（Twitter 等）。 |
| `ScheduledPostForm.tsx` | 予約投稿用フォーム。公開日時・本文・メディア。 |
| `ScheduledPostList.tsx` | 予約投稿一覧。 |
| `ScheduledPostCard.tsx` | 1 件の予約投稿カード。編集・削除リンク。 |

---

## comment/ — コメント

| ファイル | 役割・解説 |
|----------|------------|
| `CommentCard.tsx` | 1 件のコメント表示。ユーザー・本文・メディア・いいね・返信・スレッドミュート。 |
| `CommentForm.tsx` | コメント入力。`createComment` を呼ぶ。メンション対応。 |
| `CommentList.tsx` | コメント一覧。親子構造で表示。 |
| `CommentThread.tsx` | スレッド単位の表示。リプライのネスト。 |
| `CommentLikeButton.tsx` | コメントへのいいね。`toggleCommentLike`。 |
| `ThreadMuteButton.tsx` | スレッドのミュート。`comment-thread-mute` を利用。 |
| `index.ts` | コメント関連の re-export。 |

---

## user/ — ユーザー

| ファイル | 役割・解説 |
|----------|------------|
| `ProfileHeader.tsx` | プロフィール上部。ヘッダー画像・アバター・ニックネーム・自己紹介・フォロー/フォロワー数・フォローボタン・メッセージボタン。 |
| `ProfileTabs.tsx` | プロフィール内タブ。投稿・いいね・フォロワー・フォロー中への切り替え。 |
| `ProfileEditForm.tsx` | プロフィール編集フォーム。ニックネーム・bio・居住地・公開/非公開。 |
| `UserCard.tsx` | ユーザーカード（アバター・ニックネーム・フォローボタン等）。一覧で使用。 |
| `UserList.tsx` | ユーザー一覧。UserCard のリスト。 |
| `FollowButton.tsx` | フォロー/アンフォロー。非公開の場合はフォローリクエスト。 |
| `AvatarUploader.tsx` | アバター画像アップロード。API に送信後、プロフィールを更新。 |
| `HeaderUploader.tsx` | ヘッダー画像アップロード。同様に API → 更新。 |
| `PrivacyToggle.tsx` | アカウント公開/非公開のスイッチ。 |
| `BlockButton.tsx` | ブロック/ブロック解除。 |
| `BlockedUserList.tsx` | ブロック一覧。解除ボタン。 |
| `MuteButton.tsx` | ミュート/ミュート解除。 |
| `MutedUserList.tsx` | ミュート一覧。 |
| `DeleteAccountButton.tsx` | アカウント削除。確認ダイアログ後に `deleteAccount` を呼ぶ。 |

---

## notification/ — 通知

| ファイル | 役割・解説 |
|----------|------------|
| `NotificationList.tsx` | 通知一覧。`getNotifications` の結果を表示。 |
| `NotificationItem.tsx` | 1 件の通知。種別（いいね・コメント・フォロー等）に応じた文言・リンク。 |
| `NotificationBadge.tsx` | 未読通知数のバッジ。ヘッダー等に表示。 |

---

## message/ — DM

| ファイル | 役割・解説 |
|----------|------------|
| `MessageList.tsx` | 会話内のメッセージ一覧。`getMessages` の結果。 |
| `MessageForm.tsx` | メッセージ入力・送信。`sendMessage`。 |
| `MessageButton.tsx` | ユーザーカード等に表示する「メッセージ」ボタン。会話作成または既存会話へ遷移。 |
| `MessageBadge.tsx` | 未読 DM 数のバッジ。 |

---

## search/ — 検索

| ファイル | 役割・解説 |
|----------|------------|
| `SearchBar.tsx` | 検索入力欄。デバウンスして検索 API または Action を呼ぶ。 |
| `SearchResults.tsx` | 検索結果の表示。投稿・ユーザー・ハッシュタグのタブ切替。 |
| `SearchTabs.tsx` | 投稿/ユーザー/ハッシュタグのタブ。 |
| `AdvancedSearchFilters.tsx` | ジャンル・日付等のフィルタ。 |
| `GenreFilter.tsx` | ジャンルでフィルタする UI。 |

---

## shop/ — 盆栽園

| ファイル | 役割・解説 |
|----------|------------|
| `Map.tsx` | Leaflet 地図。盆栽園のマーカー表示。 |
| `MapWrapper.tsx` | 地図のラッパー。`next/dynamic` で Map を ssr: false で読み込む。 |
| `ShopList.tsx` | 盆栽園一覧。 |
| `ShopCard.tsx` | 1 件の盆栽園カード。名前・住所・評価・リンク。 |
| `ShopForm.tsx` | 盆栽園の登録/編集フォーム。住所・名前・営業時間・ジャンル等。 |
| `ShopSearchForm.tsx` | 盆栽園検索（住所・キーワード）。 |
| `ShopActions.tsx` | 盆栽園の操作メニュー（編集・変更リクエスト等）。 |
| `ReviewList.tsx` | レビュー一覧。 |
| `ReviewCard.tsx` | 1 件のレビュー表示。 |
| `ReviewForm.tsx` | レビュー投稿フォーム。星評価・本文・画像。 |
| `StarRating.tsx` | 星 5 段階の表示・入力。 |
| `BusinessHoursInput.tsx` | 営業時間の入力。 |
| `ShopGenreEditor.tsx` | 盆栽園のジャンル編集。 |
| `ShopChangeRequestForm.tsx` | 住所等の変更リクエストを管理者に送るフォーム。 |

---

## bonsai/ — 盆栽成長記録

| ファイル | 役割・解説 |
|----------|------------|
| `BonsaiForm.tsx` | 盆栽の登録/編集フォーム。名前・種類・開始年・メモ。 |
| `BonsaiListClient.tsx` | 盆栽一覧のクライアント表示。検索・フィルタ。 |
| `BonsaiSearch.tsx` | 盆栽検索。投稿フォームで盆栽を紐付けるときに使用。 |
| `BonsaiTimeline.tsx` | 成長記録のタイムライン表示。 |
| `BonsaiRecordForm.tsx` | 成長記録の追加フォーム。日付・メモ・画像。 |
| `BonsaiActions.tsx` | 盆栽の操作メニュー（編集・削除）。 |

---

## event/ — イベント

| ファイル | 役割・解説 |
|----------|------------|
| `EventCalendar.tsx` | カレンダー表示。日付クリックでイベント一覧。 |
| `EventCalendarWrapper.tsx` | カレンダーのラッパー。動的インポート（ssr: false）で Leaflet 等の依存を避ける。 |
| `EventList.tsx` | イベント一覧。 |
| `EventCard.tsx` | 1 件のイベントカード。 |
| `EventForm.tsx` | イベントの作成/編集フォーム。タイトル・日時・場所・説明・地域。 |
| `EventActionsDropdown.tsx` | イベントの操作メニュー（編集・削除）。 |
| `DeleteEventButton.tsx` | イベント削除ボタン。 |
| `RegionFilter.tsx` | 地域（8 地方ブロック）フィルタ。 |
| `ShowPastToggle.tsx` | 過去イベントの表示/非表示トグル。 |
| `EventFilterPersistence.tsx` | フィルタ状態を URL や localStorage に永続化。 |

---

## analytics/ — アナリティクス

| ファイル | 役割・解説 |
|----------|------------|
| `AnalyticsDashboard.tsx` | アナリティクス全体。期間選択・各種グラフを配置。 |
| `StatCard.tsx` | 単一の統計値カード。 |
| `LikeChart.tsx` | いいね数推移の折れ線グラフ。recharts 使用。 |
| `TimeHeatmap.tsx` | 投稿時間帯のヒートマップ。 |
| `KeywordCloud.tsx` | キーワードクラウド表示。 |
| `QuoteList.tsx` | 引用された投稿一覧。 |
| `WebVitals.tsx` | Core Web Vitals の計測・表示。 |

---

## subscription/ — プレミアム

| ファイル | 役割・解説 |
|----------|------------|
| `SubscriptionStatus.tsx` | プレミアム状態・期限の表示。 |
| `PricingCard.tsx` | 料金プランカード。チェックアウトリンク。 |
| `PaymentHistory.tsx` | 支払い履歴一覧。Stripe のデータを表示。 |
| `PremiumBadge.tsx` | プレミアムバッジ。ユーザー名横に表示。 |
| `PremiumUpgradeCard.tsx` | アップグレード案内カード。 |

---

## auth/ — 認証 UI

| ファイル | 役割・解説 |
|----------|------------|
| `LoginForm.tsx` | ログインフォーム。`signIn('credentials', ...)`。 |
| `RegisterForm.tsx` | 登録フォーム。メール・パスワード・ニックネーム。登録 Action を呼ぶ。 |
| `LogoutButton.tsx` | ログアウト。`signOut()`。 |
| `PasswordResetForm.tsx` | パスワードリセット要求。メール送信。 |
| `PasswordResetConfirmForm.tsx` | トークン付きで新パスワードを送信。 |

---

## settings/ — 設定

| ファイル | 役割・解説 |
|----------|------------|
| `NotificationPreferences.tsx` | 通知種別ごとの ON/OFF。`getNotificationPreferences` / `updateNotificationPreferences`。 |
| `TwoFactorSettings.tsx` | 2 段階認証の有効化・無効化。QR 表示・コード入力。 |

---

## report/ — 通報

| ファイル | 役割・解説 |
|----------|------------|
| `ReportButton.tsx` | 通報を開くトリガー。 |
| `ReportModal.tsx` | 通報理由選択・詳細入力。`createReport` を呼ぶ。 |

---

## contact/ — お問い合わせ

| ファイル | 役割・解説 |
|----------|------------|
| `ContactForm.tsx` | お問い合わせフォーム。件名・本文。`submitContact`。 |

---

## common/ — 共通

| ファイル | 役割・解説 |
|----------|------------|
| `PageError.tsx` | ページエラー表示。`error.tsx` から利用。再試行ボタン。 |
| `FormError.tsx` | フォームのエラーメッセージ表示。 |
| `LoadingScreen.tsx` | 全画面ローディング。 |
| `MentionTextarea.tsx` | @メンション対応のテキストエリア。候補表示・挿入。 |
| `OptimizedImage.tsx` | next/image をラップ。サイズ・priority 等を統一。 |
| `Breadcrumb.tsx` | パンくずリスト。JSON-LD 構造化データを出力する場合あり。 |
| `SkipLink.tsx` | アクセシビリティ用スキップリンク。 |
| `KeyboardShortcutsProvider.tsx` | グローバルキーボードショートカット（/検索、n 投稿等）を提供。 |
| `KeyboardShortcutsHelp.tsx` | ショートカット一覧モーダル。 |
| `index.ts` | common の re-export。 |

---

## ads/ — 広告

| ファイル | 役割・解説 |
|----------|------------|
| `AdProvider.tsx` | 広告スクリプトの読み込み管理。 |
| `AdBanner.tsx` | インフィード広告バナー。タイムラインに挿入。 |
| `GoogleAdSense.tsx` | Google AdSense コンポーネント。 |
| `NinjaAdMax.tsx` | 忍者 AdMax 用コンポーネント。 |
| `index.ts` | ads の re-export。 |

---

## theme/ — テーマ

| ファイル | 役割・解説 |
|----------|------------|
| `ThemeProvider.tsx` | ダーク/ライトテーマの Context。 |
| `ThemeToggle.tsx` | テーマ切替トグル。 |

---

## pwa/ — PWA

| ファイル | 役割・解説 |
|----------|------------|
| `ServiceWorkerRegistration.tsx` | Service Worker の登録・更新検知・オフライン表示。`public/sw.js` を登録。 |

---

## seo/ — SEO

| ファイル | 役割・解説 |
|----------|------------|
| `JsonLd.tsx` | JSON-LD 構造化データ。記事・組織等のスキーマを出力。 |

---

## ui/ — shadcn/ui 基盤

| ファイル | 役割・解説 |
|----------|------------|
| `button.tsx` | ボタン。variant（default, destructive 等）・size。 |
| `input.tsx` | テキスト入力。 |
| `textarea.tsx` | 複数行入力。 |
| `label.tsx` | フォームラベル。 |
| `card.tsx` | カードコンテナ。 |
| `badge.tsx` | バッジ。 |
| `avatar.tsx` | アバター画像。 |
| `dialog.tsx` | モーダルダイアログ。 |
| `alert-dialog.tsx` | 確認ダイアログ。 |
| `alert.tsx` | アラート表示。 |
| `dropdown-menu.tsx` | ドロップダウンメニュー。 |
| `tabs.tsx` | タブ。 |
| `switch.tsx` | スイッチトグル。 |
| `tooltip.tsx` | ツールチップ。 |
| `toaster.tsx` | トースト表示。useToast と連携。 |
| `AnalogClockPicker.tsx` | アナログ時計型の時刻ピッカー。予約投稿の時刻選択等。 |

---

以上が `components/` の全ファイルの解説です。  
各コンポーネントがどの Server Action や API を呼ぶかは [02_lib_actions.md](./02_lib_actions.md) と [03_app.md](./03_app.md) を参照してください。
