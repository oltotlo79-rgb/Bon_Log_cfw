import type { NutrientLevel } from '@prisma/client'
import { NUTRIENT_LEVEL_BADGE } from '@/lib/utils/fertilizer'

type Props = {
  level: NutrientLevel | null
  nutrient?: string
}

export function NutrientLevelIndicator({ level, nutrient }: Props) {
  if (!level) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const badge = NUTRIENT_LEVEL_BADGE[level]
  return (
    <span className="inline-flex items-center gap-1">
      {nutrient && <span className="text-xs text-muted-foreground">{nutrient}</span>}
      <span className={badge.className + ' inline-flex items-center justify-center w-6 h-6 rounded border text-sm font-bold'}>
        {badge.icon}
      </span>
    </span>
  )
}
