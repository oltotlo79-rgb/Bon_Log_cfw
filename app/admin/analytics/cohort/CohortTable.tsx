'use client'


import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import {
  RETENTION_RATE_THRESHOLDS,
  RETENTION_TEXT_LIGHT_THRESHOLD,
} from '@/lib/constants/limits'

interface CohortRow {
  cohort: string
  total: number
  rates: { month: string; rate: number }[]
}

interface CohortTableProps {
  tableData: CohortRow[]
  activeMonths: string[]
  avgRetention: number[]
  currentPeriod: 'weekly' | 'monthly'
}

// リテンション率しきい値ごとの背景色クラス（しきい値の昇順 + 最大値）
const RETENTION_BG_CLASSES = [
  'bg-green-50 dark:bg-green-950/20',
  'bg-green-100 dark:bg-green-900/30',
  'bg-green-200 dark:bg-green-800/40',
  'bg-green-300 dark:bg-green-700/50',
  'bg-green-400 dark:bg-green-600/60',
  'bg-green-500 dark:bg-green-500/70',
  'bg-green-600 dark:bg-green-400/70',
  'bg-green-700 dark:bg-green-300/70',
  // しきい値最大値以上のときに使う最も濃い色
  'bg-green-800 dark:bg-green-200/80',
] as const

/** 最大値のしきい値以上で使う既定色（fallback 用） */
const RETENTION_FALLBACK_CLASS = 'bg-green-800 dark:bg-green-200/80'

/**
 * リテンション率に応じた緑のグラデーション背景色を返す
 */
function getRetentionColor(rate: number): string {
  if (rate === 0) return 'bg-muted/30'
  for (let i = 0; i < RETENTION_RATE_THRESHOLDS.length; i++) {
    const threshold = RETENTION_RATE_THRESHOLDS[i]
    if (threshold !== undefined && rate < threshold) {
      return RETENTION_BG_CLASSES[i] ?? RETENTION_FALLBACK_CLASS
    }
  }
  return RETENTION_BG_CLASSES[RETENTION_BG_CLASSES.length - 1] ?? RETENTION_FALLBACK_CLASS
}

/**
 * リテンション率に応じたテキスト色を返す
 */
function getRetentionTextColor(rate: number): string {
  if (rate === 0) return 'text-muted-foreground'
  if (rate < RETENTION_TEXT_LIGHT_THRESHOLD) return 'text-green-900 dark:text-green-100'
  return 'text-white dark:text-green-900'
}

export function CohortTable({
  tableData,
  activeMonths,
  avgRetention,
  currentPeriod,
}: CohortTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handlePeriodChange = (period: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', period)
    startTransition(() => {
      router.push(`/admin/analytics/cohort?${params.toString()}`)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">期間:</span>
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => handlePeriodChange('monthly')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              currentPeriod === 'monthly'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card hover:bg-muted'
            }`}
          >
            月次
          </button>
          <button
            onClick={() => handlePeriodChange('weekly')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              currentPeriod === 'weekly'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card hover:bg-muted'
            }`}
          >
            週次
          </button>
        </div>
        {isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        {tableData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            コホートデータがありません
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground sticky left-0 bg-card z-10">
                  コホート
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  登録数
                </th>
                {activeMonths.map(month => (
                  <th
                    key={month}
                    className="px-3 py-2 text-center font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map(row => (
                <tr key={row.cohort} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-card z-10">
                    {row.cohort}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {row.total.toLocaleString()}
                  </td>
                  {row.rates.map(({ month, rate }) => (
                    <td
                      key={month}
                      className={`px-3 py-2 text-center font-medium ${getRetentionColor(rate)} ${getRetentionTextColor(rate)}`}
                    >
                      {rate > 0 ? `${rate}%` : '-'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 font-semibold">
                <td className="px-3 py-2 sticky left-0 bg-card z-10">平均</td>
                <td className="px-3 py-2 text-right text-muted-foreground">-</td>
                {avgRetention.map((avg, idx) => (
                  <td
                    key={activeMonths[idx]}
                    className={`px-3 py-2 text-center ${getRetentionColor(avg)} ${getRetentionTextColor(avg)}`}
                  >
                    {avg > 0 ? `${avg}%` : '-'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>リテンション率:</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-muted/30" />
          <span>0%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-green-200 dark:bg-green-800/40" />
          <span>20%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-green-400 dark:bg-green-600/60" />
          <span>40%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-green-600 dark:bg-green-400/70" />
          <span>60%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-green-800 dark:bg-green-200/80" />
          <span>80%+</span>
        </div>
      </div>
    </div>
  )
}
