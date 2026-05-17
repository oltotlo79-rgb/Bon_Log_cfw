/**
 * @file 農薬データ更新履歴タイムライン（Server Component）
 * @description pesticideDataHistory を時系列で表示する。ランディング時点で完全な履歴を
 *              サーバーサイド描画するため、検索エンジンやアクセシビリティツールにも
 *              構造化された監査ログが露出する。
 */

import { History } from 'lucide-react'
import { ADMIN_ID_DISPLAY_LONG_LENGTH } from '@/lib/constants/limits'

const HISTORY_ACTION_LABELS: Record<string, string> = {
  create: '作成',
  update: '更新',
  delete: '削除',
}

const HISTORY_ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500',
  update: 'bg-blue-500',
  delete: 'bg-red-500',
}

const HISTORY_ACTION_BADGE: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export interface PesticideHistoryEntry {
  id: string
  action: string
  performedBy: string
  createdAt: Date
  /** JSON 形式の変更差分。null / undefined の場合は表示しない。 */
  changes: unknown
}

export interface PesticideHistoryTimelineProps {
  history: PesticideHistoryEntry[]
}

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}

function formatDate(date: Date): string {
  return date.toLocaleString('ja-JP', DATE_FORMAT_OPTIONS)
}

export function PesticideHistoryTimeline({ history }: PesticideHistoryTimelineProps) {
  return (
    <section className="bg-card rounded-lg border p-6" aria-labelledby="pesticide-history-heading">
      <h2
        id="pesticide-history-heading"
        className="text-lg font-semibold mb-4 flex items-center gap-2"
      >
        <History className="w-5 h-5" />
        更新履歴
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">更新履歴はありません</p>
      ) : (
        <div className="relative">
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" aria-hidden />

          <ol className="space-y-4">
            {history.map((entry) => {
              const dotColor = HISTORY_ACTION_COLORS[entry.action] ?? 'bg-gray-500'
              const badgeColor =
                HISTORY_ACTION_BADGE[entry.action] ??
                'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
              const actionLabel = HISTORY_ACTION_LABELS[entry.action] ?? entry.action

              return (
                <li key={entry.id} className="relative flex gap-4 pl-8">
                  <span
                    className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-background ${dotColor}`}
                    aria-hidden
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeColor}`}
                      >
                        {actionLabel}
                      </span>
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={entry.createdAt.toISOString()}
                      >
                        {formatDate(entry.createdAt)}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      実行者: {entry.performedBy.slice(0, ADMIN_ID_DISPLAY_LONG_LENGTH)}...
                    </p>
                    {entry.changes != null && (
                      <details className="mt-1">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          変更内容を表示
                        </summary>
                        <pre className="mt-1 text-xs bg-muted/50 rounded p-2 overflow-x-auto max-h-32">
                          {JSON.stringify(entry.changes, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
