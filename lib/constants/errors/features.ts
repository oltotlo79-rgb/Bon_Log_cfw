/**
 * 機能別エラーメッセージ（ショップ・レビュー・下書き・予約投稿・イベント・アンケート・通報・天気・ホルモン等）
 *
 * @module lib/constants/errors/features
 */

/** 盆栽園 */
export const ERR_SHOP_CREATE_FAILED = '盆栽園の登録に失敗しました'
export const ERR_SHOP_UPDATE_FAILED = '盆栽園の更新に失敗しました'
export const ERR_SHOP_DUPLICATE_ADDRESS = 'この住所の盆栽園は既に登録されています'
export const ERR_ADDRESS_SEARCH_FAILED = '住所の検索に失敗しました'
export const ERR_ADDRESS_PARSE_FAILED = '住所の検索結果の解析に失敗しました'
export const ERR_ADDRESS_NOT_FOUND = '住所が見つかりませんでした'
export const ERR_ADDRESS_SEARCH_ERROR = '住所の検索中にエラーが発生しました'
export const ERR_INVALID_GENRE = '無効なジャンルが含まれています'
export const ERR_REGISTRANT_CAN_EDIT = '登録者は直接編集できます'
export const ERR_CHANGE_CONTENT_REQUIRED = '変更内容を入力してください'
export const ERR_PENDING_REQUEST_EXISTS = '既に保留中のリクエストがあります。承認/却下を待ってください。'
export const ERR_REQUEST_NOT_FOUND = 'リクエストが見つかりません'
export const ERR_REQUEST_ALREADY_PROCESSED = 'このリクエストは既に処理済みです'

/** レビュー */
export const ERR_RATING_RANGE = '評価は1～5の間で選択してください'
export const ERR_REVIEW_IMAGE_LIMIT = '画像は3枚までです'
export const ERR_REVIEW_ALREADY_EXISTS = 'この盆栽園には既にレビューを投稿しています'
export const ERR_IMAGE_ONLY = '画像ファイルを選択してください'
export const ERR_IMAGE_SIZE_4MB = '画像は4MB以下にしてください'
export const ERR_REVIEW_SHOP_ID_REQUIRED = '盆栽園IDが必要です'
export const ERR_REVIEW_RATING_REQUIRED = '評価を選択してください'

/** 下書き */
export const ERR_DRAFT_FETCH_FAILED = '下書きの取得に失敗しました'
export const ERR_DRAFT_SAVE_FAILED = '下書きの保存に失敗しました'
export const ERR_DRAFT_DELETE_FAILED = '下書きの削除に失敗しました'
export const ERR_DRAFT_ID_REQUIRED = '下書きIDを指定してください'

/** 予約投稿 */
export const ERR_SCHEDULED_POST_PREMIUM_ONLY = '予約投稿は有料会員限定の機能です'
export const ERR_SCHEDULED_POST_DATE_REQUIRED = '予約日時を指定してください'
export const ERR_SCHEDULED_POST_FUTURE_REQUIRED = '予約日時は未来の日時を指定してください'
export const ERR_SCHEDULED_POST_NOT_FOUND = '予約投稿が見つかりません'
export const ERR_SCHEDULED_POST_PUBLISH_FAILED = '予約投稿の公開に失敗しました'
export const ERR_SCHEDULED_POST_ACCESS_DENIED = 'アクセス権限がありません'
export const ERR_SCHEDULED_POST_UPDATE_DENIED = '更新権限がありません'
export const ERR_SCHEDULED_POST_NOT_EDITABLE = '公開済みまたはキャンセル済みの予約投稿は編集できません'
export const ERR_SCHEDULED_POST_PUBLISHED_DELETE = '公開済みの予約投稿は削除できません'
export const ERR_CANCEL_DENIED = 'キャンセル権限がありません'
export const ERR_ONLY_SCHEDULED_CANCEL = '予約中の投稿のみキャンセルできます'
export const ERR_SCHEDULED_DATE_TOO_FAR = (days: number) => `予約日時は${days}日以内で指定してください`
export const ERR_SCHEDULED_POST_LIMIT = (max: number) => `予約投稿は${max}件までです。既存の予約を削除してください。`

/** イベント日付バリデーション */
export const ERR_INVALID_START_DATE = '開始日の形式が不正です'
export const ERR_INVALID_END_DATE = '終了日の形式が不正です'
export const ERR_END_BEFORE_START = '終了日は開始日以降を選択してください'

/** イベントインポート */
export const ERR_EVENTS_NOT_FOUND = 'イベントが見つかりませんでした'
export const ERR_SCRAPING_FAILED = 'スクレイピング中にエラーが発生しました'
export const ERR_REGION_NOT_FOUND = '指定された地方が見つかりません'
export const ERR_NO_EVENTS_SELECTED = 'インポートするイベントが選択されていません'
export const ERR_IMPORT_FAILED = 'インポート中にエラーが発生しました'

/** アンケート */
export const ERR_POLL_VOTE_FAILED = '投票に失敗しました'
export const ERR_POLL_NOT_FOUND = 'アンケートが見つかりません'
export const ERR_POLL_ENDED = 'このアンケートは終了しています'
export const ERR_POLL_INVALID_OPTION = '無効な選択肢です'
export const ERR_POLL_ALREADY_VOTED = '既に投票済みです'
export const ERR_POLL_DATA_INVALID = 'アンケートデータが不正です'
export const ERR_POLL_INVALID_DURATION = '無効な投票期間です'
export const ERR_POLL_OPTIONS_COUNT = (min: number, max: number) => `アンケートの選択肢は${min}〜${max}個で設定してください`
export const ERR_POLL_OPTION_TOO_LONG = (max: number) => `選択肢は1〜${max}文字で入力してください`

/** 通報 */
export const ERR_REPORT_TARGET_NOT_FOUND = '対象が見つかりません'
export const ERR_CANNOT_REPORT_SELF = '自分自身のコンテンツは通報できません'
export const ERR_ALREADY_REPORTED = '既に通報済みです'
export const ERR_REPORT_NOT_FOUND = '通報が見つかりません'

/** サブスクリプション */
export const ERR_ALREADY_PREMIUM = 'すでに有料会員です'
export const ERR_PRICE_NOT_FOUND = '価格設定が見つかりません'
export const ERR_SUBSCRIPTION_NOT_FOUND = 'サブスクリプション情報が見つかりません'
export const ERR_SUBSCRIPTION_CANCEL_FAILED = 'サブスクリプションのキャンセルに失敗しました'

/** お問い合わせ */
export const ERR_CONTACT_RATE_LIMIT = 'お問い合わせの送信回数が上限に達しました。しばらく経ってからお試しください。'
export const ERR_CONTACT_SEND_FAILED = '送信に失敗しました。しばらく経ってからお試しください。'
export const ERR_CONTACT_NOT_FOUND = 'お問い合わせが見つかりません'
export const ERR_INVALID_STATUS = '無効なステータスです'
export const ERR_CONTACT_NAME_REQUIRED = 'お名前を入力してください'
export const ERR_CONTACT_NAME_TOO_LONG = (max: number) => `お名前は${max}文字以内で入力してください`
export const ERR_CONTACT_EMAIL_REQUIRED = 'メールアドレスを入力してください'
export const ERR_CONTACT_EMAIL_INVALID = '有効なメールアドレスを入力してください'
export const ERR_CONTACT_CATEGORY_REQUIRED = 'カテゴリを選択してください'
export const ERR_CONTACT_SUBJECT_REQUIRED = '件名を入力してください'
export const ERR_CONTACT_SUBJECT_TOO_LONG = (max: number) => `件名は${max}文字以内で入力してください`
export const ERR_CONTACT_MESSAGE_TOO_SHORT = (min: number) => `お問い合わせ内容は${min}文字以上で入力してください`
export const ERR_CONTACT_MESSAGE_TOO_LONG = (max: number) => `お問い合わせ内容は${max}文字以内で入力してください`

/** イベント投稿フォーム */
export const ERR_EVENT_TITLE_REQUIRED = 'タイトルを入力してください'
export const ERR_EVENT_START_DATE_REQUIRED = '開始日を選択してください'
export const ERR_EVENT_PREFECTURE_REQUIRED = '都道府県を選択してください'

/** 天気アドバイス */
export const ERR_WEATHER_LOCATION_SAVE_FAILED = '天気用位置情報の保存に失敗しました'
export const ERR_WEATHER_FETCH_FAILED = '天気データの取得に失敗しました'
export const ERR_WEATHER_PREFECTURE_REQUIRED = '都道府県を選択してください'
export const ERR_WEATHER_CITY_REQUIRED = '市区町村を入力してください'

/** 盆栽園フォームのフィールドバリデーション */
export const ERR_SHOP_NAME_REQUIRED = '名称を入力してください'
export const ERR_SHOP_ADDRESS_REQUIRED = '住所を入力してください'

/** 植物ホルモンガイド */
export const ERR_HORMONE_NOT_FOUND = 'ホルモン情報が見つかりません'
export const ERR_HORMONE_FETCH_FAILED = 'ホルモンデータの取得に失敗しました'
export const ERR_HORMONE_COLUMN_NOT_FOUND = 'ホルモンコラムが見つかりません'
export const ERR_HORMONE_TECHNIQUE_FETCH_FAILED = 'ホルモン技法データの取得に失敗しました'

/** 農薬データ管理 */
export const ERR_PESTICIDE_NOT_FOUND = '農薬が見つかりません'
export const ERR_PESTICIDE_NAME_REQUIRED = '農薬名を入力してください'
