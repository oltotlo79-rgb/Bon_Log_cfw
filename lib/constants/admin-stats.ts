/**
 * @module lib/constants/admin-stats
 * 管理者統計グラフで使う期間 / 指標 / グラフ種別の仕様値と型ガード。
 * page / component の local 定義を一箇所に集約する。
 */

export const ADMIN_STATS_PERIODS = ['7', '14', '30'] as const
export type AdminStatsPeriod = (typeof ADMIN_STATS_PERIODS)[number]

export function isAdminStatsPeriod(value: string): value is AdminStatsPeriod {
  return (ADMIN_STATS_PERIODS as readonly string[]).includes(value)
}

export const ADMIN_STATS_METRICS = ['all', 'users', 'posts', 'comments'] as const
export type AdminStatsMetric = (typeof ADMIN_STATS_METRICS)[number]

export function isAdminStatsMetric(value: string): value is AdminStatsMetric {
  return (ADMIN_STATS_METRICS as readonly string[]).includes(value)
}

export const ADMIN_STATS_CHART_TYPES = ['line', 'area', 'bar'] as const
export type AdminStatsChartType = (typeof ADMIN_STATS_CHART_TYPES)[number]
