/**
 * @module components/shop/StarRating
 */

'use client'

import { useState } from 'react'

interface StarRatingProps {
  rating: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onChange?: (rating: number) => void
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

export function StarRating({ rating, size = 'md', interactive = false, onChange }: StarRatingProps) {

  const [hoverRating, setHoverRating] = useState(0)

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const displayRating = hoverRating || rating
  const fullStars = Math.floor(displayRating)
  const hasHalfStar = displayRating % 1 >= 0.5

  const handleClick = (index: number) => {
    if (interactive && onChange) {
      onChange(index)
    }
  }

  const handleMouseEnter = (index: number) => {
    if (interactive) {
      setHoverRating(index)
    }
  }

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0)
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((index) => {
        const isFilled = index <= fullStars || (index === fullStars + 1 && hasHalfStar)

        return (
          <button
            key={index}
            type="button"
            disabled={!interactive}
            onClick={() => handleClick(index)}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
            aria-label={`${index}つ星`}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform disabled:cursor-default`}
          >
            <StarIcon
              filled={isFilled}
              className={`${sizeClasses[size]} ${isFilled ? 'text-amber-500' : 'text-muted'}`}
            />
          </button>
        )
      })}
    </div>
  )
}

export function StarRatingInput({ value, onChange, size = 'md' }: {
  value: number
  onChange: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
}) {
  return <StarRating rating={value} onChange={onChange} size={size} interactive />
}

export function StarRatingDisplay({ rating, size = 'md', showValue = false }: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean
}) {

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((index) => {
          if (index <= fullStars) {
            return (
              <StarIcon key={index} filled className={`${sizeClasses[size]} text-amber-500`} />
            )
          } else if (index === fullStars + 1 && hasHalfStar) {
            return (
              <div key={index} className="relative">
                <StarIcon filled={false} className={`${sizeClasses[size]} text-muted`} />
                <div className="absolute inset-0 overflow-hidden w-1/2">
                  <StarIcon filled className={`${sizeClasses[size]} text-amber-500`} />
                </div>
              </div>
            )
          } else {
            return (
              <StarIcon key={index} filled={false} className={`${sizeClasses[size]} text-muted`} />
            )
          }
        })}
      </div>

      {showValue && (
        <span className="text-sm text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}
