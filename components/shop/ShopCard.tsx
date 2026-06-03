'use client'

import Link from 'next/link'
import { StarRatingDisplay } from './StarRating'
import { buildShopPath } from '@/lib/constants/path-builders'

interface Genre {
  id: string
  name: string
  category: string
}

interface ShopCardProps {
  shop: {
    id: string
    name: string
    address: string
    phone?: string | null
    website?: string | null
    businessHours?: string | null
    closedDays?: string | null
    genres: Genre[]
    averageRating: number | null
    reviewCount: number
  }
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function ShopCard({ shop }: ShopCardProps) {
  return (
    <Link
      href={buildShopPath(shop.id)}
      className="block bg-card rounded-lg border p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-lg">{shop.name}</h3>
          {shop.averageRating !== null && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <StarRatingDisplay rating={shop.averageRating} size="sm" />
              <span className="text-xs text-muted-foreground">
                ({shop.reviewCount})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPinIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{shop.address}</span>
        </div>

        {shop.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PhoneIcon className="w-4 h-4 flex-shrink-0" />
            <span>{shop.phone}</span>
          </div>
        )}

        {shop.businessHours && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClockIcon className="w-4 h-4 flex-shrink-0" />
            <span>{shop.businessHours}</span>
          </div>
        )}

        {shop.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {shop.genres.map((genre) => (
              <span
                key={genre.id}
                className="text-xs px-2 py-0.5 bg-muted rounded-full"
              >
                {genre.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
