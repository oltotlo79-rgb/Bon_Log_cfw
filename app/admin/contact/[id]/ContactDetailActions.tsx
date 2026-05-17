/**
 * @file お問い合わせ詳細アクションコンポーネント
 * @description お問い合わせ詳細ページで使用される操作パネル。
 *              ステータス変更、管理者メモの編集、削除機能を提供する
 *              クライアントコンポーネント。
 */

'use client'

// Reactのフック（状態管理用）
import { useState } from 'react'
// Next.jsのルーター（ページ遷移・更新用）
import { useRouter } from 'next/navigation'
// お問い合わせ管理用のServer Actions
import { updateInquiryStatus, deleteInquiry } from '@/lib/actions/contact'
import { useToast } from '@/hooks/use-toast'
import { ROUTE_ADMIN_CONTACT } from '@/lib/constants/routes'

/**
 * コンポーネントのProps型定義
 */
interface ContactDetailActionsProps {
  /** お問い合わせID */
  inquiryId: string
  /** 現在のステータス */
  currentStatus: string
  /** 現在の管理者メモ */
  currentNote: string
}

/**
 * お問い合わせ詳細アクションコンポーネント
 * ステータス変更、メモ編集、削除機能を提供する
 *
 * @param inquiryId - お問い合わせID
 * @param currentStatus - 現在のステータス
 * @param currentNote - 現在の管理者メモ
 * @returns アクションパネルのJSX要素
 *
 * 機能:
 * - ステータス変更（未対応/対応中/解決済/クローズ）
 * - 管理者メモの編集（対応内容の記録用）
 * - お問い合わせの削除（スパム対策など）
 */
export function ContactDetailActions({ inquiryId, currentStatus, currentNote }: ContactDetailActionsProps) {
  const { toast } = useToast()
  // フォームの入力値の状態管理
  const [status, setStatus] = useState(currentStatus)
  const [adminNote, setAdminNote] = useState(currentNote)
  // 処理中フラグ（ボタンの二重クリック防止）
  const [isSubmitting, setIsSubmitting] = useState(false)
  // 操作結果メッセージ（成功/エラー）
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  /**
   * お問い合わせ情報を更新する関数
   * ステータスと管理者メモをデータベースに保存
   */
  const handleUpdate = async () => {
    setIsSubmitting(true)
    setMessage(null)
    try {
      // Server Actionを呼び出して更新
      const result = await updateInquiryStatus(inquiryId, status, adminNote)
      if ('error' in result) {
        // エラー時はメッセージを表示
        setMessage(result.error || 'エラーが発生しました')
      } else {
        // 成功時はメッセージを表示してページを再読み込み
        setMessage('更新しました')
        router.refresh()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * お問い合わせを削除する関数
   * スパムや誤送信の対応に使用
   */
  const handleDelete = async () => {
    // 確認ダイアログで削除を確認（誤操作防止）
    if (!confirm('このお問い合わせを削除しますか？この操作は元に戻せません。')) return
    setIsSubmitting(true)
    try {
      // Server Actionを呼び出して削除
      const result = await deleteInquiry(inquiryId)
      if ('error' in result) {
        toast({ title: result.error, variant: 'destructive' })
      } else {
        // 成功時は一覧ページへリダイレクト
        router.push(ROUTE_ADMIN_CONTACT)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-card rounded-lg border p-6 space-y-4">
      <h2 className="text-lg font-semibold">対応操作</h2>

      {/* ステータス選択フィールド */}
      <div className="space-y-2">
        <label className="text-sm font-medium">ステータス</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
        >
          {/* 各ステータスの意味:
              pending: 新規のお問い合わせ、まだ対応していない
              in_progress: 調査中や対応中
              resolved: 対応完了、ユーザーに返信済み
              closed: 対応終了、追加対応不要 */}
          <option value="pending">未対応</option>
          <option value="in_progress">対応中</option>
          <option value="resolved">解決済</option>
          <option value="closed">クローズ</option>
        </select>
      </div>

      {/* 管理者メモフィールド */}
      <div className="space-y-2">
        <label className="text-sm font-medium">管理者メモ</label>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={4}
          placeholder="対応内容や返信内容のメモ"
          className="w-full rounded-md border px-3 py-2 text-sm bg-background resize-y"
        />
      </div>

      {/* 操作結果メッセージ（成功時は緑、エラー時は赤） */}
      {message && (
        <p className={`text-sm ${message === '更新しました' ? 'text-green-600' : 'text-destructive'}`}>
          {message}
        </p>
      )}

      {/* アクションボタン */}
      <div className="flex gap-3">
        {/* 更新ボタン */}
        <button
          onClick={handleUpdate}
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? '更新中...' : '更新する'}
        </button>
        {/* 削除ボタン（危険な操作なので赤色で表示） */}
        <button
          onClick={handleDelete}
          disabled={isSubmitting}
          className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          削除
        </button>
      </div>
    </div>
  )
}
