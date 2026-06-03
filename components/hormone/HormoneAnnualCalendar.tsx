import { HORMONE_LEVEL_CONFIG, MONTH_LABELS, isHormoneActivityLevel } from '@/lib/constants/hormone-techniques'

type SeasonalLevel = {
  month: number
  level: string
  description: string | null
}

type HormoneWithLevels = {
  name: string
  slug: string
  seasonalLevels: SeasonalLevel[]
}

type Props = {
  hormones: HormoneWithLevels[]
  onMonthClick?: (month: number) => void
}

export function HormoneAnnualCalendar({ hormones, onMonthClick }: Props) {
  if (hormones.length === 0) {
    return <p className="text-sm text-muted-foreground">カレンダーデータがありません。</p>
  }

  return (
    <div className="space-y-4">
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left p-2 font-semibold text-sm border-b">ホルモン</th>
              {MONTH_LABELS.map((label) => (
                <th key={label} className="p-1.5 text-center font-medium border-b min-w-[40px]">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hormones.map((hormone) => {
              const levelMap = new Map(hormone.seasonalLevels.map((s) => [s.month, s]))
              return (
                <tr key={hormone.slug}>
                  <td className="p-2 font-medium text-sm border-b whitespace-nowrap">{hormone.name}</td>
                  {MONTH_LABELS.map((_, i) => {
                    const month = i + 1
                    const entry = levelMap.get(month)
                    const levelKey = entry && isHormoneActivityLevel(entry.level) ? entry.level : 'minimal'
                    const config = HORMONE_LEVEL_CONFIG[levelKey]
                    return (
                      <td
                        key={i}
                        className={`p-1 border-b text-center${onMonthClick ? ' cursor-pointer hover:bg-accent/50' : ''}`}
                        title={onMonthClick ? 'クリックでシミュレーターへ' : (entry?.description ?? '')}
                        onClick={onMonthClick ? () => onMonthClick(month) : undefined}
                      >
                        <div className={`${config.color} w-6 h-6 rounded mx-auto flex items-center justify-center`}>
                          <span className="text-[9px] font-bold text-white">{config.label}</span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-4">
        {hormones.map((hormone) => {
          const levelMap = new Map(hormone.seasonalLevels.map((s) => [s.month, s]))
          return (
            <div key={hormone.slug} className="rounded-lg border p-3 space-y-2">
              <h3 className="font-semibold text-sm">{hormone.name}</h3>
              <div className="grid grid-cols-6 gap-1">
                {MONTH_LABELS.map((label, i) => {
                  const month = i + 1
                  const entry = levelMap.get(month)
                  const levelKey = entry && isHormoneActivityLevel(entry.level) ? entry.level : 'minimal'
                  const config = HORMONE_LEVEL_CONFIG[levelKey]
                  return (
                    <div
                      key={label}
                      className={`flex flex-col items-center gap-0.5${onMonthClick ? ' cursor-pointer hover:opacity-80' : ''}`}
                      title={onMonthClick ? 'クリックでシミュレーターへ' : (entry?.description ?? '')}
                      onClick={onMonthClick ? () => onMonthClick(month) : undefined}
                    >
                      <div className={`${config.color} w-full aspect-square rounded flex items-center justify-center`}>
                        <span className="text-[8px] font-bold text-white">{config.label}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
        <span className="font-medium">凡例:</span>
        {Object.entries(HORMONE_LEVEL_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`${config.color} w-3 h-3 rounded`} />
            <span>{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
