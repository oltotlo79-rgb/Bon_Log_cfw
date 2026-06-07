/**
 * 広告表示に関する定数
 *
 * リスト型ページへの In-feed 広告挿入間隔とページあたりの上限を集約。
 *
 * @module lib/constants/limits/ads
 */

/** タイムラインの広告挿入間隔 */
export const TIMELINE_AD_INTERVAL = 5

/** 検索結果の広告挿入間隔 */
export const SEARCH_AD_INTERVAL = 5

/** プロフィール投稿タブの広告挿入間隔 */
export const PROFILE_POSTS_AD_INTERVAL = 10

/** イベント一覧の広告挿入間隔（項目数の少ない一覧のため低頻度にする） */
export const EVENTS_AD_INTERVAL = 20

/** 盆栽園一覧の広告挿入間隔（項目数の少ない一覧のため低頻度にする） */
export const SHOPS_AD_INTERVAL = 20

/**
 * 1 ページあたりの In-feed 広告最大本数。
 * UX・CLS・CWV 悪化防止と AdSense ポリシー配慮のため上限を設ける。
 */
export const MAX_IN_FEED_ADS_PER_PAGE = 3
