/**
 * @module components/shop/ShopList
 */
'use client'

import { Fragment } from 'react'
import { ShopCard } from './ShopCard'
import { InFeedAdSlot } from '@/components/ads'
import { SHOPS_AD_INTERVAL } from '@/lib/constants/limits'

interface Genre {
  id: string
  name: string
  category: string
}

interface Shop {
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

interface ShopListProps {
  shops: Shop[]
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function ShopList({ shops }: ShopListProps) {
  if (shops.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <MapPinIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">盆栽園が見つかりません</h3>
        <p className="text-muted-foreground">
          検索条件を変更するか、新しい盆栽園を登録してください
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {shops.map((shop, index) => (
        <Fragment key={shop.id}>
          <ShopCard shop={shop} />
          <InFeedAdSlot
            index={index}
            total={shops.length}
            interval={SHOPS_AD_INTERVAL}
            className="col-span-full my-4"
          />
        </Fragment>
      ))}
    </div>
  )
}
