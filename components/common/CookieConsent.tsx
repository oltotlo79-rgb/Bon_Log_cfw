'use client'

/**
 * @module components/common/CookieConsent
 *
 * GDPR / Cookie 規制対応の同意バナー。初回訪問時に表示し、
 * 「すべて同意 (all)」を選ぶまで分析・広告 Cookie の発行を抑止する。
 * 同意状態は localStorage に永続化し、`isTrackingAllowed()` を購読する側
 * (例: `VisitorBeacon`) が同タブで即時反映できるよう、変更時に
 * `cookie-consent-change` カスタムイベントを発火する。
 */

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ROUTE_PRIVACY } from '@/lib/constants/routes'

/** localStorage のキー (storage event で他タブと同期するため export する) */
export const COOKIE_CONSENT_STORAGE_KEY = 'cookie-consent'

/** 同タブでの同意変更を通知する CustomEvent 名。 */
export const COOKIE_CONSENT_CHANGE_EVENT = 'cookie-consent-change'

/** 同意レベル */
export type ConsentLevel = 'all' | 'essential' | null

/** Cookie 同意状態を取得する (localStorage に依存するためクライアント専用)。 */
export function getCookieConsent(): ConsentLevel {
  if (typeof window === 'undefined') return null
  const value = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
  if (value === 'all' || value === 'essential') return value
  return null
}

/** 分析・広告 Cookie の発行が許可されているか。essential / 未選択時は false。 */
export function isTrackingAllowed(): boolean {
  return getCookieConsent() === 'all'
}

/** 同意状態を永続化し、同タブ内の購読者へカスタムイベントで通知する。 */
function setConsentLevel(level: Exclude<ConsentLevel, null>): void {
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, level)
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT))
}

export function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return !getCookieConsent()
  })

  const handleAcceptAll = useCallback(() => {
    setConsentLevel('all')
    setVisible(false)
    // VisitorBeacon / AdProvider は COOKIE_CONSENT_CHANGE_EVENT を購読しており、
    // `setConsentLevel` 内で dispatch される CustomEvent によって自動的に
    // 広告スクリプト読み込みと beacon 送信が走るため、フルリロードは不要。
  }, [])

  const handleEssentialOnly = useCallback(() => {
    setConsentLevel('essential')
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie利用の同意"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm shadow-lg"
    >
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 text-sm text-muted-foreground">
            <p>
              当サイトでは、サービス向上・広告配信・アクセス分析のためにCookieを使用しています。
              「すべて同意」を選択すると、広告のパーソナライズやアクセス分析が有効になります。
              詳しくは
              <Link
                href={ROUTE_PRIVACY}
                className="underline hover:text-foreground mx-1"
              >
                プライバシーポリシー
              </Link>
              をご確認ください。
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleEssentialOnly}
              className="px-4 py-2 text-sm border rounded-md bg-background hover:bg-accent transition-colors"
            >
              必要最小限のみ
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              すべて同意
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
