'use client'

/**
 * チェックマーク円アイコンコンポーネント
 * 通報完了時の成功表示に使用
 */
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}

/**
 * 通報成功時の完了メッセージ表示コンポーネント
 *
 * 通報が正常に受け付けられた際に表示される
 * 静的なメッセージUIを提供する。
 */
export function ReportSuccessView() {
  return (
    <div className="p-8 text-center">
      <CheckCircleIcon className="w-12 h-12 text-foreground mx-auto mb-4" />
      <p className="text-lg font-medium mb-2">通報を受け付けました</p>
      <p className="text-sm text-muted-foreground">
        ご協力ありがとうございます。内容を確認し、適切に対応いたします。
      </p>
    </div>
  )
}
