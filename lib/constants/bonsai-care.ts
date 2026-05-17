/**
 * 盆栽手入れログ（BonsaiCareLog）のドメイン定数。
 *
 * 手入れ種別のラベル・配色・カレンダービューモードなど、
 * UI と Server Actions の双方から参照される共通定数を集約する。
 *
 * 新しい手入れ種別を追加する場合は以下を同時に更新する:
 *   1. prisma/schema.prisma の BonsaiCareType enum
 *   2. BONSAI_CARE_TYPES 配列
 *   3. BONSAI_CARE_LABELS
 *   4. BONSAI_CARE_COLOR_CLASS
 *   5. db push / migrate でマイグレーション適用
 *
 * @module lib/constants/bonsai-care
 */

import { BonsaiCareType } from '@prisma/client'

/** 標準月カレンダー（7列×6行） */
export const CALENDAR_MODE_MONTH = 'month'
/** 6 ヶ月ビュー（縦: 1-31日 / 横: 6 ヶ月） */
export const CALENDAR_MODE_HALF_YEAR = 'half-year'
/** 12 ヶ月ビュー（縦: 1-31日 / 横: 12 ヶ月） */
export const CALENDAR_MODE_YEAR = 'year'

export const CALENDAR_MODES = [
  CALENDAR_MODE_MONTH,
  CALENDAR_MODE_HALF_YEAR,
  CALENDAR_MODE_YEAR,
] as const

export type CalendarMode = (typeof CALENDAR_MODES)[number]

/** 各モードで表示する月数 */
export const CALENDAR_MODE_MONTH_COUNT: Record<CalendarMode, number> = {
  [CALENDAR_MODE_MONTH]: 1,
  [CALENDAR_MODE_HALF_YEAR]: 6,
  [CALENDAR_MODE_YEAR]: 12,
}

/** モード切替タブの日本語ラベル */
export const CALENDAR_MODE_LABELS: Record<CalendarMode, string> = {
  [CALENDAR_MODE_MONTH]: '月',
  [CALENDAR_MODE_HALF_YEAR]: '6ヶ月',
  [CALENDAR_MODE_YEAR]: '12ヶ月',
}

export const BONSAI_VIEW_PARAM = 'view'
export const BONSAI_VIEW_TIMELINE = 'timeline'
export const BONSAI_VIEW_CALENDAR = 'calendar'

export const BONSAI_VIEWS = [BONSAI_VIEW_TIMELINE, BONSAI_VIEW_CALENDAR] as const
export type BonsaiView = (typeof BONSAI_VIEWS)[number]

export const BONSAI_CALENDAR_MODE_PARAM = 'mode'
export const BONSAI_CALENDAR_ANCHOR_PARAM = 'anchor'

/** anchor の形式: `YYYY-MM`（年4桁 + 月01-12） */
export const BONSAI_CALENDAR_ANCHOR_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * 手入れ種別の列挙。
 * Prisma の BonsaiCareType enum と同じ順序で並べる（UI の表示順にも利用）。
 */
export const BONSAI_CARE_TYPES = [
  BonsaiCareType.pesticide,
  BonsaiCareType.solid_fertilizer,
  BonsaiCareType.liquid_fertilizer,
  BonsaiCareType.rotate,
  BonsaiCareType.shading,
  BonsaiCareType.muro_in,
  BonsaiCareType.muro_out,
  BonsaiCareType.other,
] as const satisfies readonly BonsaiCareType[]

/** 手入れ種別の総数（types フィルタ配列の Zod 上限などに利用） */
export const ALL_CARE_TYPE_COUNT = BONSAI_CARE_TYPES.length

/** 画面表示用の日本語ラベル */
export const BONSAI_CARE_LABELS: Record<BonsaiCareType, string> = {
  [BonsaiCareType.pesticide]: '消毒',
  [BonsaiCareType.solid_fertilizer]: '置き肥',
  [BonsaiCareType.liquid_fertilizer]: '液肥',
  [BonsaiCareType.rotate]: '移動・回転',
  [BonsaiCareType.shading]: '遮光',
  [BonsaiCareType.muro_in]: 'ムロ入れ',
  [BonsaiCareType.muro_out]: 'ムロ出し',
  [BonsaiCareType.other]: 'その他',
}

/**
 * カレンダー上のバッジ/ドット用 Tailwind 色クラス。
 * 落ち着いた色調を選択し、種別が視覚的に判別できる組み合わせとする。
 */
export const BONSAI_CARE_COLOR_CLASS: Record<BonsaiCareType, string> = {
  [BonsaiCareType.pesticide]: 'bg-red-500',
  [BonsaiCareType.solid_fertilizer]: 'bg-amber-500',
  [BonsaiCareType.liquid_fertilizer]: 'bg-yellow-500',
  [BonsaiCareType.rotate]: 'bg-sky-500',
  [BonsaiCareType.shading]: 'bg-slate-500',
  [BonsaiCareType.muro_in]: 'bg-indigo-500',
  [BonsaiCareType.muro_out]: 'bg-emerald-500',
  [BonsaiCareType.other]: 'bg-muted-foreground',
}

/**
 * 手入れ（BonsaiCareLog）以外でカレンダーに重ねる種別。
 * - record: 個別盆栽の成長記録（BonsaiRecord）
 * - post: 通常の投稿で盆栽をタグ付けしたもの（Post.bonsaiId）
 */
export const CALENDAR_OVERLAY_RECORD = 'record'
export const CALENDAR_OVERLAY_POST = 'post'

export const CALENDAR_OVERLAY_KINDS = [
  CALENDAR_OVERLAY_RECORD,
  CALENDAR_OVERLAY_POST,
] as const

export type CalendarOverlayKind = (typeof CALENDAR_OVERLAY_KINDS)[number]

export const CALENDAR_OVERLAY_LABELS: Record<CalendarOverlayKind, string> = {
  [CALENDAR_OVERLAY_RECORD]: '成長記録',
  [CALENDAR_OVERLAY_POST]: 'タグ付け投稿',
}

/** 手入れ種別の色と被らないトーンを選ぶ。 */
export const CALENDAR_OVERLAY_COLOR_CLASS: Record<CalendarOverlayKind, string> = {
  [CALENDAR_OVERLAY_RECORD]: 'bg-lime-600',
  [CALENDAR_OVERLAY_POST]: 'bg-pink-500',
}
