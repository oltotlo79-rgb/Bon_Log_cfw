/**
 * イベント関連の制限値・しきい値
 *
 * @module lib/constants/limits/event
 */

/**
 * イベントタイトル類似度比較に使用する先頭文字数。
 *
 * インポート時の重複検出で「先頭 N 文字一致」を類似と判定する。
 * 短すぎると無関係なイベントを類似扱いし、長すぎると年号違いの同一展示会を
 * 別物と誤判定するため、和文タイトルでバランスの良い 10 文字とする。
 */
export const EVENT_TITLE_SIMILARITY_PREFIX_LENGTH = 10

/** スクレイピングイベントの説明文の最大文字数（外部サイト由来の長文入力への保護的上限）。 */
export const MAX_EVENT_DESCRIPTION_LENGTH = 5000

/** イベントの地域・会場・主催者等、汎用フィールドの最大文字数。 */
export const MAX_EVENT_FIELD_LENGTH = 200

/** イベント外部リンク（URL）の最大文字数。 */
export const MAX_EVENT_URL_LENGTH = 2000

/** 1 回のインポート API 呼び出しで受け付けるイベント件数の上限（DoS / OOM 防止）。 */
export const MAX_IMPORT_EVENTS_COUNT = 200
