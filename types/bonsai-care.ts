/**
 * 盆栽手入れログ（BonsaiCareLog）の共有型。
 *
 * Server Action（`lib/actions/bonsai-care-log.ts`）と
 * UI（`components/bonsai/calendar/*`）の両方から参照される。
 * `'use server'` ファイルから型のみを再エクスポートする制約を避けるため、
 * 中立な `types/` 層に配置する。
 *
 * @module types/bonsai-care
 */

import type { BonsaiCareType } from '@prisma/client'

/**
 * カレンダー表示用の手入れログの最小フィールド集合。
 * `getCareLogsInRange` のレスポンス型として利用し、payload を最小化する。
 */
export interface CareLogListItem {
  id: string
  type: BonsaiCareType
  performedAt: Date
  note: string | null
}

/**
 * カレンダーに重ねて表示する「成長記録」の最小フィールド集合。
 * 編集はカレンダーからは行わず、盆栽詳細へ遷移する想定なので
 * payload は表示に必要な分だけに留める。
 */
export interface BonsaiRecordCalendarItem {
  id: string
  bonsaiId: string
  bonsaiName: string
  content: string | null
  recordAt: Date
  imageCount: number
}

/**
 * カレンダーに重ねて表示する「タグ付け投稿」の最小フィールド集合。
 * クリックで投稿詳細に遷移する。
 */
export interface BonsaiPostCalendarItem {
  id: string
  bonsaiId: string
  bonsaiName: string
  content: string | null
  createdAt: Date
  mediaCount: number
}
