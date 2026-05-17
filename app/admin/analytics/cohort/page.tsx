/**
 * @file コホート分析ページ
 * @description 登録月/週ごとのユーザーリテンション率を
 *              コホートテーブルで可視化する管理者ページ。
 * @route /admin/analytics/cohort
 */

import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getCohortAnalysis } from '@/lib/actions/admin/analytics'
import { CohortTable } from './CohortTable'
import { Users, CalendarDays } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'コホート分析 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function CohortPage({ searchParams }: PageProps) {
  const params = await searchParams
  const period = (params.period === 'weekly' ? 'weekly' : 'monthly') as 'weekly' | 'monthly'

  const result = await getCohortAnalysis({ period, months: 12 })

  if ('error' in result) {
    redirect(ROUTE_LOGIN)
  }

  const { cohorts, retention } = result

  // リテンション率マップを構築: cohort -> activeMonth -> rate
  const retentionMap = new Map<string, Map<string, number>>()
  for (const r of retention) {
    let monthMap = retentionMap.get(r.cohort)
    if (!monthMap) {
      monthMap = new Map()
      retentionMap.set(r.cohort, monthMap)
    }
    monthMap.set(r.activeMonth, r.activeUsers)
  }

  // 全アクティブ月のユニーク一覧（列ヘッダー用）
  const allActiveMonths = Array.from(
    new Set(retention.map(r => r.activeMonth))
  ).sort()

  // コホートごとのリテンション率テーブルデータを構築
  const tableData = cohorts.map(c => {
    const monthMap = retentionMap.get(c.cohort)
    const rates = allActiveMonths.map(month => {
      const active = monthMap?.get(month) ?? 0
      const rate = c.total > 0 ? Math.round((active / c.total) * 100) : 0
      return { month, rate }
    })
    return { cohort: c.cohort, total: c.total, rates }
  })

  // 平均リテンション率を計算（各列ごと）
  const avgRetention = allActiveMonths.map((month, idx) => {
    const rates = tableData
      .map(row => row.rates[idx]?.rate ?? 0)
      .filter(r => r > 0)
    if (rates.length === 0) return 0
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
  })

  const overallAvg = avgRetention.length > 0
    ? Math.round(avgRetention.reduce((a, b) => a + b, 0) / avgRetention.length)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="w-6 h-6" />
        <h1 className="text-2xl font-bold">コホート分析</h1>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">総コホート数</p>
          </div>
          <p className="text-2xl font-bold">{cohorts.length}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">総ユーザー数</p>
          <p className="text-2xl font-bold">
            {cohorts.reduce((sum, c) => sum + c.total, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">平均リテンション率</p>
          <p className="text-2xl font-bold">{overallAvg}%</p>
        </div>
      </div>

      {/* コホートテーブル（Client Component: 期間切り替え） */}
      <CohortTable
        tableData={tableData}
        activeMonths={allActiveMonths}
        avgRetention={avgRetention}
        currentPeriod={period}
      />
    </div>
  )
}
