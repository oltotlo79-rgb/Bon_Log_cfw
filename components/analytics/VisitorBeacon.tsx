'use client'

/**
 * ページ訪問を `POST /api/analytics/track` に通知するクライアント側ビーコン。
 *
 * 配置: ルート layout の `<body>` 配下で全ページに常駐させる。
 *
 * Cookie consent 連動:
 *   `/api/analytics/track` は HttpOnly Cookie `bon_log_visitor_id` を発行するため、
 *   GDPR / Cookie banner で「すべて同意 (all)」を選択するまで beacon を発火させない。
 *   essential / 未選択時はネットワーク呼び出しごとスキップする。
 *
 * 実装メモ:
 *   localStorage の値変化は React 18+ の `useSyncExternalStore` で購読する。
 *   `useEffect` 内で setState すると ESLint の `react-hooks/set-state-in-effect` を
 *   発火し、カスケード描画も誘発するため、external store を直接 subscribe する。
 */

import { useEffect, useSyncExternalStore } from 'react'
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  isTrackingAllowed,
} from '@/components/common/CookieConsent'

function subscribeConsent(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === COOKIE_CONSENT_STORAGE_KEY) callback()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, callback)
  }
}

function getTrackingSnapshot(): boolean {
  return isTrackingAllowed()
}

/** SSR では常に false を返す。client hydration 後に実値へ切り替わる。 */
function getTrackingServerSnapshot(): boolean {
  return false
}

export function VisitorBeacon() {
  const trackingAllowed = useSyncExternalStore(
    subscribeConsent,
    getTrackingSnapshot,
    getTrackingServerSnapshot,
  )

  useEffect(() => {
    if (!trackingAllowed) return
    fetch('/api/analytics/track', {
      method: 'POST',
      credentials: 'include',
      // SPA ナビ中にバックグラウンドで送信できるよう keepalive を許可
      keepalive: true,
    }).catch(() => {
      // 解析失敗はユーザー体験に影響させないため握りつぶす
    })
  }, [trackingAllowed])

  return null
}
