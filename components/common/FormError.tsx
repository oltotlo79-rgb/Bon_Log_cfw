/**
 * @file FormError.tsx
 * @description フォームのエラーメッセージ表示用共通コンポーネント
 *
 * フォーム内で発生したバリデーションエラーやサーバーエラーを
 * 統一されたスタイルで表示するためのコンポーネント。
 *
 * @example
 * ```tsx
 * <FormError message={error} />
 * <FormError message={error} className="mt-2" />
 * ```
 */

/**
 * FormErrorコンポーネントのプロパティ定義
 */
interface FormErrorProps {
  /** 表示するエラーメッセージ（null/undefinedの場合は何も表示しない） */
  message?: string | null
  /** 追加のCSSクラス名 */
  className?: string
}

/**
 * フォームエラー表示コンポーネント
 *
 * エラーメッセージがある場合のみ表示される。
 * role="alert"を付与してスクリーンリーダーにも通知する。
 *
 * @param message - 表示するエラーメッセージ
 * @param className - 追加のCSSクラス名
 */
export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null

  return (
    <div
      className={`p-3 rounded-lg bg-destructive/10 text-destructive text-sm${className ? ` ${className}` : ''}`}
      role="alert"
    >
      {message}
    </div>
  )
}
