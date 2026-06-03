import { Clock, Calendar } from 'lucide-react'

const WEEKDAY_NAMES = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']

type BestTimeCardProps = {
  peakHour: number
  peakWeekday: number
  hourlyData: number[]
  weekdayData: number[]
}

export function BestTimeCard({ peakHour, peakWeekday, hourlyData, weekdayData }: BestTimeCardProps) {
  const totalLikes = hourlyData.reduce((a, b) => a + b, 0)

  if (totalLikes === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        データが不足しています
      </div>
    )
  }

  // ピーク時間帯（前後1時間を含む3時間帯）
  const peakRange = [
    (peakHour - 1 + 24) % 24,
    peakHour,
    (peakHour + 1) % 24,
  ]
  const peakRangeLikes = peakRange.reduce((sum, h) => sum + (hourlyData[h] ?? 0), 0)
  const peakRangePercent = totalLikes > 0 ? Math.round((peakRangeLikes / totalLikes) * 100) : 0
  const peakRangeStart = peakRange[0] ?? 0
  const peakRangeEnd = peakRange[2] ?? 0
  const peakWeekdayLikes = weekdayData[peakWeekday] ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Clock className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">ベスト投稿時間</p>
          <p className="text-2xl font-bold">{peakHour}:00 - {(peakHour + 1) % 24}:00</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {peakRangeStart}時〜{(peakRangeEnd + 1) % 24}時に全いいねの{peakRangePercent}%を獲得
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Calendar className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">ベスト曜日</p>
          <p className="text-2xl font-bold">{WEEKDAY_NAMES[peakWeekday] ?? ''}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {peakWeekdayLikes}いいね（全体の{totalLikes > 0 ? Math.round((peakWeekdayLikes / totalLikes) * 100) : 0}%）
          </p>
        </div>
      </div>
    </div>
  )
}
