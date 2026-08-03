import type { EventImportItemIssue } from '@/lib/validation/event-import'
import { formatEventFieldViolation } from './event-field-labels'

type EventImportResultPanelProps = {
  importedCount: number
  clippedItems: EventImportItemIssue[]
  rejectedItems: EventImportItemIssue[]
}

/**
 * インポート結果（成功件数・切り詰め・取込不可の内訳）を表示するパネル。
 */
export function EventImportResultPanel({
  importedCount,
  clippedItems,
  rejectedItems,
}: EventImportResultPanelProps) {
  return (
    <div className="space-y-2">
      <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
        {importedCount}件のイベントをインポートしました
      </div>

      {clippedItems.length > 0 && (
        <div className="p-4 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
          <p className="font-medium">
            {clippedItems.length}件は一部フィールドを切り詰めて取込みました
          </p>
          <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
            {clippedItems.map((item) => (
              <li key={item.index}>
                <span className="font-medium">{item.title}</span>:{' '}
                {item.violations.map(formatEventFieldViolation).join('、')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rejectedItems.length > 0 && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
          <p className="font-medium">{rejectedItems.length}件は取込できませんでした</p>
          <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
            {rejectedItems.map((item) => (
              <li key={item.index}>
                <span className="font-medium">{item.title}</span>:{' '}
                {item.violations.map(formatEventFieldViolation).join('、')}
                （編集して再度お試しください）
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
