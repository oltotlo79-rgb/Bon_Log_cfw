'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { reviewModerationItem, bulkReviewModeration } from '@/lib/actions/admin/moderation'
import { buildPostPath, buildEventPath, buildShopPath, buildUserPath } from '@/lib/constants/path-builders'
import { useToast } from '@/hooks/use-toast'

/**
 * モデレーションアイテムのシリアライズ済み型
 */
interface ModerationItem {
  id: string
  targetType: string
  targetId: string
  status: string
  reason: string
  matchedWords: string[]
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
}

interface ModerationQueueListProps {
  /** モデレーションアイテム一覧 */
  items: ModerationItem[]
}

/**
 * ステータスの日本語ラベル定義
 */
const statusLabels: Record<string, string> = {
  pending: '未対応',
  auto_flagged: '自動フラグ',
  approved: '承認済み',
  rejected: '却下済み',
}

/**
 * ステータスに応じた色クラス定義
 */
const statusColors: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-800',
  auto_flagged: 'bg-red-100 text-red-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-gray-100 text-gray-800',
}

/**
 * 対象タイプの日本語ラベル定義
 */
const targetTypeLabels: Record<string, string> = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  user: 'ユーザー',
}

/**
 * 対象タイプに応じたリンクパスを返す
 */
function getTargetLink(targetType: string, targetId: string): string | null {
  switch (targetType) {
    case 'post':
      return buildPostPath(targetId)
    case 'comment':
      return null
    case 'event':
      return buildEventPath(targetId)
    case 'shop':
      return buildShopPath(targetId)
    case 'user':
      return buildUserPath(targetId)
    default:
      return null
  }
}

/**
 * モデレーションキュー一覧コンポーネント
 * テーブル形式でアイテムを表示し、個別・一括の承認/却下操作を提供する
 */
export function ModerationQueueList({
  items,
}: ModerationQueueListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allSelected = items.length > 0 && selectedIds.size === items.length
  const someSelected = selectedIds.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)))
    }
  }

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleReview = async (id: string, action: 'approved' | 'rejected') => {
    setIsSubmitting(true)
    const result = await reviewModerationItem(id, action)
    setIsSubmitting(false)

    if ('error' in result) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    toast({ title: action === 'approved' ? '承認しました' : '却下しました' })
    router.refresh()
  }

  const handleBulkReview = async (action: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return

    setIsSubmitting(true)
    const result = await bulkReviewModeration(Array.from(selectedIds), action)
    setIsSubmitting(false)

    if ('error' in result) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    toast({
      title: `${selectedIds.size} 件を${action === 'approved' ? '承認' : '却下'}しました`,
    })
    setSelectedIds(new Set())
    router.refresh()
  }

  return (
    <>
      {someSelected && (
        <div className="bg-card rounded-lg border p-4 flex items-center gap-4">
          <span className="text-sm font-medium">{selectedIds.size} 件選択中</span>
          <button
            onClick={() => handleBulkReview('approved')}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            一括承認
          </button>
          <button
            onClick={() => handleBulkReview('rejected')}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            一括却下
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
          >
            選択解除
          </button>
        </div>
      )}

      <div className="bg-card rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium">対象タイプ</th>
              <th className="text-left px-4 py-3 text-sm font-medium">NGワード</th>
              <th className="text-left px-4 py-3 text-sm font-medium">理由</th>
              <th className="text-left px-4 py-3 text-sm font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-sm font-medium">検出日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const targetLink = getTargetLink(item.targetType, item.targetId)
              return (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs bg-muted rounded-full">
                      {targetTypeLabels[item.targetType] || item.targetType}
                    </span>
                    {targetLink && (
                      <Link
                        href={targetLink}
                        target="_blank"
                        className="ml-2 text-xs text-primary hover:underline"
                      >
                        確認
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.matchedWords.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.matchedWords.map((word, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm line-clamp-2 max-w-[200px]">{item.reason}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        statusColors[item.status] || 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {statusLabels[item.status] || item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    {(item.status === 'pending' || item.status === 'auto_flagged') ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(item.id, 'approved')}
                          disabled={isSubmitting}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleReview(item.id, 'rejected')}
                          disabled={isSubmitting}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          却下
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {item.reviewedAt
                          ? `${new Date(item.reviewedAt).toLocaleDateString('ja-JP')} 対応済み`
                          : '対応済み'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  モデレーション対象が見つかりません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </>
  )
}
