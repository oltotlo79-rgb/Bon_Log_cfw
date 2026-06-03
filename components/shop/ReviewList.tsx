/**
 * @module components/shop/ReviewList
 */
'use client'

import { ReviewCard } from './ReviewCard'

interface Review {
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

interface ReviewListProps {
  reviews: Review[]
  currentUserId?: string
}

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function ReviewList({ reviews, currentUserId }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-8" data-testid="shop-review-empty">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
          <MessageSquareIcon className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">
          まだレビューがありません
        </p>
      </div>
    )
  }

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
