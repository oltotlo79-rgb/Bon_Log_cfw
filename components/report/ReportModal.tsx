/**
 * @file ReportModal.tsx
 * @description 通報フォームモーダルコンポーネント
 *
 * このコンポーネントは、ユーザーが不適切なコンテンツを通報するための
 * モーダルダイアログを提供します。通報理由の選択と詳細説明の入力が可能です。
 *
 * @features
 * - 通報理由のラジオボタン選択
 * - 詳細説明テキストエリア（任意、最大500文字）
 * - 送信中のローディング表示
 * - 送信成功時の完了メッセージ
 * - エラーハンドリング
 * - body要素へのPortalレンダリング（z-index問題回避）
 * - スクロールロック機能
 *
 * @usage
 * ```tsx
 * <ReportModal
 *   targetType="post"
 *   targetId="post-123"
 *   onClose={() => setShowModal(false)}
 * />
 * ```
 */
'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createReport } from '@/lib/actions/report'
import { TARGET_TYPE_LABELS, type ReportTargetType, type ReportReason } from '@/lib/constants/report'
import { TIMEOUT_MODAL_AUTO_CLOSE_MS } from '@/lib/constants/limits'
import { ReportSuccessView } from './ReportSuccessView'
import { ReportForm } from './ReportForm'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * ReportModalコンポーネントのプロパティ定義
 */
interface ReportModalProps {
  /**
   * 通報対象の種別
   * 'post' | 'comment' | 'user' | 'shop' | 'event' など
   */
  targetType: ReportTargetType

  /**
   * 通報対象のID
   * 対象コンテンツを一意に識別
   */
  targetId: string

  /**
   * モーダルを閉じる際のコールバック関数
   * 親コンポーネントで表示状態を管理
   */
  onClose: () => void
  onSuccess?: () => void
}

/**
 * 閉じる（X）アイコンコンポーネント
 * モーダルの閉じるボタンに使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 斜め線（左上から右下） */}
      <path d="M18 6 6 18"/>
      {/* 斜め線（左下から右上） */}
      <path d="m6 6 12 12"/>
    </svg>
  )
}

/**
 * 通報フォームモーダルコンポーネント
 *
 * ユーザーが不適切なコンテンツを通報するためのモーダルダイアログ。
 * 通報理由を選択し、任意で詳細説明を入力して送信できる。
 *
 * @param props - コンポーネントプロパティ
 * @returns Portal経由でレンダリングされるモーダル要素
 */
export function ReportModal({ targetType, targetId, onClose, onSuccess }: ReportModalProps) {

  /**
   * Server Action実行中のローディング状態を管理
   * isPending: 送信処理中はtrue
   * startTransition: 非同期処理を開始する関数
   */
  const [isPending, startTransition] = useTransition()

  /**
   * 選択された通報理由を管理
   * 空文字('')は未選択状態を示す
   */
  const [reason, setReason] = useState<ReportReason | ''>('')

  /**
   * 詳細説明テキストを管理
   * 任意入力フィールドの値
   */
  const [description, setDescription] = useState('')

  /**
   * 送信成功状態を管理
   * true: 成功メッセージを表示
   */
  const [success, setSuccess] = useState(false)

  /**
   * エラーメッセージを管理
   * null: エラーなし、string: エラーメッセージを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * クライアントサイドマウント状態を管理
   * SSR時にcreatePortalを使用しないための制御
   */
  const [mounted, setMounted] = useState(false)

  /**
   * コンポーネントマウント時の処理
   *
   * 1. クライアントサイドでのマウントを検出
   * 2. body要素のスクロールを無効化（モーダル表示中）
   * 3. クリーンアップ時にスクロールを復元
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- クライアントサイドマウント検出のため必要
    setMounted(true)
    // モーダル表示中はbodyのスクロールを無効化
    document.body.style.overflow = 'hidden'
    return () => {
      // コンポーネントアンマウント時にスクロールを復元
      document.body.style.overflow = ''
    }
  }, [])

  /**
   * フォーム送信時のハンドラ
   *
   * 通報理由が選択されている場合のみ処理を実行。
   * Server Actionを呼び出して通報を作成し、
   * 成功時は完了メッセージを表示して2秒後に自動で閉じる。
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = (e: React.FormEvent) => {
    // デフォルトのフォーム送信を防止
    e.preventDefault()
    // 通報理由が未選択の場合は処理しない
    if (!reason) return

    // エラー状態をリセット
    setError(null)

    // useTransitionでServer Actionを実行
    startTransition(async () => {
      // 通報作成API呼び出し
      const result = await createReport({
        targetType,
        targetId,
        reason,
        description: description || undefined,
      })

      // エラーが返された場合
      if (!result.success) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
        return
      }

      setSuccess(true)
      // 「送信できた」ことを目視確認できる時間を空けてからモーダルを自動クローズする。
      setTimeout(() => {
        onClose()
        onSuccess?.()
      }, TIMEOUT_MODAL_AUTO_CLOSE_MS)
    })
  }

  // クライアントサイドでのみレンダリング（SSR対策）
  if (!mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* オーバーレイ - クリックでモーダルを閉じる */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* モーダルコンテナ - 中央配置用 */}
      <div className="min-h-full flex items-center justify-center p-4">
        {/* モーダル本体 */}
        <div
          className="relative bg-card rounded-lg border shadow-lg w-full max-w-md my-8"
          onClick={(e) => e.stopPropagation()} // モーダル内クリックでの閉じ防止
        >
        {/* ヘッダー - タイトルと閉じるボタン */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {/* 対象種別のラベルを表示（例: "投稿を通報"） */}
            {TARGET_TYPE_LABELS[targetType]}を通報
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ - 成功時とフォーム表示を切り替え */}
        {success ? (
          <ReportSuccessView />
        ) : (
          <ReportForm
            targetType={targetType}
            reason={reason}
            setReason={setReason}
            description={description}
            setDescription={setDescription}
            isPending={isPending}
            error={error}
            onSubmit={handleSubmit}
            onClose={onClose}
          />
        )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
