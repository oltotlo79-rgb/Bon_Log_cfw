import type { PesticideType } from '@prisma/client'

export const DISEASE_PEST_CATEGORIES = ['disease', 'pest', 'beneficial_insect'] as const
export type DiseasePestCategory = (typeof DISEASE_PEST_CATEGORIES)[number]

export function isDiseasePestCategory(value: string | undefined): value is DiseasePestCategory {
  if (!value) return false
  return (DISEASE_PEST_CATEGORIES as readonly string[]).includes(value)
}

/** 病害・害虫・益虫 カテゴリバッジの色 */
export const CATEGORY_BADGE: Record<DiseasePestCategory, { label: string; className: string }> = {
  disease:           { label: '病害', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  pest:              { label: '害虫', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  beneficial_insect: { label: '益虫', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
}

/** 薬剤種別バッジの色 */
export const PESTICIDE_TYPE_BADGE: Record<PesticideType | 'spreader', { label: string; className: string }> = {
  fungicide:  { label: '殺菌剤', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  insecticide:{ label: '殺虫剤', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  acaricide:  { label: '殺ダニ剤', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  compound:   { label: '複合剤', className: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300' },
  other:      { label: 'その他', className: 'bg-muted text-muted-foreground' },
  spreader:   { label: '展着剤', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
}
