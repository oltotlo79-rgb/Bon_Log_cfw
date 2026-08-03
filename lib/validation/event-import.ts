/**
 * イベントインポートの共有バリデーション
 *
 * `'use server'` を付けない通常モジュール。Server Action（lib/actions/event-import.ts）
 * とクライアント側の事前警告表示の両方から import される想定のため、Prisma 等の
 * サーバー専用依存は持ち込まない。
 *
 * @module lib/validation/event-import
 */

import { z } from 'zod'
import {
  MAX_EVENT_TITLE_LENGTH,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_FIELD_LENGTH,
  MAX_EVENT_URL_LENGTH,
  MAX_EVENT_FIELD_HARD_LENGTH,
  MAX_EVENT_DESCRIPTION_HARD_LENGTH,
} from '@/lib/constants/limits'

export type EventFieldViolation = {
  field: string
  kind: 'clipped' | 'rejected'
  actualLength: number
  maxLength: number
}

export type EventImportItemIssue = {
  index: number
  title: string
  violations: EventFieldViolation[]
}

export type EventImportResult = {
  importedCount: number
  clippedItems: EventImportItemIssue[]
  rejectedItems: EventImportItemIssue[]
}

/**
 * クリップ対象フィールド名の単一ソース。ここに追加/削除すれば
 * {@link CLIPPABLE_FIELD_LIMITS} の許容キーと {@link ClippableField} 型の両方に反映される。
 */
const CLIPPABLE_FIELDS = [
  'title',
  'organizer',
  'venue',
  'city',
  'prefecture',
  'admissionFee',
  'description',
] as const

type ClippableField = (typeof CLIPPABLE_FIELDS)[number]

/**
 * ソフト/ハード上限のペア。ソフト上限超過はクリップして受理、
 * ハード上限超過は reject する（DoS/OOM 防止の保護的上限を維持しつつ、
 * 1 件の不良データで配列全体が拒否される問題を避ける）。
 */
const CLIPPABLE_FIELD_LIMITS = {
  title: { soft: MAX_EVENT_TITLE_LENGTH, hard: MAX_EVENT_FIELD_HARD_LENGTH },
  organizer: { soft: MAX_EVENT_FIELD_LENGTH, hard: MAX_EVENT_FIELD_HARD_LENGTH },
  venue: { soft: MAX_EVENT_FIELD_LENGTH, hard: MAX_EVENT_FIELD_HARD_LENGTH },
  city: { soft: MAX_EVENT_FIELD_LENGTH, hard: MAX_EVENT_FIELD_HARD_LENGTH },
  prefecture: { soft: MAX_EVENT_FIELD_LENGTH, hard: MAX_EVENT_FIELD_HARD_LENGTH },
  admissionFee: { soft: MAX_EVENT_FIELD_LENGTH, hard: MAX_EVENT_FIELD_HARD_LENGTH },
  description: { soft: MAX_EVENT_DESCRIPTION_LENGTH, hard: MAX_EVENT_DESCRIPTION_HARD_LENGTH },
} satisfies Record<ClippableField, { soft: number; hard: number }>

/** クリップ超過は reject、ソフト超過は自動クリップする文字列スキーマを生成する。 */
function clippableString(field: ClippableField, options?: { min?: number }) {
  const { soft, hard } = CLIPPABLE_FIELD_LIMITS[field]
  const base = options?.min ? z.string().min(options.min).max(hard) : z.string().max(hard)
  return base.transform((value) => value.slice(0, soft))
}

/**
 * インポート対象イベント 1 件分の Zod スキーマ。
 * organizer/venue/city/prefecture/admissionFee/title/description は
 * ソフト上限超過をクリップ、ハード上限超過を reject する。
 * externalUrl/sourceUrl はクリップすると URL が壊れるため reject のみ。
 */
export const importableEventSchema = z.object({
  id: z.string().min(1).max(MAX_EVENT_FIELD_LENGTH),
  title: clippableString('title', { min: 1 }),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  prefecture: clippableString('prefecture').nullable(),
  city: clippableString('city').nullable(),
  venue: clippableString('venue').nullable(),
  organizer: clippableString('organizer').nullable(),
  admissionFee: clippableString('admissionFee').nullable(),
  hasSales: z.boolean(),
  description: clippableString('description'),
  externalUrl: z.string().max(MAX_EVENT_URL_LENGTH).nullable(),
  sourceRegion: z.string().max(MAX_EVENT_FIELD_LENGTH),
  sourceUrl: z.string().max(MAX_EVENT_URL_LENGTH),
  isDuplicate: z.boolean(),
  duplicateType: z.enum(['exact', 'similar']).nullable(),
  similarEventTitle: z.string().max(MAX_EVENT_TITLE_LENGTH).optional(),
})

export type ImportableEventInput = z.input<typeof importableEventSchema>

const URL_FIELDS = ['externalUrl', 'sourceUrl'] as const

/**
 * 1 件のイベントの文字数違反を列挙する純関数（クライアント事前警告用にも使える）。
 * {@link importableEventSchema} と同じ上限テーブルを参照するため、判定基準はズレない。
 * 違反なしなら空配列を返す。
 */
export function getEventFieldViolations(event: ImportableEventInput): EventFieldViolation[] {
  const violations: EventFieldViolation[] = []

  for (const field of CLIPPABLE_FIELDS) {
    const value = event[field]
    if (typeof value !== 'string') continue

    const { soft, hard } = CLIPPABLE_FIELD_LIMITS[field]
    if (value.length > hard) {
      violations.push({ field, kind: 'rejected', actualLength: value.length, maxLength: hard })
    } else if (value.length > soft) {
      violations.push({ field, kind: 'clipped', actualLength: value.length, maxLength: soft })
    }
  }

  for (const field of URL_FIELDS) {
    const value = event[field]
    if (typeof value !== 'string') continue
    if (value.length > MAX_EVENT_URL_LENGTH) {
      violations.push({
        field,
        kind: 'rejected',
        actualLength: value.length,
        maxLength: MAX_EVENT_URL_LENGTH,
      })
    }
  }

  return violations
}
