/**
 * @fileoverview トースター（通知表示）コンポーネント
 *
 * @description
 * アプリケーション全体でトースト通知を表示するためのコンテナコンポーネントです。
 * useToastフックと連携して、ユーザーへのフィードバック（成功、エラー、情報など）を
 * 一時的に表示します。
 *
 * @features
 * - 画面右下に固定表示
 * - 複数のトーストをスタック表示
 * - スライドインアニメーション
 * - バリアント別のスタイリング（通常/destructive）
 * - タイトルと説明文の表示
 *
 * @example
 * // レイアウトに配置（1回のみ）
 * // app/layout.tsx
 * import { Toaster } from '@/components/ui/toaster'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <Toaster />
 *       </body>
 *     </html>
 *   )
 * }
 *
 * @example
 * // コンポーネント内でトーストを表示
 * import { useToast } from '@/hooks/use-toast'
 *
 * function MyComponent() {
 *   const { toast } = useToast()
 *
 *   const handleSuccess = () => {
 *     toast({
 *       title: '保存しました',
 *       description: 'プロフィールが正常に更新されました。',
 *     })
 *   }
 *
 *   const handleError = () => {
 *     toast({
 *       variant: 'destructive',
 *       title: 'エラーが発生しました',
 *       description: '保存に失敗しました。もう一度お試しください。',
 *     })
 *   }
 * }
 */

'use client'

// トースト管理用のカスタムフック
// トーストの追加・削除・状態管理を行う
import { useToast } from '@/hooks/use-toast'

/**
 * トースターコンポーネント
 *
 * アプリケーション内のすべてのトースト通知を表示するコンテナです。
 * 通常はルートレイアウトに一度だけ配置し、useToastフックを通じて
 * アプリケーション全体からトーストを表示できるようにします。
 *
 * @returns トースト通知のコンテナ要素をレンダリングするReactコンポーネント
 */
export function Toaster() {
  // 現在アクティブなトーストの配列を取得
  const { toasts } = useToast()

  return (
    // トーストを表示する固定位置のコンテナ
    // aria-live="polite" でスクリーンリーダーに新しいトーストを通知
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        // 個別のトースト表示
        <div
          key={toast.id}
          role={toast.variant === 'destructive' ? 'alert' : 'status'}
          className={`
            rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-5
            ${toast.variant === 'destructive'
              // destructiveバリアント: エラー・警告用（赤系）
              ? 'bg-destructive/10 border-destructive/20 text-destructive'
              // デフォルトバリアント: 成功・情報用（白/グレー系）
              : 'bg-white border-gray-200 text-gray-900'
            }
          `}
        >
          {/* トーストのタイトル（任意） */}
          {toast.title && (
            <p className="font-semibold text-sm">{toast.title}</p>
          )}
          {/* トーストの説明文（任意） */}
          {toast.description && (
            <p className="text-sm opacity-90">{toast.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
