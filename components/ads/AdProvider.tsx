'use client'

/**
 * @file AdProvider.tsx
 * @description 広告プロバイダー切り替えコンポーネント
 *
 * 環境変数 NEXT_PUBLIC_AD_PROVIDER で広告配信元を切り替える。
 * - "adsense" → Google AdSense
 * - "ninja"（デフォルト）→ 忍者AdMax
 *
 * AdSense審査通過後は環境変数を "adsense" に変えるだけで切り替え完了。
 */

import { useSyncExternalStore } from 'react'
import { AdBanner, InFeedAd, SidebarAd } from './AdBanner'
import { NinjaAd, NinjaInFeedAd, NinjaSidebarAd } from './NinjaAdMax'
import { GoogleAdSense } from './GoogleAdSense'
import { isTrackingAllowed } from '@/components/common/CookieConsent'
import { usePremium } from '@/components/premium/PremiumContext'

function isAdSense(): boolean {
  return process.env.NEXT_PUBLIC_AD_PROVIDER === 'adsense'
}

/** Cookie同意状態をSSR安全に取得するフック */
function useTrackingAllowed(): boolean {
  return useSyncExternalStore(
    // subscribe: localStorageの変更を監視（storageイベント）
    (cb) => {
      window.addEventListener('storage', cb)
      return () => window.removeEventListener('storage', cb)
    },
    // getSnapshot: クライアントでlocalStorageから読み取り
    () => isTrackingAllowed(),
    // getServerSnapshot: SSR時はfalse（同意不明）
    () => false,
  )
}

/**
 * 広告プロバイダーのスクリプトローダー
 *
 * 以下を全て満たす場合のみ広告スクリプトを読み込む:
 * - Cookie同意が「すべて同意」（GDPR/Cookie規制準拠）
 * - 無料会員（プレミアム会員は広告非表示）
 */
export function AdProvider() {
  const allowed = useTrackingAllowed()
  const isPremium = usePremium()

  if (isPremium) return null
  if (!allowed) return null
  if (isAdSense()) {
    return <GoogleAdSense />
  }
  // 忍者AdMaxはスクリプトローダー不要（各広告枠で個別に読み込む）
  return null
}

/**
 * フィード内広告ユニット
 * プロバイダーに応じてAdSenseまたは忍者AdMaxのフィード内広告を表示
 */
export function InFeedAdUnit({ className = '' }: { className?: string }) {
  const allowed = useTrackingAllowed()
  const isPremium = usePremium()
  if (isPremium) return null
  if (!allowed) return null
  if (isAdSense()) {
    return (
      <InFeedAd
        adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_INFEED}
        className={className}
      />
    )
  }
  return (
    <NinjaInFeedAd
      adId={process.env.NEXT_PUBLIC_NINJA_AD_ID_INFEED}
      className={className}
    />
  )
}

/**
 * サイドバー広告ユニット
 * プロバイダーに応じてAdSenseまたは忍者AdMaxのサイドバー広告を表示
 */
export function SidebarAdUnit({ className = '' }: { className?: string }) {
  const allowed = useTrackingAllowed()
  const isPremium = usePremium()
  if (isPremium) return null
  if (!allowed) return null
  if (isAdSense()) {
    return (
      <SidebarAd
        adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR}
        className={className}
      />
    )
  }
  return (
    <NinjaSidebarAd
      adId={process.env.NEXT_PUBLIC_NINJA_AD_ID_SIDEBAR}
      className={className}
    />
  )
}

/**
 * 投稿詳細広告ユニット
 * プロバイダーに応じてAdSenseまたは忍者AdMaxの広告を表示
 *
 * ページ末尾で使われるため、固定幅の NinjaAd (300x250) が左寄りにならないよう
 * flex で水平中央に揃える。AdSense 側 (responsive 100%) は影響なし。
 */
export function PostDetailAdUnit({ className = '' }: { className?: string }) {
  const allowed = useTrackingAllowed()
  const isPremium = usePremium()
  if (isPremium) return null
  if (!allowed) return null
  if (isAdSense()) {
    return (
      <div className={`flex justify-center ${className}`}>
        <AdBanner
          adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_POST_DETAIL}
          size="responsive"
          format="auto"
        />
      </div>
    )
  }
  return (
    <div className={`flex justify-center ${className}`}>
      <NinjaAd adId={process.env.NEXT_PUBLIC_NINJA_AD_ID_POST_DETAIL} />
    </div>
  )
}
