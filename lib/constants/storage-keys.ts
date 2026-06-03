/**
 * localStorage / sessionStorage キー定数
 *
 * アプリケーション全体で使用するストレージキーを一元管理。
 * キーの重複やタイポを防止する。
 *
 * @module lib/constants/storage-keys
 */

/** テーマ設定 */
export const STORAGE_KEY_THEME = 'theme'

/** 最近の検索履歴 */
export const STORAGE_KEY_RECENT_SEARCHES = 'bonsai-sns-recent-searches'

/** イベントフィルター設定 */
export const STORAGE_KEY_EVENT_FILTER = 'event-filter-settings'

/**
 * dismiss 済みのお知らせ ID 集合 (JSON エンコードされた string[])。
 * 同じ ID のお知らせは閉じた後は再表示されないが、新規お知らせは表示される。
 */
export const STORAGE_KEY_DISMISSED_ANNOUNCEMENTS = 'dismissed-announcements'
