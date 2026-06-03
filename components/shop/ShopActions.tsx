/**
 * @module components/shop/ShopActions
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buildShopEditPath } from '@/lib/constants/path-builders'
import { ShopChangeRequestForm } from './ShopChangeRequestForm'
import { ReportButton } from '@/components/report/ReportButton'

interface ShopInfo {
  id: string
  name: string
  address: string
  phone: string | null
  website: string | null
  businessHours: string | null
  closedDays: string | null
}

interface ShopActionsProps {
  shop: ShopInfo
  isOwner: boolean
  isLoggedIn: boolean
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function ShopActions({ shop, isOwner, isLoggedIn }: ShopActionsProps) {
  const [showChangeRequestForm, setShowChangeRequestForm] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2">
        {isOwner ? (
          <Link
            href={buildShopEditPath(shop.id)}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted"
          >
            <EditIcon className="w-4 h-4" />
            <span>編集</span>
          </Link>
        ) : isLoggedIn ? (
          <>
            <button
              onClick={() => setShowChangeRequestForm(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              <MessageSquareIcon className="w-4 h-4" />
              <span>情報の修正をリクエスト</span>
            </button>
            <ReportButton
              targetType="shop"
              targetId={shop.id}
              variant="text"
              className="px-3 py-2 border rounded-lg hover:bg-destructive/10"
            />
          </>
        ) : null}
      </div>

      {showChangeRequestForm && (
        <ShopChangeRequestForm
          shop={shop}
          onClose={() => setShowChangeRequestForm(false)}
        />
      )}
    </>
  )
}
