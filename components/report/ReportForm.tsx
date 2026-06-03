'use client'

import { REPORT_REASONS, TARGET_TYPE_LABELS, isReportReason, type ReportTargetType, type ReportReason } from '@/lib/constants/report'
import { MAX_REPORT_DETAIL_LENGTH } from '@/lib/constants/limits'
import { FormError } from '@/components/common/FormError'

/**
 * ReportFormコンポーネントのプロパティ定義
 */
interface ReportFormProps {
  /** 通報対象の種別 */
  targetType: ReportTargetType
  /** 選択された通報理由 */
  reason: ReportReason | ''
  /** 通報理由を更新する関数 */
  setReason: (reason: ReportReason) => void
  /** 詳細説明テキスト */
  description: string
  /** 詳細説明を更新する関数 */
  setDescription: (description: string) => void
  /** Server Action実行中かどうか */
  isPending: boolean
  /** エラーメッセージ（null: エラーなし） */
  error: string | null
  /** フォーム送信ハンドラ */
  onSubmit: (e: React.FormEvent) => void
  /** キャンセル/閉じるハンドラ */
  onClose: () => void
}

/**
 * 通報フォームコンポーネント
 *
 * 通報理由のラジオボタン選択、詳細説明テキストエリア、
 * 送信/キャンセルボタンを含む通報入力フォームを提供する。
 */
export function ReportForm({
  targetType,
  reason,
  setReason,
  description,
  setDescription,
  isPending,
  error,
  onSubmit,
  onClose,
}: ReportFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="p-4 space-y-4">
        <FormError message={error} />

        <p className="text-sm text-muted-foreground">
          この{TARGET_TYPE_LABELS[targetType]}に問題がある場合は、以下から該当する理由を選択してください。
          通報内容は匿名で処理されます。
        </p>

        {/* 通報理由選択 - ラジオボタンリスト */}
        <div>
          <label className="block text-sm font-medium mb-2">
            通報理由 <span className="text-destructive">*</span>
          </label>
          <div className="space-y-2">
            {/* 定義済みの通報理由をループ表示 */}
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  reason === r.value
                    ? 'border-primary bg-primary/5' // 選択時のスタイル
                    : 'hover:bg-muted' // 未選択時のホバースタイル
                }`}
              >
                {/* スクリーンリーダー専用の非表示ラジオボタン */}
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={(e) => {
                    if (isReportReason(e.target.value)) setReason(e.target.value)
                  }}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                    reason === r.value
                      ? 'border-primary'
                      : 'border-muted-foreground'
                  }`}
                >
                  {reason === r.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            詳細説明（任意）
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={MAX_REPORT_DETAIL_LENGTH}
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="問題の詳細があれば入力してください"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {description.length}/{MAX_REPORT_DETAIL_LENGTH}
          </p>
        </div>
      </div>

      <div className="flex gap-3 p-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 border rounded-lg hover:bg-muted transition-colors"
        >
          キャンセル
        </button>
        {/* 送信ボタン - 理由未選択または送信中は無効化 */}
        <button
          type="submit"
          disabled={!reason || isPending}
          className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? '送信中...' : '通報する'}
        </button>
      </div>
    </form>
  )
}
