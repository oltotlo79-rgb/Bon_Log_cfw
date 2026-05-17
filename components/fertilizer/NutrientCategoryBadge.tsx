import type { NutrientCategory } from '@prisma/client'
import { NUTRIENT_CATEGORY_BADGE } from '@/lib/utils/fertilizer'

type Props = {
  category: NutrientCategory
}

export function NutrientCategoryBadge({ category }: Props) {
  const badge = NUTRIENT_CATEGORY_BADGE[category]
  return (
    <span className={badge.className + ' px-2 py-0.5 text-xs rounded-full font-medium'}>
      {badge.label}
    </span>
  )
}
