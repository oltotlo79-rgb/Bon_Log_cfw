import type { NutrientCategory, TreeCategory, FertilizerAction, NutrientLevel } from '@prisma/client'

/** 栄養素カテゴリバッジの色 */
export const NUTRIENT_CATEGORY_BADGE: Record<NutrientCategory, { label: string; className: string }> = {
  primary:   { label: '三大要素', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  secondary: { label: '二次要素', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  trace:     { label: '微量要素', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
}

/** 樹種カテゴリバッジの色 */
export const TREE_CATEGORY_BADGE: Record<TreeCategory, { label: string; className: string }> = {
  conifer:   { label: '松柏類',     className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  deciduous: { label: '雑木類',     className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  flowering: { label: '花物',       className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  fruiting:  { label: '実物',       className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  grass:     { label: '草物',       className: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300' },
  evergreen: { label: '常緑広葉樹', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
}

/** 施肥アクションバッジの色・アイコン */
export const FERTILIZER_ACTION_BADGE: Record<FertilizerAction, { label: string; icon: string; className: string }> = {
  none:     { label: '不要',     icon: '—', className: 'bg-muted text-muted-foreground' },
  light:    { label: '控えめ',   icon: '△', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  moderate: { label: '通常',     icon: '○', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  heavy:    { label: 'たっぷり', icon: '◎', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
}

/** 栄養素レベルバッジの色・アイコン */
export const NUTRIENT_LEVEL_BADGE: Record<NutrientLevel, { label: string; icon: string; className: string }> = {
  high:     { label: '多め',       icon: '↑', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  balanced: { label: 'バランス',   icon: '→', className: 'bg-muted text-muted-foreground' },
  low:      { label: '控えめ',     icon: '↓', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  none:     { label: '不要',       icon: '—', className: 'bg-muted text-muted-foreground' },
}
