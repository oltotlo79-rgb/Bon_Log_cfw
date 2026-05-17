/**
 * @file ShowPastToggle.tsx
 * @description 終了イベント表示切替コンポーネント
 *
 * 目的:
 * - 終了したイベントの表示/非表示を切り替える機能を提供する
 * - デフォルトでは終了イベントを非表示にし、必要に応じて表示可能にする
 * - URLクエリパラメータと連動して状態を管理する
 *
 * 機能概要:
 * - チェックボックス形式の表示切替UI
 * - 現在のURLパラメータを維持しながらshowPastパラメータのみ切替
 * - Linkコンポーネントによるページ遷移（SPAナビゲーション）
 *
 * 使用例:
 * ```tsx
 * // 終了イベントを非表示にしている状態
 * <ShowPastToggle showPast={false} />
 *
 * // 終了イベントを表示している状態
 * <ShowPastToggle showPast={true} />
 * ```
 */

// Client Componentとして宣言（useSearchParamsを使用するため）
'use client'

// Next.jsのLinkコンポーネント - クライアントサイドナビゲーションを実現
import Link from 'next/link'

// 現在のURLクエリパラメータを取得するフック
import { useSearchParams } from 'next/navigation'

/**
 * ShowPastToggleコンポーネントのプロパティ型定義
 */
interface ShowPastToggleProps {
  /** 終了イベントを表示するかどうかの現在の状態 */
  showPast: boolean
}

/**
 * 終了イベント表示切替コンポーネント
 * チェックボックス形式で終了イベントの表示/非表示を切り替えるUIを提供する
 *
 * @param props - コンポーネントのプロパティ
 * @param props.showPast - 終了イベントを表示するかどうか
 * @returns 表示切替UIのReact要素
 */
export function ShowPastToggle({ showPast }: ShowPastToggleProps) {
  const searchParams = useSearchParams()

  // 既存のクエリは維持し、showPast だけを切り替える
  const newParams = new URLSearchParams(searchParams.toString())
  if (showPast) {
    // 現在表示中の場合は、パラメータを削除して非表示に切替
    newParams.delete('showPast')
  } else {
    // 現在非表示の場合は、パラメータを追加して表示に切替
    newParams.set('showPast', 'true')
  }

  return (
    // Link全体をクリッカブルにしてユーザビリティを向上
    <Link
      href={`/events?${newParams.toString()}`}
      className="flex items-center gap-2 text-sm cursor-pointer"
    >
      {/* チェックボックス（表示専用、実際の切替はLink遷移で行う） */}
      <input
        type="checkbox"
        checked={showPast}
        readOnly // Linkクリックで状態変更するため読み取り専用
        className="w-4 h-4 rounded cursor-pointer"
      />
      {/* ラベルテキスト */}
      <span className="text-muted-foreground hover:text-foreground whitespace-nowrap">
        終了イベントも表示
      </span>
    </Link>
  )
}
