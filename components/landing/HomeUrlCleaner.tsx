'use client'

import { useEffect } from 'react'
import { HOME_RETURN_PARAM } from '@/lib/constants/routes'

/**
 * ランディング着地後に一過性の遷移マーカー (`?from=...`) を URL から除去する。
 *
 * Why: 「ログアウト → /login → トップへ戻る」では、ログイン中に proxy がキャッシュした
 * `/` → `/feed` 認証依存リダイレクトの再生を避けるため、敢えてクエリ付き URL
 * (`/?from=auth`) へ遷移している (app/(auth)/layout.tsx)。着地後はクエリを履歴から
 * 消してユーザーに見える URL を `/` に戻す。replaceState のみで再ナビゲーションは
 * 起こさない（キャッシュ済みリダイレクトを再評価させないため）。
 */
export function HomeUrlCleaner() {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(HOME_RETURN_PARAM)) return
    url.searchParams.delete(HOME_RETURN_PARAM)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  return null
}
