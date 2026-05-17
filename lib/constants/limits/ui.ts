/**
 * UI・タイムアウト・しきい値の制限値
 *
 * @module lib/constants/limits/ui
 */

/** コピー完了フィードバックの表示時間 */
export const TIMEOUT_COPIED_FEEDBACK = 2000

/** 成功メッセージの表示時間 */
export const TIMEOUT_SUCCESS_MESSAGE = 5000

/** 自動リダイレクトまでの待機時間 */
export const TIMEOUT_AUTO_REDIRECT = 3000

/** トースト通知の表示時間 */
export const TIMEOUT_TOAST = 3000

/** ドロップダウンぼかし遅延 */
export const TIMEOUT_DROPDOWN_BLUR = 200

/** キーボードショートカットのリセット時間 */
export const TIMEOUT_KEY_RESET = 1000

/** 残り文字数の警告しきい値 */
export const REMAINING_CHARS_WARNING_THRESHOLD = 50

/** 予約投稿の残り文字数警告しきい値 */
export const SCHEDULED_REMAINING_CHARS_WARNING = 100

/** バッジ表示のオーバーフローしきい値 */
export const BADGE_OVERFLOW_THRESHOLD = 99

/** バッジAPI: 未読メッセージ数を計算する対象会話の上限 */
export const BADGES_CONVERSATIONS_LIMIT = 200

/** ドロップダウン方向判定のしきい値（px） */
export const DROPDOWN_DIRECTION_THRESHOLD = 80

/** 通報ドロップダウン方向判定のしきい値（px） */
export const REPORT_DROPDOWN_DIRECTION_THRESHOLD = 200

/** スケルトンローディングの表示件数 */
export const SKELETON_COUNT = 5

/** 管理画面通知バナーの折りたたみしきい値 */
export const ADMIN_NOTIFICATION_COLLAPSE_THRESHOLD = 5

/** シェアウィンドウの幅（px） */
export const SHARE_WINDOW_WIDTH = 600

/** シェアウィンドウの高さ（px） */
export const SHARE_WINDOW_HEIGHT = 400

/** 通知・メッセージのポーリング間隔（ミリ秒） */
export const REFETCH_INTERVAL_MS = 30000

/** React Queryのデフォルトstale時間（ミリ秒） */
export const STALE_TIME_MS = 60 * 1000

/** タイムライン等リアルタイム性の高いデータのstale時間（ミリ秒） */
export const STALE_TIME_REALTIME_MS = 30 * 1000

/** 検索結果等やや静的なデータのstale時間（ミリ秒） */
export const STALE_TIME_SEARCH_MS = 5 * 60 * 1000

/** Service Workerの更新間隔（ミリ秒） */
export const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000

/** デバウンス遅延（ミリ秒） */
export const DEBOUNCE_DELAY_MS = 300

/** 下書き自動保存のデバウンス遅延（ミリ秒） */
export const DRAFT_AUTOSAVE_DELAY_MS = 2000

/** 自動保存完了メッセージの表示時間（ミリ秒） */
export const DRAFT_AUTOSAVE_SAVED_DISPLAY_MS = 3000

/** スクレイピングリクエスト間の待機時間（ミリ秒） */
export const SCRAPING_DELAY_MS = 500

/** 地図のデフォルト中心座標（東京） */
export const MAP_DEFAULT_CENTER: [number, number] = [35.6762, 139.6503]

/** 地図のデフォルトズームレベル */
export const MAP_DEFAULT_ZOOM = 6

/** 現在地取得時のズームレベル */
export const MAP_GEOLOCATION_ZOOM = 14

/** 墨が画面を覆うまでの時間（ms） */
export const INK_DROP_DURATION = 800

/** 墨が引いて完全に消えるまでの時間（ms） */
export const INK_CLEAR_DURATION = 1500

/** 墨エフェクト完了後の余裕を含む合計時間（ms） */
export const INK_CLEAR_TOTAL_DURATION = 1600

/** 検索デバウンス遅延（ms） */
export const DEBOUNCE_SEARCH_MS = 300

/** アバターサイズ XS（24px） */
export const AVATAR_SIZE_XS = 24

/** アバターサイズ SM（32px） - コメント等 */
export const AVATAR_SIZE_SM = 32

/** アバターサイズ MD（40px） - 通知等 */
export const AVATAR_SIZE_MD = 40

/** アバターサイズ LG（48px） - ユーザーカード等 */
export const AVATAR_SIZE_LG = 48

/** アバターサイズ XL（80px） */
export const AVATAR_SIZE_XL = 80

/** アバターサイズ 2XL（128px） - プロフィールヘッダー */
export const AVATAR_SIZE_2XL = 128

/** イラスト幅（192px） */
export const ILLUSTRATION_WIDTH = 192

/** イラスト高さ（144px） */
export const ILLUSTRATION_HEIGHT = 144

/**
 * 検索バーが localStorage に保持する最近の検索履歴の最大件数。
 * 超過分は古いものから順に切り捨てられる。
 */
export const MAX_RECENT_SEARCHES = 10

/**
 * DM テキストエリアの自動拡張の最大高さ (px)。
 * scrollHeight ベースで拡張するが、約 4-5 行分に相当する 120px で上限を設けて
 * 入力欄が画面を覆い尽くすのを防ぐ。
 */
export const MESSAGE_TEXTAREA_MAX_HEIGHT_PX = 120

/** Dropdown を anchor から離す垂直オフセット (px)。trigger ボタンと menu の隙間。 */
export const DROPDOWN_VERTICAL_OFFSET_PX = 4

/** Dropdown menu の最小幅 (px)。anchor 右端から左方向にこの分だけずらして配置する。 */
export const DROPDOWN_MIN_WIDTH_PX = 150

/**
 * 送信完了モーダルを自動クローズするまでの待機時間 (ms)。
 * ユーザーが「送信できた」ことを目視確認できる程度の長さに調整。
 */
export const TIMEOUT_MODAL_AUTO_CLOSE_MS = 2000
