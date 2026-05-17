/**
 * @module components/ads/AdBanner
 * Google AdSense 広告コンポーネント。clientId / adSlot 未設定時は placeholder を出す。
 *
 * 必要 env: NEXT_PUBLIC_ADSENSE_CLIENT_ID
 */
'use client'

import { clientLogger } from '@/lib/client-logger'
import { useEffect, useRef } from 'react'

type AdSize =
  | 'rectangle'
  | 'large-rectangle'
  | 'leaderboard'
  | 'mobile-banner'
  | 'half-page'
  | 'responsive'
  | 'in-feed'

const adSizeStyles: Record<AdSize, { width: string; height: string; minHeight: string }> = {
  'rectangle': { width: '300px', height: '250px', minHeight: '250px' },
  'large-rectangle': { width: '336px', height: '280px', minHeight: '280px' },
  'leaderboard': { width: '728px', height: '90px', minHeight: '90px' },
  'mobile-banner': { width: '320px', height: '100px', minHeight: '100px' },
  'half-page': { width: '300px', height: '600px', minHeight: '600px' },
  'responsive': { width: '100%', height: 'auto', minHeight: '100px' },
  'in-feed': { width: '100%', height: 'auto', minHeight: '120px' },
}

interface AdBannerProps {
  adSlot?: string
  size?: AdSize
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal'
  className?: string
  /** プレースホルダーを強制表示 (dev/レイアウト確認用)。 */
  showPlaceholder?: boolean
}

export function AdBanner({
  adSlot,
  size = 'responsive',
  format = 'auto',
  className = '',
  showPlaceholder = false,
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null)
  const isInitialized = useRef(false)

  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
  const sizeStyle = adSizeStyles[size]

  useEffect(() => {
    if (clientId && adSlot && adRef.current && !isInitialized.current) {
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        isInitialized.current = true
      } catch (error) {
        clientLogger.error('AdSense initialization error:', error)
      }
    }
  }, [clientId, adSlot])

  if (!clientId || !adSlot || showPlaceholder) {
    return (
      <div
        className={`bg-muted/50 border border-dashed border-border rounded-lg flex items-center justify-center ${className}`}
        style={{
          width: sizeStyle.width,
          minHeight: sizeStyle.minHeight,
          maxWidth: '100%',
        }}
      >
        <div className="text-center text-muted-foreground p-4">
          <AdIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">広告スペース</p>
          <p className="text-[10px] opacity-70">{size}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        width: sizeStyle.width,
        minHeight: sizeStyle.minHeight,
        maxWidth: '100%',
      }}
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width: sizeStyle.width,
          height: size === 'responsive' || size === 'in-feed' ? 'auto' : sizeStyle.height,
        }}
        data-ad-client={clientId}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={size === 'responsive' || size === 'in-feed' ? 'true' : 'false'}
      />
    </div>
  )
}

function AdIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
  )
}

/** 投稿フィードの行間に挿入する fluid 広告。 */
export function InFeedAd({
  adSlot,
  className = '',
}: {
  adSlot?: string
  className?: string
}) {
  return (
    <div className={`py-4 ${className}`}>
      <AdBanner
        adSlot={adSlot}
        size="in-feed"
        format="fluid"
        className="mx-auto"
      />
    </div>
  )
}

/** サイドバー向けの rectangle 広告ラッパー。 */
export function SidebarAd({
  adSlot,
  className = '',
}: {
  adSlot?: string
  className?: string
}) {
  return (
    <div className={`${className}`}>
      <AdBanner
        adSlot={adSlot}
        size="rectangle"
        className="mx-auto"
      />
    </div>
  )
}
