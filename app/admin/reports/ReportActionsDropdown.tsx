/**
 * @file 通報アクションドロップダウンコンポーネント
 * @description 通報管理テーブルの各行で使用されるドロップダウンメニュー。
 *              ステータス変更、通報対象の削除、通報レコードの削除などの操作を提供する。
 */

'use client'

// ReactのuseStateとuseRefフック（状態管理とDOM参照用）
import { useState, useRef } from 'react'
// Next.jsのルーター（ページ更新用）
import { useRouter } from 'next/navigation'
// Next.jsのLinkコンポーネント（対象確認リンク用）
import Link from 'next/link'
// 通報関連のServer Action（ステータス更新、コンテンツ削除、通報削除）
import { updateReportStatus, deleteReportedContent, deleteReport } from '@/lib/actions/report'
import { REPORT_DROPDOWN_DIRECTION_THRESHOLD } from '@/lib/constants/limits'
import { useToast } from '@/hooks/use-toast'

/**
 * 縦三点メニューアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1"/>
      <circle cx="12" cy="5" r="1"/>
      <circle cx="12" cy="19" r="1"/>
    </svg>
  )
}

/**
 * ReportActionsDropdownコンポーネントのProps型定義
 */
interface ReportActionsDropdownProps {
  /** 操作対象の通報ID */
  reportId: string
  /** 現在のステータス */
  currentStatus: string
  /** 通報対象の種類 */
  targetType: string
  /** 通報対象のID */
  targetId: string
}

/**
 * 対象タイプの日本語ラベル定義
 */
const targetTypeLabels: Record<string, string> = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  review: 'レビュー',
  user: 'ユーザー',
}

/**
 * 通報アクションドロップダウンコンポーネント
 * 通報に対する管理操作を提供するドロップダウンメニュー
 *
 * @param reportId - 操作対象の通報ID
 * @param currentStatus - 現在のステータス
 * @param targetType - 通報対象の種類
 * @param targetId - 通報対象のID
 * @returns ドロップダウンメニューのJSX要素
 *
 * 機能:
 * - 対象コンテンツへのリンク
 * - ステータス変更（確認中/対応完了/却下/未対応に戻す）
 * - 通報対象の削除/停止（確認ダイアログ付き）
 * - 通報レコードのみ削除
 * - メニュー位置の自動調整（画面端対応）
 */
export function ReportActionsDropdown({
  reportId,
  currentStatus,
  targetType,
  targetId,
}: ReportActionsDropdownProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < REPORT_DROPDOWN_DIRECTION_THRESHOLD

      if (openUpward) {
        setMenuStyle({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.right - 180,
        })
      } else {
        setMenuStyle({
          top: rect.bottom + 4,
          left: rect.right - 180,
        })
      }
    }
    setIsOpen(!isOpen)
  }

  const handleStatusUpdate = async (newStatus: 'pending' | 'reviewed' | 'resolved' | 'dismissed') => {
    setIsSubmitting(true)
    const result = await updateReportStatus(reportId, newStatus)
    setIsSubmitting(false)

    if (!result.success) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    setIsOpen(false)
    router.refresh()
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    const result = await deleteReportedContent(targetType as 'post' | 'comment' | 'event' | 'shop' | 'review' | 'user', targetId)
    setIsSubmitting(false)

    if (!result.success) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    setIsOpen(false)
    setShowDeleteConfirm(false)
    router.refresh()
  }

  const handleDeleteReport = async () => {
    setIsSubmitting(true)
    const result = await deleteReport(reportId)
    setIsSubmitting(false)

    if (!result.success) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    setIsOpen(false)
    router.refresh()
  }

  const getTargetLink = () => {
    switch (targetType) {
      case 'post':
        return `/posts/${targetId}`
      case 'event':
        return `/events/${targetId}`
      case 'shop':
        return `/shops/${targetId}`
      case 'user':
        return `/users/${targetId}`
      default:
        return null
    }
  }

  const targetLink = getTargetLink()

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="p-2 hover:bg-muted rounded-lg"
        disabled={isSubmitting}
      >
        <MoreVerticalIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed bg-card border rounded-lg shadow-lg py-1 z-[101] min-w-[180px]"
            style={menuStyle}
          >
            {targetLink && (
              <>
                <Link
                  href={targetLink}
                  target="_blank"
                  className="block px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => setIsOpen(false)}
                >
                  対象を確認
                </Link>
                <div className="border-t my-1" />
              </>
            )}

            {currentStatus !== 'reviewed' && (
              <button
                onClick={() => handleStatusUpdate('reviewed')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-muted-foreground"
              >
                確認中にする
              </button>
            )}

            {currentStatus !== 'resolved' && (
              <button
                onClick={() => handleStatusUpdate('resolved')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-foreground"
              >
                対応完了にする
              </button>
            )}

            {currentStatus !== 'dismissed' && (
              <button
                onClick={() => handleStatusUpdate('dismissed')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-gray-600"
              >
                却下する
              </button>
            )}

            {currentStatus !== 'pending' && (
              <button
                onClick={() => handleStatusUpdate('pending')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-muted-foreground"
              >
                未対応に戻す
              </button>
            )}

            <div className="border-t my-1" />

            {showDeleteConfirm ? (
              <div className="px-4 py-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {targetTypeLabels[targetType]}を{targetType === 'user' ? '停止' : '削除'}しますか？
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="flex-1 px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {isSubmitting ? '処理中...' : (targetType === 'user' ? '停止' : '削除')}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-2 py-1 text-xs border rounded hover:bg-muted"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-destructive/10 text-destructive"
              >
                {targetType === 'user' ? 'アカウントを停止' : `${targetTypeLabels[targetType]}を削除`}
              </button>
            )}

            <button
              onClick={handleDeleteReport}
              disabled={isSubmitting}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-muted-foreground"
            >
              通報を削除（レコードのみ）
            </button>
          </div>
        </>
      )}
    </div>
  )
}
