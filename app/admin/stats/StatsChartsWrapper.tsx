'use client'

import dynamic from 'next/dynamic'

type StatsData = {
  date: string
  users: number
  posts: number
  comments: number
}

const StatsCharts = dynamic(
  () => import('./StatsCharts').then((mod) => mod.StatsCharts),
  {
    ssr: false,
    loading: () => (
      <div className="bg-card rounded-lg border p-4">
        <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
      </div>
    ),
  }
)

export function StatsChartsWrapper({ data }: { data: StatsData[] }) {
  return <StatsCharts data={data} />
}
