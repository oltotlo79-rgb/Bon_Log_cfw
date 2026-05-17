'use client'

/**
 * @module components/analytics/ViewBeacon
 * Server Component の render から analytics の DB write を切り離すための
 * fire-and-forget ビーコン。`useEffect` でマウント直後に 1 回だけ
 * `navigator.sendBeacon` で `POST /api/analytics/view` を叩く。
 *
 * Why Server Component で recordPostView / recordProfileView を呼ばない:
 *   - render は冪等であるべきだが、書き込みを含めると prefetch / RSC retry /
 *     crawler access でも view が増える
 *   - 閲覧可否判定の前に書き込まれると non-public / blocked にも記録されうる
 *
 * Route Handler 側で
 *   1. 認証 (recordX 系は session.user.id 必須)
 *   2. Zod 検証
 *   3. 閲覧権限再確認
 *   4. Redis 短期 dedupe
 *   5. recordPostView / recordProfileView
 * を行う。
 */

import { useEffect, useRef } from 'react'
import { ROUTE_API_ANALYTICS_VIEW } from '@/lib/constants/routes'

type ViewBeaconProps =
  | { type: 'post'; postId: string; targetUserId: string }
  | { type: 'profile'; targetUserId: string }

export function ViewBeacon(props: ViewBeaconProps) {
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true

    const body = JSON.stringify(props)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(ROUTE_API_ANALYTICS_VIEW, blob)
      return
    }
    fetch(ROUTE_API_ANALYTICS_VIEW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // 集計失敗は UX に影響させない
    })
  }, [props])

  return null
}
