/**
 * @file InFeedAdSlot.tsx
 * @description リスト型ページに In-feed 広告を挿入するための共通スロット
 *
 * N 件ごとに 1 枠を挿入する判定・末尾に広告が残らないようにする配慮・
 * 1 ページあたりの上限本数を 1 箇所に集約し、各ページでは map 内に
 * `<InFeedAdSlot>` を差し込むだけで一貫した挿入ルールを適用できる。
 *
 * プレミアム会員判定 (`usePremium`) が必要なため Client Component として動作する。
 * 内部で呼び出している {@link InFeedAdUnit} が Cookie 同意の確認と
 * プロバイダー切替（AdSense / 忍者 AdMax）を担う。
 *
 * @module components/ads/InFeedAdSlot
 */

'use client'

import { InFeedAdUnit } from './AdProvider'
import { MAX_IN_FEED_ADS_PER_PAGE } from '@/lib/constants/limits/ads'
import { usePremium } from '@/components/premium/PremiumContext'

type InFeedAdSlotProps = {
  /** リスト内での現在のアイテムの 0 始まりインデックス */
  index: number
  /** リスト全体の長さ。末尾要素の直後に広告を表示しないために使用 */
  total: number
  /** 何件ごとに 1 枠挿入するか（1 以上） */
  interval: number
  /**
   * 1 ページ内に表示する広告の上限本数。
   * 省略時は {@link MAX_IN_FEED_ADS_PER_PAGE}
   */
  maxAds?: number
  /**
   * 広告を包む aside コンテナに付与するクラス。
   * グリッドレイアウトでの `col-span-full` 指定などに利用する。
   */
  className?: string
}

/** aside コンテナのデフォルトクラス（上下マージン） */
const DEFAULT_CONTAINER_CLASSNAME = 'my-8'

/**
 * リスト要素の直後に条件付きで In-feed 広告を描画する。
 *
 * 以下のいずれかに該当する場合は `null` を返す:
 * - `interval` が 1 未満（呼び出し側の指定ミス）
 * - `(index + 1)` が `interval` の倍数でない
 * - 当該位置がリスト末尾（= 広告で終わらない）
 * - 既に `maxAds` 本の広告を描画済み
 */
export function InFeedAdSlot({
  index,
  total,
  interval,
  maxAds = MAX_IN_FEED_ADS_PER_PAGE,
  className = DEFAULT_CONTAINER_CLASSNAME,
}: InFeedAdSlotProps) {
  const isPremium = usePremium()
  if (isPremium) return null
  if (interval < 1) return null

  const position = index + 1
  if (position % interval !== 0) return null
  if (position >= total) return null
  if (Math.floor(position / interval) > maxAds) return null

  return (
    <aside aria-label="広告" className={className}>
      <InFeedAdUnit />
    </aside>
  )
}
