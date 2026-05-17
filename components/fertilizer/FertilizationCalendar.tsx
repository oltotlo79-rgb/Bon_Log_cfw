import type { FertilizerAction, NutrientLevel } from '@prisma/client'
import { FertilizerActionBadge } from '@/components/fertilizer/FertilizerActionBadge'
import { NutrientLevelIndicator } from '@/components/fertilizer/NutrientLevelIndicator'

type Plan = {
  month: number
  action: FertilizerAction
  nitrogenLevel: NutrientLevel | null
  phosphorusLevel: NutrientLevel | null
  potassiumLevel: NutrientLevel | null
  description: string | null
  cautionNote: string | null
}

type Props = {
  plans: Plan[]
}

/** 月→季節マッピング */
function getSeasonForMonth(month: number): { label: string; className: string } {
  if (month >= 3 && month <= 5) return { label: '春', className: 'bg-emerald-50/60 dark:bg-emerald-950/20' }
  if (month >= 6 && month <= 8) return { label: '夏', className: 'bg-sky-50/60 dark:bg-sky-950/20' }
  if (month >= 9 && month <= 11) return { label: '秋', className: 'bg-amber-50/60 dark:bg-amber-950/20' }
  return { label: '冬', className: 'bg-slate-50/60 dark:bg-slate-950/20' }
}

/** 季節名 */
function getSeasonLabel(month: number): string | null {
  switch (month) {
    case 3: return '春（3-5月）'
    case 6: return '夏（6-8月）'
    case 9: return '秋（9-11月）'
    case 12: return '冬（12-2月）'
    default: return null
  }
}

export function FertilizationCalendar({ plans }: Props) {
  // 1月始まりにソート
  const sortedPlans = [...plans].sort((a, b) => a.month - b.month)

  return (
    <div className="space-y-4">
      {/* 凡例 */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground px-1">
        <span className="font-medium text-foreground">凡例:</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> たっぷり</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-sky-500" /> 通常</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> 控えめ</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" /> 不要</span>
      </div>

      {/* デスクトップ: テーブル */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-3 py-2.5 font-medium w-16">月</th>
              <th className="px-3 py-2.5 font-medium w-24">施肥</th>
              <th className="px-3 py-2.5 font-medium text-center w-14">N</th>
              <th className="px-3 py-2.5 font-medium text-center w-14">P</th>
              <th className="px-3 py-2.5 font-medium text-center w-14">K</th>
              <th className="px-3 py-2.5 font-medium">ポイント</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlans.map((plan) => {
              const season = getSeasonForMonth(plan.month)
              const seasonLabel = getSeasonLabel(plan.month)
              return (
                <>
                  {seasonLabel && (
                    <tr key={`season-${plan.month}`}>
                      <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30 border-b">
                        {seasonLabel}
                      </td>
                    </tr>
                  )}
                  <tr key={plan.month} className={`border-b last:border-b-0 ${season.className}`}>
                    <td className="px-3 py-2.5 font-bold tabular-nums">{plan.month}月</td>
                    <td className="px-3 py-2.5">
                      <FertilizerActionBadge action={plan.action} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <NutrientLevelIndicator level={plan.nitrogenLevel} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <NutrientLevelIndicator level={plan.phosphorusLevel} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <NutrientLevelIndicator level={plan.potassiumLevel} />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {plan.description && <p className="leading-relaxed">{plan.description}</p>}
                      {plan.cautionNote && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                          <span className="shrink-0">&#9888;</span>
                          <span>{plan.cautionNote}</span>
                        </p>
                      )}
                    </td>
                  </tr>
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* モバイル: カード形式 */}
      <div className="sm:hidden space-y-1">
        {sortedPlans.map((plan) => {
          const season = getSeasonForMonth(plan.month)
          const seasonLabel = getSeasonLabel(plan.month)
          return (
            <div key={plan.month}>
              {seasonLabel && (
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-3 first:mt-0">
                  {seasonLabel}
                </div>
              )}
              <div className={`rounded-lg border p-3 space-y-2 ${season.className}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold tabular-nums">{plan.month}月</span>
                  <FertilizerActionBadge action={plan.action} />
                </div>
                {/* N/P/K 横並び */}
                <div className="flex gap-3">
                  <NutrientLevelIndicator level={plan.nitrogenLevel} nutrient="N" />
                  <NutrientLevelIndicator level={plan.phosphorusLevel} nutrient="P" />
                  <NutrientLevelIndicator level={plan.potassiumLevel} nutrient="K" />
                </div>
                {plan.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{plan.description}</p>
                )}
                {plan.cautionNote && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                    <span className="shrink-0">&#9888;</span>
                    <span>{plan.cautionNote}</span>
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
