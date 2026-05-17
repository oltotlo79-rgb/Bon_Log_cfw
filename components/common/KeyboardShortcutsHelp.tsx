/**
 * キーボードショートカットヘルプモーダル
 *
 * @description
 * 利用可能なキーボードショートカットの一覧を表示するモーダルコンポーネント。
 * `?`キーで表示し、`Escape`キーまたは背景クリックで閉じます。
 *
 * @module components/common/KeyboardShortcutsHelp
 */

'use client'

import { useRef } from 'react'
import { KEYBOARD_SHORTCUTS, type KeyboardShortcut } from '@/hooks/use-keyboard-shortcuts'
import { useFocusTrap } from '@/hooks/use-focus-trap'

type KeyboardShortcutsHelpProps = {
  /** モーダルの表示状態 */
  isOpen: boolean
  /** モーダルを閉じるコールバック */
  onClose: () => void
}

/**
 * ショートカットをカテゴリ別にグループ化
 */
function groupByCategory(shortcuts: KeyboardShortcut[]) {
  return shortcuts.reduce<Record<string, KeyboardShortcut[]>>((acc, shortcut) => {
    const bucket = acc[shortcut.category] ?? (acc[shortcut.category] = [])
    bucket.push(shortcut)
    return acc
  }, {})
}

/**
 * カテゴリ名の日本語表示
 */
const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'ナビゲーション',
  actions: 'アクション',
  general: '一般',
}

/**
 * キーボードキーの表示コンポーネント
 */
function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 text-sm font-mono font-medium bg-muted border border-border rounded shadow-sm">
      {children}
    </kbd>
  )
}

/**
 * ショートカットキーをパースしてバッジ表示
 */
function ShortcutKeys({ keys }: { keys: string }) {
  const parts = keys.split(' ')

  return (
    <span className="flex items-center gap-1">
      {parts.map((part, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground text-xs">+</span>}
          <KeyBadge>{part}</KeyBadge>
        </span>
      ))}
    </span>
  )
}

/**
 * キーボードショートカットヘルプモーダル
 *
 * @param isOpen - モーダルの表示状態
 * @param onClose - モーダルを閉じるコールバック
 *
 * @example
 * ```tsx
 * <KeyboardShortcutsHelp
 *   isOpen={showHelp}
 *   onClose={() => setShowHelp(false)}
 * />
 * ```
 */
export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // フォーカスをモーダル内に閉じ込め、閉鎖時に元の要素に復帰する
  useFocusTrap(modalRef, isOpen)

  /**
   * 背景クリックでモーダルを閉じる
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  /**
   * Escapeキーでモーダルを閉じる
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  // モーダルが閉じている場合は何も表示しない
  if (!isOpen) return null

  // ショートカットをカテゴリ別にグループ化
  const groupedShortcuts = groupByCategory(KEYBOARD_SHORTCUTS)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <div
        ref={modalRef}
        className="bg-card border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden animate-fade-in"
        tabIndex={-1}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="keyboard-shortcuts-title" className="text-lg font-semibold">
            キーボードショートカット
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 hover:bg-muted rounded-full transition-colors"
            aria-label="閉じる"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto max-h-[calc(80vh-4rem)] p-6">
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              {/* カテゴリ見出し */}
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {CATEGORY_LABELS[category] || category}
              </h3>

              {/* ショートカット一覧 */}
              <ul className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.keys}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <ShortcutKeys keys={shortcut.keys} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* フッター説明 */}
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              ヒント: <KeyBadge>g</KeyBadge> の後に続けてキーを押すとページ移動ができます。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
