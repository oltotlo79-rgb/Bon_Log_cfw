'use client'

/**
 * 管理者ダッシュボード上の Daily Visitors（日次訪問者数）推移グラフ。
 *
 * recharts は SSR に対応しないため Client Component として実装する。
 * 実際の recharts 部分は `next/dynamic` で `ssr: false` ロードする。
 */

import dynamic from 'next/dynamic'

type VisitorsData = {
  date: string
  visitors: number
}

const Inner = dynamic(() => import('./DailyVisitorsChartInner').then((m) => m.DailyVisitorsChartInner), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] bg-muted/40 animate-pulse rounded-lg" />
  ),
})

export function DailyVisitorsChart({ data }: { data: VisitorsData[] }) {
  return <Inner data={data} />
}
