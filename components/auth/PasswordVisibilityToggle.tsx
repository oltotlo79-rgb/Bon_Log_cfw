'use client'

import { Eye, EyeOff } from 'lucide-react'

/**
 * パスワード表示/非表示トグルボタン
 *
 * パスワード入力フィールドの右端に配置し、
 * クリックでパスワードの表示/非表示を切り替える。
 *
 * @param show - パスワードが表示されているかどうか
 * @param onToggle - トグル時のコールバック
 */
export function PasswordVisibilityToggle({
  show,
  onToggle,
}: {
  show: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      aria-label={show ? 'パスワードを隠す' : 'パスワードを表示'}
    >
      {show ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </button>
  )
}
