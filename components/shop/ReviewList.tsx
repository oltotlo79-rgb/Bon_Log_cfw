/**
 * @file ReviewList.tsx
 * @description 盆栽園レビュー一覧表示コンポーネント
 *
 * 機能概要:
 * - 盆栽園のレビューを一覧形式で表示する
 * - レビューが0件の場合は空状態のメッセージを表示する
 * - 各レビューはReviewCardコンポーネントで表示される
 * - 現在のユーザーIDを渡すことで、自分のレビューの編集/削除が可能
 *
 * 使用例:
 * ```tsx
 * <ReviewList
 *   reviews={reviews}
 *   currentUserId={session?.user?.id}
 * />
 * ```
 */
'use client'

// 個別レビューカードコンポーネント
// レビュー内容、評価、ユーザー情報、画像を表示
import { ReviewCard } from './ReviewCard'

/**
 * レビュー情報の型定義
 */
interface Review {
  /** レビューの一意識別子 */
  id: string
  /** 評価（1〜5の整数） */
  rating: number
  /** レビューコメント（任意） */
  content: string | null
  /** レビュー投稿日時 */
  createdAt: Date | string
  /** レビュー投稿者の情報 */
  user: {
    /** ユーザーID */
    id: string
    /** ニックネーム */
    nickname: string
    /** アバター画像URL（任意） */
    avatarUrl: string | null
  }
  /** レビューに添付された画像の配列 */
  images: { id: string; url: string }[]
}

/**
 * ReviewListコンポーネントのプロパティ定義
 */
interface ReviewListProps {
  /** 表示するレビューの配列 */
  reviews: Review[]
  /** 現在ログインしているユーザーのID（編集/削除ボタン表示判定用） */
  currentUserId?: string
}

/**
 * メッセージアイコン（吹き出し）コンポーネント
 * レビューが0件の場合の空状態表示に使用
 *
 * @param className - 追加のCSSクラス名
 */
function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/**
 * レビュー一覧表示コンポーネント
 *
 * 盆栽園のレビューを時系列で表示する。
 * レビューが0件の場合は、「まだレビューがありません」というメッセージを表示。
 * 各レビューはReviewCardコンポーネントで個別に表示され、
 * 自分のレビューには編集・削除ボタンが表示される。
 *
 * @param reviews - レビューの配列
 * @param currentUserId - 現在のユーザーID（自分のレビュー判定用）
 */
export function ReviewList({ reviews, currentUserId }: ReviewListProps) {
  // レビューが0件の場合、空状態のメッセージを表示
  if (reviews.length === 0) {
    return (
      <div className="text-center py-8" data-testid="shop-review-empty">
        {/* アイコン表示エリア */}
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
          <MessageSquareIcon className="w-6 h-6 text-muted-foreground" />
        </div>
        {/* 空状態メッセージ */}
        <p className="text-muted-foreground">
          まだレビューがありません
        </p>
      </div>
    )
  }

  // レビュー一覧を表示
  return (
    <div>
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}
