'use client'

import { isHormoneActivityLevel, type HormoneActivityLevel } from '@/lib/constants/hormone-techniques'

const LEVEL_CONFIG: Record<HormoneActivityLevel, { height: string; color: string }> = {
  high: { height: 'h-20', color: 'bg-green-500' },
  moderate: { height: 'h-14', color: 'bg-yellow-500' },
  low: { height: 'h-8', color: 'bg-orange-400' },
  minimal: { height: 'h-3', color: 'bg-gray-400' },
}

const MONTH_LABELS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]

type SeasonalLevel = {
  month: number
  level: string
  description: string | null
}

type Props = {
  seasonalLevels: SeasonalLevel[]
}

export function HormoneSeasonalChart({ seasonalLevels }: Props) {
  const levelMap = new Map(seasonalLevels.map((s) => [s.month, s]))

  return (
    <div className="flex items-end gap-1 sm:gap-2">
      {MONTH_LABELS.map((label, i) => {
        const entry = levelMap.get(i + 1)
        const levelKey: HormoneActivityLevel = entry && isHormoneActivityLevel(entry.level) ? entry.level : 'minimal'
        const config = LEVEL_CONFIG[levelKey]
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1" title={entry?.description ?? ''}>
            <div className={`${config.height} ${config.color} w-full rounded-t transition-all`} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
