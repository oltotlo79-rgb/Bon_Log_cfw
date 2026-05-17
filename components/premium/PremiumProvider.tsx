/**
 * プレミアム状態を Client Context に注入するサーバー側ラッパー。
 *
 * ログイン中ユーザーの `isPremium` を DB から取得し、{@link PremiumContextProvider}
 * に `isPremium` を渡してツリー全体に共有する。未ログイン時は `false`。
 *
 * `isPremiumUser` は `getMembershipLimits` と同じく React `cache()` で
 * メモ化されているため、同一リクエスト内で複数回呼んでも DB アクセスは 1 回。
 *
 * @module components/premium/PremiumProvider
 */

import 'server-only'
import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { isPremiumUser } from '@/lib/premium'
import { PremiumContextProvider } from './PremiumContext'

export async function PremiumProvider({ children }: { children: ReactNode }) {
  const session = await auth()
  const userId = session?.user?.id
  const isPremium = userId ? await isPremiumUser(userId) : false

  return (
    <PremiumContextProvider isPremium={isPremium}>{children}</PremiumContextProvider>
  )
}
