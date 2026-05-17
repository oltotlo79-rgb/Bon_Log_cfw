import { TrendingUp, TrendingDown, Users } from 'lucide-react'

type GrowthData = {
  date: string
  newFollowers: number
  totalFollowers: number
}

type FollowerGrowthChartProps = {
  currentFollowers: number
  totalNewInPeriod: number
  growth: GrowthData[]
}

export function FollowerGrowthChart({ currentFollowers, totalNewInPeriod, growth }: FollowerGrowthChartProps) {
  if (growth.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        データがありません
      </div>
    )
  }

  const maxTotal = Math.max(...growth.map(g => g.totalFollowers), 1)
  const minTotal = Math.min(...growth.map(g => g.totalFollowers))
  const range = maxTotal - minTotal || 1

  return (
    <div className="space-y-4">
      {/* サマリー */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-2xl font-bold">{currentFollowers}</span>
          <span className="text-sm text-muted-foreground">フォロワー</span>
        </div>
        <div className={`flex items-center gap-1 text-sm ${totalNewInPeriod >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {totalNewInPeriod >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span className="font-medium">+{totalNewInPeriod}</span>
          <span className="text-muted-foreground">期間内</span>
        </div>
      </div>

      {/* 折れ線グラフ風エリアチャート */}
      <div className="h-32 relative">
        <svg viewBox={`0 0 ${growth.length - 1} 100`} className="w-full h-full" preserveAspectRatio="none">
          {/* エリア */}
          <path
            d={
              growth.map((g, i) => {
                const x = growth.length > 1 ? (i / (growth.length - 1)) * (growth.length - 1) : 0
                const y = 100 - ((g.totalFollowers - minTotal) / range) * 80 - 10
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
              }).join(' ') +
              ` L ${growth.length - 1} 100 L 0 100 Z`
            }
            className="fill-primary/10"
          />
          {/* ライン */}
          <path
            d={
              growth.map((g, i) => {
                const x = growth.length > 1 ? (i / (growth.length - 1)) * (growth.length - 1) : 0
                const y = 100 - ((g.totalFollowers - minTotal) / range) * 80 - 10
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
              }).join(' ')
            }
            className="stroke-primary"
            fill="none"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* X軸ラベル */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {growth[0] && new Date(growth[0].date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
        </span>
        <span>
          {(() => {
            const last = growth[growth.length - 1]
            return last && new Date(last.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
          })()}
        </span>
      </div>
    </div>
  )
}
