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
