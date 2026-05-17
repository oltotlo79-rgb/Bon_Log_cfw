'use client'

/**
 * recharts を直接使う訪問者数エリアチャート本体。
 * 親（`DailyVisitorsChart.tsx`）が `next/dynamic` で `ssr: false` ロードする。
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type VisitorsData = {
  date: string
  visitors: number
}

export function DailyVisitorsChartInner({ data }: { data: VisitorsData[] }) {
  // チャート描画用に日付を「M/D」表示（JST）に整形
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
  }))

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" className="text-xs" />
          <YAxis className="text-xs" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number | undefined) => [`${value ?? 0} 人`, 'ユニーク訪問者']}
            labelFormatter={(label: string) => `${label}`}
          />
          <Area
            type="monotone"
            dataKey="visitors"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.25}
            strokeWidth={2}
            name="訪問者数"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
