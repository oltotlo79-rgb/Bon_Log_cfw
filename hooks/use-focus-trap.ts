'use client'

/**
 * モーダル・ダイアログ内でフォーカスを循環させるためのフック。
 *
 * `role="dialog"` + `aria-modal="true"` を自前実装する場合、Tab キーで
 * モーダル外の要素にフォーカスが移らないようにする必要がある。Radix UI
 * (`components/ui/dialog.tsx`) 経由であれば自動で処理されるが、カスタム
 * 実装のモーダル（例: `KeyboardShortcutsHelp`, `ImageGallery`）では
 * このフックで focus trap を適用する。
 *
 * - モーダルが開いた時に開く前の focused element を記憶
 * - モーダル閉鎖時に元の要素にフォーカスを復帰
 * - Tab / Shift+Tab で最初と最後の focusable 要素をループ
 *
 * @module hooks/use-focus-trap
 */

import { useEffect, type RefObject } from 'react'

/**
 * モーダル要素内でフォーカスを tab キーで循環させるセレクタ。
 * `input`, `button`, `a`, `textarea`, `select`, `[tabindex]` の中で
 * 非 disabled / 非 hidden の要素のみを対象にする。
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  return Array.from(nodes).filter((el) => {
    // hidden / aria-hidden の要素は除外（Radix UI と同じ挙動）
    if (el.hidden) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    return true
  })
}

/**
 * モーダルコンテナに focus trap を適用する。
 *
 * @param ref  focus trap を適用するコンテナ ref
 * @param active  trap を有効にするかどうか（モーダルの開閉状態）
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    // 初回フォーカスをコンテナまたは最初の focusable 要素に当てる
    const focusables = getFocusableElements(container)
    const firstFocusable = focusables[0]
    if (firstFocusable) {
      firstFocusable.focus()
    } else {
      container.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      if (!container) return
      const list = getFocusableElements(container)
      if (list.length === 0) {
        event.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      if (!first || !last) return
      const activeEl = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

      if (event.shiftKey) {
        // activeEl が container 外（null 含む）または first の場合は last にラップ
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault()
          last.focus()
        }
      } else {
        if (activeEl === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // モーダル閉鎖時に前の要素にフォーカス復帰（元の要素が存在する場合のみ）
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [ref, active])
}
