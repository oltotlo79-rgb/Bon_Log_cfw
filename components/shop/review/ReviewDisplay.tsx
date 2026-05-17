'use client'

/**
 * @file ReviewDisplay.tsx
 * @description レビュー表示コンポーネント（読み取り専用）
 *
 * 評価、コメント、画像を表示する読み取り専用ビュー。
 */

import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { StarRatingDisplay } from '../StarRating'
import { ReportButton } from '@/components/report/ReportButton'

/**
 * ゴミ箱アイコンコンポーネント
 */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

/**
 * 鉛筆アイコンコンポーネント
 */
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

interface ReviewDisplayProps {
  review: {
    id: string
    rating: number
    content: string | null
    createdAt: Date | string
    user: {
      id: string
      nickname: string
      avatarUrl: string | null
    }
    images: { id: string; url: string }[]
  }
  isOwner: boolean
  currentUserId?: string
  /** 削除確認中かどうか */
  showDeleteConfirm: boolean
  /** 削除処理中かどうか */
  isPending: boolean
  onEdit: () => void
  onShowDeleteConfirm: () => void
  onCancelDelete: () => void
  onDelete: () => void
}

/**
 * レビュー読み取り専用表示コンポーネント
 */
export function ReviewDisplay({
  review,
  isOwner,
  currentUserId,
  showDeleteConfirm,
  isPending,
  onEdit,
  onShowDeleteConfirm,
  onCancelDelete,
  onDelete,
}: ReviewDisplayProps) {
  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  return (
    <>
      {/* ヘッダー: ユーザー情報、投稿日時、アクションボタン */}
      <div className="flex items-start gap-3 mb-3">
        {/* ユーザーアバター */}
        <Link href={`/users/${review.user.id}`} className="flex-shrink-0">
          {review.user.avatarUrl ? (
            <Image
              src={review.user.avatarUrl}
              alt={review.user.nickname}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                {review.user.nickname.charAt(0)}
              </span>
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/users/${review.user.id}`}
              className="font-medium hover:underline"
            >
              {review.user.nickname}
            </Link>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          <StarRatingDisplay rating={review.rating} size="sm" />
        </div>

        {/* アクションボタンエリア */}
        <div className="flex items-center gap-1">
          {isOwner ? (
            showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onCancelDelete}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  キャンセル
                </button>
                <button
                  onClick={onDelete}
                  disabled={isPending}
                  className="text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  {isPending ? '削除中...' : '削除する'}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={onEdit}
                  className="p-1 text-muted-foreground hover:text-primary"
                  title="編集"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={onShowDeleteConfirm}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  title="削除"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </>
            )
          ) : currentUserId ? (
            <ReportButton
              targetType="review"
              targetId={review.id}
              variant="icon"
            />
          ) : null}
        </div>
      </div>

      {/* コメント表示 */}
      {review.content && (
        <p className="text-sm whitespace-pre-wrap mb-3">{review.content}</p>
      )}

      {/* 画像表示 */}
      {review.images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {review.images.map((image) => (
            <div key={image.id} className="relative w-24 h-24">
              <Image
                src={image.url}
                alt="レビュー画像"
                fill
                className="object-cover rounded-lg"
              />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
