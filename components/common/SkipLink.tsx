/**
 * スキップリンクコンポーネント
 *
 * キーボードユーザーやスクリーンリーダーユーザーが
 * ナビゲーションをスキップしてメインコンテンツに
 * 直接移動できるようにするアクセシビリティ機能
 *
 * @module components/common/SkipLink
 */

'use client'

/**
 * SkipLinkコンポーネント
 *
 * 通常は非表示で、Tabキーでフォーカスされた時のみ表示される
 * クリックまたはEnterキーでメインコンテンツにジャンプ
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * <body>
 *   <SkipLink />
 *   <header>...</header>
 *   <main id="main-content">...</main>
 * </body>
 * ```
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="
        sr-only
        focus:not-sr-only
        focus:absolute
        focus:top-4
        focus:left-4
        focus:z-[9999]
        focus:px-4
        focus:py-2
        focus:bg-primary
        focus:text-primary-foreground
        focus:rounded-md
        focus:outline-none
        focus:ring-2
        focus:ring-ring
        focus:ring-offset-2
      "
    >
      メインコンテンツへスキップ
    </a>
  )
}
