/**
 * @module lib/constants/report
 * 通報機能の定数 / 型定義 / Zod 検証用 enum。
 *
 * AUTO_HIDE_THRESHOLD は管理者対応を待たずに同一対象が複数通報を受けた場合に
 * 自動非表示にする閾値。誤判定リスクと対応の遅延のバランスから 10 件に設定。
 */

/** 通報理由の `value` だけを抽出した tuple。Zod enum で使う。 */
export const REPORT_REASON_VALUES = [
  'spam',
  'inappropriate',
  'harassment',
  'copyright',
  'other',
] as const

/** 通報理由 (UI 表示ラベル付き) */
export const REPORT_REASONS = [
  { value: 'spam' as const, label: 'スパム' },
  { value: 'inappropriate' as const, label: '不適切な内容' },
  { value: 'harassment' as const, label: '誹謗中傷' },
  { value: 'copyright' as const, label: '著作権侵害' },
  { value: 'other' as const, label: 'その他' },
] satisfies ReadonlyArray<{ value: typeof REPORT_REASON_VALUES[number]; label: string }>

export type ReportReason = (typeof REPORT_REASON_VALUES)[number]

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASON_VALUES as readonly string[]).includes(value)
}

/** 通報対象種別 */
export const REPORT_TARGET_TYPES = [
  'post',
  'comment',
  'event',
  'shop',
  'review',
  'user',
] as const
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number]

export function isReportTargetType(value: string): value is ReportTargetType {
  return (REPORT_TARGET_TYPES as readonly string[]).includes(value)
}

/** 通報 description の最大長 (UI: textarea / server: Zod max) */
export const REPORT_DESCRIPTION_MAX_LENGTH = 1000

export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'auto_hidden'

/**
 * 自動非表示のしきい値。
 * Why 10: 少なすぎると誤判定のリスクが高く、多すぎると対応が遅れる。
 * 「複数の異なるユーザーが問題視している」と判断できる中央値として採用。
 */
export const AUTO_HIDE_THRESHOLD = 10

/** コンテンツ種別 (user を除く)。アカウント停止と非表示処理を分けるため。 */
export type ContentType = 'post' | 'comment' | 'event' | 'shop' | 'review'

export const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  review: 'レビュー',
  user: 'ユーザー',
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  review: 'レビュー',
}

export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  post: 'bg-blue-100 text-blue-800',
  comment: 'bg-green-100 text-green-800',
  event: 'bg-purple-100 text-purple-800',
  shop: 'bg-amber-100 text-amber-800',
  review: 'bg-pink-100 text-pink-800',
}
