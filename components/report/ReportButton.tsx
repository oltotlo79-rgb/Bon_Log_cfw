/**
 * @file ReportButton.tsx
 * @description 通報ボタンコンポーネント
 *
 * このコンポーネントは、投稿、コメント、ユーザーなどのコンテンツを
 * 通報するためのボタンを提供します。クリックすると通報モーダルが表示されます。
 *
 * @features
 * - 3種類の表示バリエーション（アイコン、テキスト、メニュー項目）
 * - クリック時にReportModalを表示
 * - イベント伝播の防止（親要素へのクリックイベントをブロック）
 *
 * @usage
 * ```tsx
 * // アイコンのみ表示
 * <ReportButton targetType="post" targetId="post-123" variant="icon" />
 *
 * // テキスト付き表示
 * <ReportButton targetType="user" targetId="user-456" variant="text" />
 *
 * // ドロップダウンメニュー内で使用
 * <ReportButton targetType="comment" targetId="comment-789" variant="menu" />
 * ```
 */
'use client'

/**
 * useState - コンポーネントの状態管理用フック
 * モーダルの表示/非表示状態を管理するために使用
 */
import { useState } from 'react'

/**
 * ReportModal - 通報フォームを表示するモーダルコンポーネント
 * ユーザーが通報理由を選択して送信するためのUI
 */
import { ReportModal } from './ReportModal'

/**
 * ReportTargetType - 通報対象の種別を定義する型
 * 'post' | 'comment' | 'user' | 'shop' | 'event' などの値を持つ
 */
import type { ReportTargetType } from '@/lib/constants/report'

/**
 * ReportButtonコンポーネントのプロパティ定義
 */
interface ReportButtonProps {
  /**
   * 通報対象の種別
   * 投稿、コメント、ユーザーなど、何を通報するかを指定
   */
  targetType: ReportTargetType

  /**
   * 通報対象のID
   * 対象コンテンツを一意に識別するためのID
   */
  targetId: string

  /**
   * ボタンの表示バリエーション
   * - 'icon': アイコンのみ表示（ツールバー向け）
   * - 'text': アイコン + テキスト表示
   * - 'menu': ドロップダウンメニュー項目として表示（赤色強調）
   * @default 'menu'
   */
  variant?: 'icon' | 'text' | 'menu'

  /**
   * 追加のCSSクラス名
   * カスタムスタイリング用
   */
  className?: string
  onSuccess?: () => void
}

/**
 * 旗（フラグ）アイコンコンポーネント
 * 通報を象徴するアイコンとして使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function FlagIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 旗の本体部分 */}
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      {/* 旗竿部分 */}
      <line x1="4" x2="4" y1="22" y2="15"/>
    </svg>
  )
}

/**
 * 通報ボタンコンポーネント
 *
 * ユーザーが不適切なコンテンツを通報するためのボタン。
 * クリックするとReportModalが表示され、通報理由を選択して送信できる。
 *
 * @param props - コンポーネントプロパティ
 * @returns 通報ボタンとモーダルを含むReact要素
 */
export function ReportButton({ targetType, targetId, variant = 'menu', className, onSuccess }: ReportButtonProps) {

  /**
   * モーダルの表示状態を管理
   * true: モーダルを表示、false: モーダルを非表示
   */
  const [showModal, setShowModal] = useState(false)

  /**
   * ボタンクリック時のハンドラ
   *
   * イベント伝播を防止してモーダルを表示する。
   * 親要素（カードやリンク等）へのクリックイベント伝播を
   * 防ぐことで、意図しないナビゲーションを防止。
   *
   * @param e - マウスクリックイベント
   */
  const handleClick = (e: React.MouseEvent) => {
    // デフォルトの動作（リンク遷移など）を防止
    e.preventDefault()
    // 親要素へのイベント伝播を停止
    e.stopPropagation()
    // モーダルを表示
    setShowModal(true)
  }

  return (
    <>
      {/* アイコンのみバリエーション - ツールバーやアクションボタン向け */}
      {variant === 'icon' && (
        <button
          onClick={handleClick}
          className={`p-2 hover:bg-muted rounded-lg transition-colors ${className || ''}`}
          aria-label="このコンテンツを通報"
        >
          <FlagIcon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </button>
      )}

      {/* テキスト付きバリエーション - インラインアクション向け */}
      {variant === 'text' && (
        <button
          onClick={handleClick}
          className={`flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground ${className || ''}`}
          aria-label="このコンテンツを通報"
        >
          <FlagIcon className="w-4 h-4" aria-hidden="true" />
          <span>通報する</span>
        </button>
      )}

      {/* メニュー項目バリエーション - ドロップダウンメニュー内での使用向け */}
      {/* 赤色で強調表示して、重要なアクションであることを示す */}
      {variant === 'menu' && (
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 ${className || ''}`}
          aria-label="このコンテンツを通報"
        >
          <FlagIcon className="w-4 h-4" aria-hidden="true" />
          <span>通報する</span>
        </button>
      )}

      {/* 通報モーダル - showModalがtrueの時のみ表示 */}
      {showModal && (
        <ReportModal
          targetType={targetType}
          targetId={targetId}
          onClose={() => setShowModal(false)}
          onSuccess={onSuccess}
        />
      )}
    </>
  )
}
