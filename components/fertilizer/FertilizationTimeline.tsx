import type { FertilizerAction, NutrientLevel } from '@prisma/client'
import { FERTILIZER_ACTION_BADGE, NUTRIENT_LEVEL_BADGE } from '@/lib/utils/fertilizer'

type TimelinePlan = {
  month: number
  action: FertilizerAction
  nitrogenLevel: NutrientLevel | null
  phosphorusLevel: NutrientLevel | null
  potassiumLevel: NutrientLevel | null
}

type Props = {
  plans: TimelinePlan[]
}

/** 施肥アクション → タイムラインセルの背景色 */
const ACTION_BAR_COLOR: Record<FertilizerAction, string> = {
  none: 'bg-muted',
  light: 'bg-amber-200 dark:bg-amber-800',
  moderate: 'bg-sky-200 dark:bg-sky-800',
  heavy: 'bg-emerald-200 dark:bg-emerald-800',
}

/** 栄養素ごとの色定義 (N/P/K) */
const NUTRIENT_BAR_COLORS = {
  nitrogen: {
    high: 'bg-emerald-400 dark:bg-emerald-600',
    balanced: 'bg-emerald-200 dark:bg-emerald-800',
    low: 'bg-emerald-100 dark:bg-emerald-900',
    none: 'bg-muted/50',
  },
  phosphorus: {
    high: 'bg-rose-400 dark:bg-rose-600',
    balanced: 'bg-rose-200 dark:bg-rose-800',
    low: 'bg-rose-100 dark:bg-rose-900',
    none: 'bg-muted/50',
  },
  potassium: {
    high: 'bg-sky-400 dark:bg-sky-600',
    balanced: 'bg-sky-200 dark:bg-sky-800',
    low: 'bg-sky-100 dark:bg-sky-900',
    none: 'bg-muted/50',
  },
} as const

/** 季節定義 */
const SEASONS = [
  { label: '春', months: [3, 4, 5], className: 'text-emerald-600 dark:text-emerald-400' },
  { label: '夏', months: [6, 7, 8], className: 'text-sky-600 dark:text-sky-400' },
  { label: '秋', months: [9, 10, 11], className: 'text-amber-600 dark:text-amber-400' },
  { label: '冬', months: [12, 1, 2], className: 'text-slate-600 dark:text-slate-400' },
] as const

/** 月番号を季節の開始列位置に変換 (1月=0列目) */
function getSeasonGridPosition(months: readonly number[]): { start: number; span: number } {
  const first = months[0] ?? 1
  return { start: first - 1, span: months.length }
}

function getNutrientColor(
  nutrient: 'nitrogen' | 'phosphorus' | 'potassium',
  level: NutrientLevel | null,
): string {
  if (!level) return NUTRIENT_BAR_COLORS[nutrient].none
  return NUTRIENT_BAR_COLORS[nutrient][level]
}

export function FertilizationTimeline({ plans }: Props) {
  // 1月始まりでソート、12か月分用意
  const sortedPlans = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    return plans.find((p) => p.month === month) ?? {
      month,
      action: 'none' as FertilizerAction,
      nitrogenLevel: null,
      phosphorusLevel: null,
      potassiumLevel: null,
    }
  })

  return (
    <div className="space-y-1.5 overflow-x-auto">
      <div className="grid grid-cols-12 text-xs font-semibold min-w-[480px]">
        {SEASONS.map((season) => {
          const pos = getSeasonGridPosition(season.months)
          return (
            <div
              key={season.label}
              className={`text-center ${season.className}`}
              style={{ gridColumn: `${pos.start + 1} / span ${pos.span}` }}
            >
              {season.label}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-px rounded-md overflow-hidden min-w-[480px]">
        {sortedPlans.map((plan) => (
          <div
            key={plan.month}
            className={`h-8 flex items-center justify-center text-xs font-medium ${ACTION_BAR_COLOR[plan.action]}`}
            title={`${plan.month}月: ${FERTILIZER_ACTION_BADGE[plan.action].label}`}
          >
            {FERTILIZER_ACTION_BADGE[plan.action].icon}
          </div>
        ))}
      </div>

      {(['nitrogen', 'phosphorus', 'potassium'] as const).map((nutrient) => {
        const label = nutrient === 'nitrogen' ? 'N' : nutrient === 'phosphorus' ? 'P' : 'K'
        return (
          <div key={nutrient} className="flex items-center gap-1 min-w-[480px]">
            <span className="text-[10px] text-muted-foreground w-3 shrink-0 text-right">{label}</span>
            <div className="grid grid-cols-12 gap-px flex-1 rounded-sm overflow-hidden">
              {sortedPlans.map((plan) => {
                const level = plan[`${nutrient}Level`]
                const levelLabel = level ? NUTRIENT_LEVEL_BADGE[level].label : '---'
                return (
                  <div
                    key={plan.month}
                    className={`h-2 ${getNutrientColor(nutrient, level)}`}
                    title={`${plan.month}月 ${label}: ${levelLabel}`}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="grid grid-cols-12 text-[10px] text-muted-foreground min-w-[480px]">
        {sortedPlans.map((plan) => (
          <div key={plan.month} className="text-center tabular-nums">
            {plan.month}月
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground pt-2 border-t border-border/40">
        <span className="font-medium text-foreground text-xs">施肥量:</span>
        {(Object.entries(ACTION_BAR_COLOR) as [FertilizerAction, string][]).map(([action, color]) => (
          <span key={action} className="inline-flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
            {FERTILIZER_ACTION_BADGE[action].label}
          </span>
        ))}
        <span className="basis-full h-0" />
        <span className="font-medium text-foreground text-xs">栄養素:</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm bg-emerald-400 dark:bg-emerald-600" />N
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm bg-rose-400 dark:bg-rose-600" />P
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm bg-sky-400 dark:bg-sky-600" />K
        </span>
        <span className="text-muted-foreground/70">( 濃 = 多め / 淡 = 控えめ )</span>
      </div>
    </div>
  )
}
