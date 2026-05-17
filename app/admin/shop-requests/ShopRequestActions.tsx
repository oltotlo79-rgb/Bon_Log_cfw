/**
 * @file 盆栽園変更リクエストアクションコンポーネント
 * @description 盆栽園変更リクエストカードで使用されるアクションボタン群。
 *              承認・却下の操作とダイアログを提供する。
 */

'use client'

// ReactのuseStateフック（状態管理用）
import { useState } from 'react'
// Next.jsのルーター（ページ更新用）
import { useRouter } from 'next/navigation'
// Next.jsのLinkコンポーネント（盆栽園確認リンク用）
import Link from 'next/link'
// 変更リクエスト承認・却下用のServer Action
import { approveShopChangeRequest, rejectShopChangeRequest } from '@/lib/actions/shop'
// 型定義
import type { ShopChangeRequestData } from '@/lib/services/shop-change-helpers'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * ShopRequestActionsコンポーネントのProps型定義
 */
interface ShopRequestActionsProps {
  requestId: string
  shopId: string
  shopName: string
  changes: ShopChangeRequestData
}

/**
 * 変更フィールドの日本語ラベル定義
 */
const fieldLabels: Record<string, string> = {
  name: '名称',
  address: '住所',
  phone: '電話番号',
  website: 'ウェブサイト',
  businessHours: '営業時間',
  closedDays: '定休日',
}

/**
 * 盆栽園変更リクエストアクションコンポーネント
 * 変更リクエストに対する承認・却下操作を提供するボタン群
 *
 * @param requestId - 操作対象のリクエストID
 * @param shopId - 対象盆栽園のID
 * @param shopName - 対象盆栽園の名前（確認表示用）
 * @param changes - リクエストされた変更内容
 * @returns アクションボタン群のJSX要素
 *
 * 機能:
 * - 盆栽園詳細ページへのリンク
 * - 承認ダイアログ（変更内容の確認、管理者コメント入力）
 * - 却下ダイアログ（却下理由入力）
 */
export function ShopRequestActions({
  requestId,
  shopId,
  shopName,
  changes,
}: ShopRequestActionsProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [adminComment, setAdminComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    setIsProcessing(true)
    setError(null)

    const result = await approveShopChangeRequest(requestId, adminComment)

    if (!result.success) {
      setError((('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK))
      setIsProcessing(false)
    } else {
      setShowApproveDialog(false)
      router.refresh()
    }
  }

  const handleReject = async () => {
    setIsProcessing(true)
    setError(null)

    const result = await rejectShopChangeRequest(requestId, adminComment)

    if (!result.success) {
      setError((('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK))
      setIsProcessing(false)
    } else {
      setShowRejectDialog(false)
      router.refresh()
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Link
          href={`/shops/${shopId}`}
          target="_blank"
          className="px-3 py-2 text-sm border rounded-lg hover:bg-muted"
        >
          盆栽園を確認
        </Link>
        <button
          onClick={() => setShowApproveDialog(true)}
          disabled={isProcessing}
          className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:bg-foreground/90 disabled:opacity-50"
        >
          承認
        </button>
        <button
          onClick={() => setShowRejectDialog(true)}
          disabled={isProcessing}
          className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
        >
          却下
        </button>
      </div>

      {/* 承認ダイアログ */}
      {showApproveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">変更リクエストを承認</h3>

            <p className="text-sm text-muted-foreground mb-4">
              「{shopName}」の以下の変更を適用します。
            </p>

            {/* 変更内容の確認 */}
            <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-2">
              {Object.entries(changes)
                .filter(([, value]) => value)
                .map(([field, value]) => (
                  <div key={field}>
                    <span className="text-sm font-medium">{fieldLabels[field] || field}:</span>
                    <span className="text-sm ml-2">{value || '（空欄に変更）'}</span>
                  </div>
                ))}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium">
                コメント（任意）
              </label>
              <textarea
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="リクエスターへのコメント"
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                rows={2}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApproveDialog(false)
                  setAdminComment('')
                  setError(null)
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-foreground text-background rounded-lg hover:bg-foreground/90 disabled:opacity-50"
              >
                {isProcessing ? '処理中...' : '承認して変更を適用'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 却下ダイアログ */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold mb-4">変更リクエストを却下</h3>

            <p className="text-sm text-muted-foreground mb-4">
              「{shopName}」への変更リクエストを却下します。
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium">
                却下理由（任意）
              </label>
              <textarea
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="却下の理由を入力"
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectDialog(false)
                  setAdminComment('')
                  setError(null)
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
              >
                {isProcessing ? '処理中...' : '却下する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
