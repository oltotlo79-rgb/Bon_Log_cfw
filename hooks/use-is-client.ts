'use client'

/**
 * SSR では `false`、hydration 完了後は `true` を返す client-only flag hook。
 *
 * - `useSyncExternalStore` を使うことで cascading render と
 *   `react-hooks/set-state-in-effect` lint 違反を回避する (React 19 idiomatic)
 * - subscribe は no-op: 値は決して変化しない (mount 後は true 固定)
 *
 * Why shared: hydration mismatch を避ける client-only 分岐は複数 component で必要なので
 * (例: AnimatedInkImage / LandingThemeToggle) 共有 hook として lib/hooks に集約する。
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isClient = useIsClient()
 *   return isClient ? <ClientOnlyUI /> : <Placeholder />
 * }
 * ```
 *
 * @module hooks/use-is-client
 */

import { useSyncExternalStore } from 'react'

/** subscribe で参照される空関数。値が変わらないので何も購読しなくてよい。 */
const noopSubscribe = () => () => {}

/**
 * SSR では `false`、hydration 完了後は `true` を返す。
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true, // client snapshot: hydration 後は常に true
    () => false, // server snapshot: SSR では false
  )
}
