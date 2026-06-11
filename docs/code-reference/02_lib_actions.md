# lib/actions/ 全ファイル解説

Server Actions はすべて `'use server'` で宣言され、認証・レート制限・バリデーションのあと Prisma で DB 操作し、`{ success, data }` または `{ error }` を返します。  
共通の認証は [utils.ts](#utils) の `requireAuth` / `requireActiveUser` / `requireAdmin` を参照してください。

---

## utils.ts

**役割**: 全 Action で使う認証・管理者チェック・IP 取得。

- **ActionResult&lt;T&gt;**  
  `{ success: true; data?: T } | { success: false; error: string }`。  
  （`types/action-result.ts` の `ok`/`data` 形式と併存。新規は `actionSuccess`/`actionError` 推奨。）
- **requireAuth()**  
  `auth()` でセッション取得。未認証なら `{ error: ERR_AUTH_REQUIRED }`、否則 `{ userId }`。
- **requireActiveUser(rateLimitAction)**  
  認証 → アカウント停止チェック（`user.isSuspended`）→ レート制限（`checkUserRateLimit`）。  
  投稿・コメント等の書き込みで利用。
- **requireAdmin()**  
  `requireAuth` のあと `adminUser` を取得。管理者でなければ `{ error: ERR_ADMIN_REQUIRED }`。
- **getClientIp()**  
  `headers()` から `cf-connecting-ip` / `x-forwarded-for` / `x-real-ip` を取得。

---

## auth.ts

**役割**: ユーザー登録、パスワードリセット要求・実行、メール確認。

- 登録: メール重複チェック → bcrypt ハッシュ → `prisma.user.create`。メール確認トークン発行・送信。
- パスワードリセット: トークン検証 → 新パスワードのバリデーション → ハッシュ更新。
- メール確認: トークンでユーザーを特定し、メール確認済みフラグを更新。

---

## post.ts

**役割**: 投稿の作成・削除・取得、引用投稿、リポスト、メディア付き投稿、投票付き投稿。

- **createPost(formData)**  
  `requireActiveUser('post')` → zod で content / genreIds / mediaUrls / mediaTypes / bonsaiId / pollOptions / pollDuration をパース。  
  プレミアム制限（文字数・画像数・動画数・日次投稿数）をチェック。  
  投票がある場合は選択肢・期間のバリデーション。  
  `sanitizePostContent`、ジャンル・メディア・投票を紐付けて `prisma.post.create`。  
  ハッシュタグは `attachHashtagsToPost`、メンションは `notifyMentionedUsers`。  
  `revalidatePath` でキャッシュ更新。
- **deletePost(postId)**  
  投稿のオーナーまたは管理者のみ削除可能。関連（いいね・コメント・メディア等）は onDelete で削除。
- **getPost(id)**  
  単一投稿取得。ユーザー・メディア・ジャンル・いいね数・コメント数・自分がいいね/ブックマーク済みか等を include。
- **createQuotePost(formData)**  
  引用元 postId と本文で引用投稿を作成。
- **repost(postId)**  
  リポスト用の投稿（repostPostId 参照）を作成。重複リポストは禁止。
- その他: メディア URL の保存、プレミアム制限に応じた上限チェック。

---

## feed.ts

**役割**: タイムライン取得（フォロー投稿のみ / 全体）。

- **getFeed(cursor, limit, followOnly?)**  
  認証必須。`followOnly` が true のときはフォロー中のユーザーの投稿のみ。  
  カーソルベースページネーションで `orderBy: { createdAt: 'desc' }`。  
  投稿にユーザー・メディア・ジャンル・_count（likes, comments）・当前ユーザーの like/bookmark を include。

---

## comment.ts

**役割**: コメント作成・削除・一覧取得。

- **createComment(formData)**  
  `requireActiveUser` → 日次コメント上限チェック → 本文・メディア・parentId（スレッド）のバリデーション → `prisma.comment.create`。メンション通知。
- **deleteComment(commentId)**  
  オーナーまたは管理者のみ削除可能。
- **getComments(postId, cursor)**  
  投稿に紐づくコメントを親子構造で取得。ページネーション対応。

---

## like.ts

**役割**: 投稿・コメントへのいいね付け・外し。

- **togglePostLike(postId)**  
  既に like があれば削除、なければ `prisma.like.create`。投稿の like 数はリレーションの _count で取得。
- **toggleCommentLike(commentId)**  
  同様にコメントへの like をトグル。

---

## bookmark.ts

**役割**: ブックマーク追加・削除・一覧。

- **addBookmark(postId)** / **removeBookmark(postId)**  
  `prisma.bookmark.create` / `delete`。重複は unique 制約でエラーになるため存在チェックしてから実行。
- **getBookmarks(cursor)**  
  当前ユーザーのブックマーク投稿一覧。投稿・ユーザー・メディアを include。

---

## follow.ts

**役割**: フォロー・アンフォロー。

- **follow(userId)** / **unfollow(userId)**  
  自分自身は不可。非公開アカウントの場合はフォローせず、フォローリクエスト用のメッセージを返す（実際のリクエスト送信は follow-request.ts）。
- **getFollowStats(userId)**  
  フォロワー数・フォロー数を返す。

---

## follow-request.ts

**役割**: 非公開アカウント向けのフォローリクエスト送信・承認・拒否。

- **sendFollowRequest(targetUserId)**  
  対象が非公開なら `follow_request` レコードを作成。通知を送る。
- **acceptFollowRequest(requestId)** / **rejectFollowRequest(requestId)**  
  対象のフォローリクエストを承認すると follow が作成され、拒否すると削除または拒否フラグ。

---

## user.ts

**役割**: プロフィール取得・更新、アカウント削除。

- **getUser(id)**  
  公開ユーザーまたは自分/フォロー中なら詳細を返す。非公開かつ未フォローなら最小限の情報のみ。
- **updateProfile(formData)**  
  ニックネーム・自己紹介・居住地・公開/非公開を更新。
- **updateAvatar** / **updateHeader**  
  アバター・ヘッダー画像の URL を更新（アップロードは API で実施）。
- **deleteAccount**  
  本人確認後、ユーザー削除（関連データは cascade で削除）。

---

## notification.ts

**役割**: 通知一覧取得・既読化。

- **getNotifications(cursor)**  
  当前ユーザー向けの通知を新しい順で取得。actor（通知を起こしたユーザー）を include。
- **markNotificationsRead()**  
  未読通知を一括で既読に更新。

---

## notification-preferences.ts

**役割**: 通知設定の取得・更新。

- **getNotificationPreferences()**  
  当前ユーザーの通知種別ごとの ON/OFF を返す。
- **updateNotificationPreferences(formData)**  
  各種別の設定を DB に保存。

---

## message.ts

**役割**: DM の会話一覧・メッセージ送信・会話内メッセージ取得。

- **getConversations()**  
  当前ユーザーが参加する会話一覧。最新メッセージ・未読数を含む。
- **getMessages(conversationId, cursor)**  
  指定会話のメッセージを古い順で取得。
- **sendMessage(conversationId, content)**  
  または新規会話の場合は相手 userId を指定してメッセージ作成。日次送信上限チェックあり。

---

## mention.ts

**役割**: 投稿・コメント内の @メンションから通知を作成。

- **notifyMentionedUsers(content, actorId, postId?, commentId?)**  
  `mention-utils` でメンションされたユーザーを抽出し、自分とブロック関係を除いて通知レコードを作成。

---

## hashtag.ts

**役割**: ハッシュタグと投稿の紐付け。

- **attachHashtagsToPost(postId, content)**  
  本文から `#タグ` を抽出し、既存または新規の Hashtag と PostHashtag を作成。
- **detachHashtagsFromPost(postId)**  
  投稿に紐づく PostHashtag を削除（投稿削除時など）。

---

## search.ts

**役割**: 投稿・ユーザー・ハッシュタグの検索。

- **searchPosts(query, cursor)** / **searchUsers(query, cursor)** / **searchHashtags(query, cursor)**  
  検索クエリを `lib/search/fulltext.ts` や LIKE で検索。公開ユーザー・非ブロック等の条件を付与。
- **searchShops**  
  盆栽園の検索（住所・名前等）。別途 `lib/actions/shop.ts` と連携する場合あり。

---

## draft.ts

**役割**: 下書きの作成・更新・削除・一覧取得。

- **createDraft** / **updateDraft** / **deleteDraft** / **getDrafts**  
  当前ユーザーの下書きのみ操作。本文・メディア・ジャンルを保存。  
  投稿作成時に「下書きから」で内容を引き継ぐ。

---

## scheduled-post.ts

**役割**: 予約投稿の CRUD（実装は `scheduled-post-crud.ts`、`scheduled-post.ts` はバレル再エクスポート）。

- **createScheduledPost** / **updateScheduledPost** / **deleteScheduledPost** / **getScheduledPosts**  
  公開予定日時（scheduledAt）と本文・メディア等を保存。  
  件数上限（MAX_PENDING_SCHEDULED_POSTS）と予約日数上限（MAX_SCHEDULED_DAYS_AHEAD）をチェック。
- 公開時刻到達時の公開処理は Server Action ではなく `lib/services/scheduled-post-publisher.ts` の  
  **publishDueScheduledPosts()** に一本化。Cron（`/api/cron/publish-scheduled`、GitHub Actions が 5 分毎に起動）から呼ばれ、  
  `scheduledAt <= now` の pending をバッチで取得して通常の `Post` として作成し、予約レコードのステータスを published（失敗時 failed）に更新。

---

## poll.ts

**役割**: 投稿に紐づく投票の作成・投票実行・結果取得。

- **createPoll(postId, options, durationSeconds)**  
  投稿作成時にオプションと期間を渡し、Poll と PollOption を作成。
- **votePoll(pollId, optionId)**  
  1 ユーザー 1 投票。既に投票済みの場合はエラー。PollVote を作成。
- **getPollResult(pollId)**  
  各選択肢の得票数を返す。投票期間中か終了後かで表示を分けるのは UI 側。

---

## bonsai.ts

**役割**: 盆栽と成長記録の CRUD。

- **createBonsai** / **updateBonsai** / **deleteBonsai** / **getBonsai** / **getBonsaiList**  
  盆栽の名前・種類・開始年・メモ等を管理。当前ユーザー所有のみ操作可能。
- **addBonsaiRecord** / **getBonsaiRecords**  
  成長記録（日付・メモ・画像）を盆栽に紐付けて追加・一覧取得。

---

## shop.ts

**役割**: 盆栽園の CRUD、検索、レビュー、変更リクエスト。

- **createShop** / **updateShop** / **getShop** / **getShops**  
  住所・名前・営業時間・ジャンル等。同一住所の重複登録はエラー（ERR_SHOP_DUPLICATE_ADDRESS）。
- **searchShops**  
  住所・キーワードで検索。地図表示用の緯度経度も返す。
- **createReview** / **deleteReview** / **getShopReviews**  
  盆栽園への星評価・本文・画像。レビュー数・画像数は limits で制限。
- **requestShopChange**  
  住所変更等のリクエストを管理者用テーブルに保存。管理者が承認すると shop が更新される。

---

## review.ts

**役割**: 盆栽園レビューの作成・削除（shop.ts と重複する部分あり。実装では shop 側に含まれている場合もあり）。

- レビュー作成時は画像枚数・評価値（MIN_RATING〜MAX_RATING）をチェック。

---

## event.ts

**役割**: イベントの CRUD と一覧取得。

- **createEvent** / **updateEvent** / **deleteEvent** / **getEvent** / **getEvents**  
  タイトル・日時・場所・説明・地域。終了イベントは一覧で非表示またはフィルタ可能。
- **getUpcomingEvents**  
  今後のイベントを取得。カレンダー表示用。

---

## event-import.ts

**役割**: イベントの CSV インポート（管理画面用）。

- CSV をパースし、日付・タイトル・場所等をバリデーションして `prisma.event.create` を一括実行。重複はスキップまたは更新は実装次第。

---

## block.ts / mute.ts

**役割**: ブロック・ミュートの追加・解除・一覧。

- **block(userId)** / **unblock(userId)**  
  ブロックすると相手の投稿・通知が表示されず、DM も不可。
- **mute(userId)** / **unmute(userId)**  
  ミュートすると相手の投稿をタイムラインに表示しない。一覧取得でブロック/ミュートユーザーを除外。

---

## comment-thread-mute.ts

**役割**: コメントスレッド単位のミュート。

- 指定スレッド（親コメント）の通知を止める。`CommentThreadMute` のようなレコードで管理。

---

## report.ts

**役割**: 通報の作成と、管理者用の一覧・ステータス更新。

- **createReport(targetType, targetId, reason, detail)**  
  投稿・コメント・ユーザー等を通報。reason は constants/report の種別。
- **getReports**  
  管理者のみ。ステータス・種別でフィルタ可能。

---

## hide-post.ts

**役割**: 管理者が投稿を「非表示」にする。

- **hidePost(postId)**  
  投稿を非表示にすると、一般のタイムライン・検索に表示されなくなる。管理者の「非表示コンテンツ」一覧で復元可能。

---

## contact.ts

**役割**: お問い合わせの送信と、管理者用の一覧・返信・ステータス更新。

- **submitContact(formData)**  
  件名・本文をバリデーションし、Contact レコードを作成。メール通知する場合あり。
- **getContacts** / **updateContactStatus**  
  管理者用。

---

## blacklist.ts

**役割**: メール・デバイス（フィンガープリント）のブラックリスト追加・削除・一覧。

- 登録時・ログイン時にブラックリストを参照し、一致したら拒否。

---

## maintenance.ts

**役割**: メンテナンスモードの ON/OFF。

- **setMaintenanceMode(enabled)**  
  Redis や DB にフラグを保存。middleware が `/api/maintenance/status` を参照してメンテナンスページにリダイレクトする。

---

## subscription.ts

**役割**: Stripe によるプレミアム契約・ポータル。

- **createCheckoutSession()**  
  Stripe Checkout のセッションを作成し、URL を返す。成功時は Webhook でサブスクリプション・顧客を DB に反映。
- **createBillingPortalSession()**  
  Stripe Customer Portal の URL を返し、解約・支払い方法変更をユーザーに任せる。

---

## analytics.ts

**役割**: アナリティクスデータ取得（プレミアム機能）。

- **getAnalytics(userId, dateRange)**  
  当前ユーザーの投稿数・いいね数・引用数・時間帯別の投稿ヒートマップ・トップキーワード等を集計して返す。

---

## two-factor.ts（actions）

**役割**: 2 段階認証の有効化・無効化・検証。

- **enableTwoFactor()**  
  `lib/two-factor.ts` で秘密鍵・QR 用 URL を生成し、ユーザーに紐付けて返す。検証用コードで有効化確定。
- **disableTwoFactor(code)**  
  正しいコードまたはバックアップコードで無効化。
- **verifyTwoFactorCode(code)**  
  ログイン時の 2FA コード検証。

---

## admin.ts

**役割**: 管理者用の一括操作。

- ユーザー停止/削除、投稿削除、通報のステータス更新、お問い合わせ対応、イベント・盆栽園・レビューの承認/拒否等。  
  いずれも `requireAdmin()` のあとで実行。

---

## admin/hidden.ts

**役割**: 非表示にしたコンテンツの一覧取得・復元。

- **getHiddenContents(cursor)**  
  管理者用。非表示投稿等を一覧。
- **restorePost(postId)**  
  非表示を解除し、再度タイムラインに表示されるようにする。

---

## admin/premium.ts

**役割**: 管理者によるプレミアム会員の手動付与・解除。

- Stripe と連携している場合は整合を取る。または DB のプレミアム期限を直接更新。

---

## filter-helper.ts

**役割**: 管理画面等の一覧で使うフィルタ（日付範囲・キーワード・ステータス）のクエリ組み立て。

- 検索パラメータを Prisma の `where` に変換するヘルパーを export。

---

以上が `lib/actions/` の全ファイルの解説です。  
各関数の引数・戻り値の詳細は、該当ファイルの型定義と JSDoc を参照してください。
