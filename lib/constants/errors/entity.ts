/**
 * エンティティ Not Found・権限・CRUD失敗・検索関連のエラーメッセージ
 *
 * @module lib/constants/errors/entity
 */

/** 対象が見つからないエラー */
export const ERR_USER_NOT_FOUND = 'ユーザーが見つかりません'
export const ERR_POST_NOT_FOUND = '投稿が見つかりません'
export const ERR_COMMENT_NOT_FOUND = 'コメントが見つかりません'
export const ERR_EVENT_NOT_FOUND = 'イベントが見つかりません'
export const ERR_SHOP_NOT_FOUND = '盆栽園が見つかりません'
export const ERR_REVIEW_NOT_FOUND = 'レビューが見つかりません'
export const ERR_DRAFT_NOT_FOUND = '下書きが見つかりません'

/** 権限エラー */
export const ERR_PERMISSION_DENIED = '削除権限がありません'
export const ERR_EDIT_PERMISSION_DENIED = '編集権限がありません'
export const ERR_ADMIN_REQUIRED = '管理者権限が必要です'

/** ユーザー */
export const ERR_ACCOUNT_DELETE_FAILED = 'アカウントの削除に失敗しました'
export const ERR_USER_FETCH_FAILED = 'ユーザー情報の取得に失敗しました'
export const ERR_USER_ID_REQUIRED = 'ユーザーIDを指定してください'

/** 盆栽管理 */
export const ERR_INVALID_BONSAI_ID = '無効な盆栽IDです'
export const ERR_BONSAI_SEARCH_QUERY_TOO_LONG = '検索キーワードが長すぎます'
export const ERR_BONSAI_NOT_FOUND = '盆栽が見つかりません'
export const ERR_BONSAI_LIST_FAILED = '盆栽一覧の取得に失敗しました'
export const ERR_BONSAI_GET_FAILED = '盆栽の取得に失敗しました'
export const ERR_BONSAI_CREATE_FAILED = '盆栽の登録に失敗しました'
export const ERR_BONSAI_UPDATE_FAILED = '盆栽の更新に失敗しました'
export const ERR_BONSAI_DELETE_FAILED = '盆栽の削除に失敗しました'
export const ERR_BONSAI_SEARCH_FAILED = '盆栽の検索に失敗しました'
export const ERR_BONSAI_RECORD_NOT_FOUND = '成長記録が見つかりません'
export const ERR_BONSAI_RECORD_LIST_FAILED = '成長記録の取得に失敗しました'
export const ERR_BONSAI_RECORD_CREATE_FAILED = '成長記録の追加に失敗しました'
export const ERR_BONSAI_RECORD_UPDATE_FAILED = '成長記録の更新に失敗しました'
export const ERR_BONSAI_RECORD_DELETE_FAILED = '成長記録の削除に失敗しました'

/** 盆栽手入れログ（カレンダー用） */
export const ERR_CARE_LOG_NOT_FOUND = '手入れ記録が見つかりません'
export const ERR_CARE_LOG_CREATE_FAILED = '手入れ記録の追加に失敗しました'
export const ERR_CARE_LOG_UPDATE_FAILED = '手入れ記録の更新に失敗しました'
export const ERR_CARE_LOG_DELETE_FAILED = '手入れ記録の削除に失敗しました'
export const ERR_CARE_LOG_LIST_FAILED = '手入れ記録の取得に失敗しました'
export const ERR_CARE_LOG_FUTURE_DATE = '未来の日時は記録できません'
export const ERR_CARE_LOG_RANGE_TOO_LARGE = '取得期間が長すぎます'
export const ERR_CARE_LOG_INVALID_MODE = '無効な表示モードです'
export const ERR_CARE_LOG_INVALID_ANCHOR = '無効な基準月です'

/** 検索 */
export const ERR_SEARCH_QUERY_TOO_LONG = '検索クエリが長すぎます'
export const ERR_SEARCH_RATE_LIMIT = '検索リクエストが多すぎます。しばらく待ってから再試行してください'

/** 分析 */
export const ERR_PREMIUM_ONLY = 'プレミアム会員限定機能です'
export const ERR_ANALYTICS_FETCH_FAILED = '分析データの取得に失敗しました'

/** 削除汎用 */
export const ERR_DELETE_FAILED = '削除に失敗しました'
