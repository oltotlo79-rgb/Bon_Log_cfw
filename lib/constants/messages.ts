/**
 * クライアント UI メッセージ定数
 *
 * toast / setError / alert 等で表示するメッセージを一元管理する。
 * Server Action のエラーメッセージは `lib/constants/errors` を使用し、
 * このファイルは Client Component 側の UI フィードバック専用。
 *
 * 命名規則:
 * - MSG_XXX_SUCCESS: 成功通知
 * - MSG_XXX_FAILED:  失敗通知
 * - MSG_XXX_REQUIRED: 入力必須
 * - 動的部分はテンプレート関数
 *
 * @module lib/constants/messages
 */

// 汎用
/** toast や Alert のタイトルとして使う短いラベル */
export const MSG_ERROR_TITLE = 'エラー'
/** サーバーから error 文字列が返らない場合のフォールバック（短い汎用文言） */
export const MSG_ERROR_FALLBACK = 'エラー'
/** 明示的にエラーが発生したケースで UI に表示するメッセージ */
export const MSG_GENERIC_ERROR = 'エラーが発生しました'
export const MSG_NETWORK_ERROR = 'ネットワークエラーが発生しました'
export const MSG_RETRY_LATER = '再度お試しください'
export const MSG_RETRY_AFTER_WAIT = 'しばらく経ってから再度お試しください'

// 投稿
export const MSG_POST_SUCCESS = '投稿しました'
export const MSG_POST_FAILED = '投稿に失敗しました'
export const MSG_POST_DELETED = '投稿を削除しました'
export const MSG_POST_DELETE_FAILED = '投稿の削除に失敗しました。再度お試しください'
export const MSG_POST_CONFIRM_DISCARD = '入力内容が破棄されます。閉じてもよろしいですか？'
export const MSG_POST_CHARACTER_OVERFLOW = (over: number) => `文字数が${over}文字超過しています`

// 下書き
export const MSG_DRAFT_SAVE_FAILED = '下書きの保存に失敗しました'
export const MSG_DRAFT_DELETE_FAILED = '削除に失敗しました'
export const MSG_DRAFT_POST_FAILED = '投稿に失敗しました'

// 予約投稿
export const MSG_SCHEDULED_DATE_REQUIRED = '予約日時を指定してください'
export const MSG_SCHEDULED_DATE_FUTURE_REQUIRED = '予約日時は未来の日時を指定してください'

// いいね / ブックマーク
export const MSG_LIKE_FAILED = 'いいねに失敗しました。再度お試しください'
export const MSG_LIKE_ADDED = 'いいねしました'
export const MSG_LIKE_REMOVED = 'いいねを取り消しました'
export const MSG_BOOKMARK_FAILED = 'ブックマークに失敗しました。再度お試しください'
export const MSG_BOOKMARK_ADDED = 'ブックマークに追加しました'
export const MSG_BOOKMARK_REMOVED = 'ブックマークを解除しました'

// 盆栽
export const MSG_BONSAI_DELETE_FAILED = '削除に失敗しました'

// ブロック / ミュート
export const MSG_BLOCK_ADDED_TITLE = 'ブロックしました'
export const MSG_BLOCK_ADDED_DESCRIPTION = (nickname: string) => `${nickname}さんをブロックしました`
export const MSG_BLOCK_REMOVED_TITLE = 'ブロックを解除しました'
export const MSG_BLOCK_REMOVED_DESCRIPTION = (nickname: string) => `${nickname}さんのブロックを解除しました`
export const MSG_MUTE_REMOVED_TITLE = 'ミュートを解除しました'
export const MSG_MUTE_REMOVED_DESCRIPTION = (nickname: string) => `${nickname}さんのミュートを解除しました`

// フォロー
export const MSG_FOLLOW_REQUEST_PENDING = '相手の承認をお待ちください'
export const MSG_FOLLOW_REQUEST_SENT = 'リクエストを送信しました'
export const MSG_FOLLOW_REQUEST_CANCELED = 'リクエストをキャンセルしました'

// 認証
export const MSG_AUTH_NOT_FOUND = '認証情報が見つかりません。もう一度ログインしてください。'
export const MSG_AUTH_ERROR = '認証中にエラーが発生しました。再度お試しください。'
export const MSG_TERMS_AGREEMENT_REQUIRED = '利用規約とプライバシーポリシーに同意してください'

// プッシュ通知
export const MSG_PUSH_ENABLED = 'プッシュ通知をONにしました'
export const MSG_PUSH_DISABLED = 'プッシュ通知をOFFにしました'
export const MSG_PUSH_SETTING_FAILED = 'プッシュ通知の設定に失敗しました'
export const MSG_PUSH_REGISTER_FAILED = 'プッシュ通知の登録に失敗しました'
export const MSG_PUSH_PERMISSION_REQUIRED_TITLE = '通知の許可が必要です'
export const MSG_PUSH_PERMISSION_REQUIRED_DESCRIPTION = 'ブラウザの設定から通知を許可してください'

// 位置情報
export const MSG_GEO_NOT_SUPPORTED = 'お使いのブラウザは位置情報に対応していません'
export const MSG_GEO_CONVERT_FAILED = '位置情報の変換に失敗しました'
export const MSG_GEO_JAPAN_REQUIRED = '日本国内の位置を取得できませんでした'
export const MSG_GEO_REGISTERED = '位置情報を登録しました'
export const MSG_GEO_ERROR = '位置情報の取得中にエラーが発生しました'
export const MSG_GEO_PERMISSION_REQUIRED_TITLE = '位置情報の許可が必要です'
export const MSG_GEO_PERMISSION_REQUIRED_DESCRIPTION = 'ブラウザの設定から位置情報を許可してください'
export const MSG_GEO_FETCH_FAILED = '位置情報の取得に失敗しました'
export const MSG_GEO_FETCH_FAILED_DESCRIPTION = 'しばらく経ってから再度お試しください'
export const MSG_GEO_SAVE_FAILED = '位置情報の保存に失敗しました'
export const MSG_GEO_REMOVED = '位置情報を削除しました'
export const MSG_GEO_FETCH_DENIED_TITLE = '位置情報を取得できませんでした'
export const MSG_GEO_FETCH_DENIED_DESCRIPTION = 'ブラウザの設定で位置情報の使用を許可してください'
export const MSG_PREFECTURE_REQUIRED = '都道府県を選択してください'
export const MSG_CITY_REQUIRED = '市区町村を入力してください'

// 住所 / ジオコーディング
export const MSG_ADDRESS_REQUIRED = '住所を入力してください'
export const MSG_ADDRESS_NOT_FOUND = '住所が見つかりませんでした。住所の表記を確認してください（例: 東京都渋谷区...）'

// 盆栽園変更申請
export const MSG_SHOP_CHANGE_REQUIRED = '変更内容を選択し、現在の値と異なる内容を入力してください'

// レビュー
export const MSG_REVIEW_RATING_REQUIRED = '評価を選択してください'
export const MSG_REVIEW_IMAGE_LIMIT = (max: number) => `画像は${max}枚までです`
export const MSG_IMAGE_SIZE_LIMIT = (maxMB: number, actualMB: number, name?: string) =>
  name
    ? `画像は${maxMB}MB以下にしてください（${name}: ${actualMB.toFixed(1)}MB）`
    : `画像は${maxMB}MB以下にしてください（現在: ${actualMB.toFixed(1)}MB）`

// お問い合わせ
export const MSG_CONTACT_EMAIL_REQUIRED = 'メールアドレスを入力してください'
export const MSG_CONTACT_EMAIL_INVALID = '有効なメールアドレスを入力してください'
export const MSG_CONTACT_CATEGORY_REQUIRED = 'カテゴリを選択してください'
export const MSG_CONTACT_SUBJECT_REQUIRED = '件名を入力してください'
export const MSG_CONTACT_MESSAGE_REQUIRED = 'お問い合わせ内容を入力してください'
export const MSG_CONTACT_MESSAGE_MIN_LENGTH = (min: number) => `お問い合わせ内容は${min}文字以上で入力してください`
export const MSG_CONTACT_SEND_FAILED = '送信に失敗しました。しばらく経ってからお試しください。'

// アップロード
export const MSG_UPLOAD_FAILED = 'アップロードに失敗しました'

// コメント
export const MSG_COMMENT_DELETED = '削除されたコメントです'

// ログインフォーム固有（ERR_* と重複しない UI 専用）
export const MSG_LOGIN_ERROR = 'ログイン中にエラーが発生しました。再度お試しください。'
export const MSG_2FA_AUTH_ERROR = '認証中にエラーが発生しました。再度お試しください。'
export const MSG_LOGIN_FAILED_RETRY = 'ログインに失敗しました。もう一度お試しください。'
export const MSG_LOGIN_RATE_LIMITED = 'ログイン試行回数の上限に達しました。しばらく待ってから再試行してください。'
export const MSG_LOGIN_DEVICE_NOT_ALLOWED = 'このデバイスからのログインは許可されていません'
export const MSG_PASSWORD_MISMATCH = 'パスワードが一致しません'
export const MSG_VERIFICATION_EMAIL_RESENT = '確認メールを再送しました。メールをご確認ください。'

// 画像アップロード
export const MSG_IMAGE_ONLY = '画像ファイルを選択してください'

// 投稿フォーム固有
export const MSG_POST_CONTENT_REQUIRED = 'テキストまたは画像を入力してください'
export const MSG_DRAFT_PUBLISH_CONFIRM = 'この下書きを投稿しますか？'


