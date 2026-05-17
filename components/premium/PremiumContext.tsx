/**
 * プレミアム会員フラグを配下の Client Component に共有する Context。
 *
 * サーバーコンポーネントから取得した `isPremium` を `PremiumContextProvider`
 * 経由で Client 配下に流し、広告コンポーネントなどが `usePremium()` で参照する。
 *
 * 値は JWT には載せず常に DB から取得する（期限切れや解約を即反映するため）。
 *
 * @module components/premium/PremiumContext
 */

'use client'

import { createContext, useContext, type ReactNode } from 'react'

const PremiumContext = createContext<boolean>(false)

/** プレミアム会員かどうかを返す。未ログイン・未プレミアムなら `false`。 */
export function usePremium(): boolean {
  return useContext(PremiumContext)
}

export function PremiumContextProvider({
  isPremium,
  children,
}: {
  isPremium: boolean
  children: ReactNode
}) {
  return (
    <PremiumContext.Provider value={isPremium}>{children}</PremiumContext.Provider>
  )
}
