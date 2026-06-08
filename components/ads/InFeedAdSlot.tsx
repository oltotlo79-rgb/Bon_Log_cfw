/**
 * @module components/ads/InFeedAdSlot
 * N 件ごとに 1 枠を挿入する判定・末尾に広告を残さない配慮・1 ページの上限本数を集約し、
 * 各ページは map 内に `<InFeedAdSlot>` を差し込むだけで一貫した挿入ルールを適用できる。
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

/**
 * 一覧が短く `total <= interval` で in-feed 広告が 1 枠も挿入されない場合に、
 * 一覧末尾へ広告を 1 枠だけ表示するフォールバック。
 *
 * `null` を返す条件:
 * - プレミアム会員
 * - `interval` が 1 未満
 * - 空一覧 (`total <= 0`)
 * - in-feed 広告が出る件数 (`total > interval`) ＝ 末尾フォールバック不要
 */
export function InFeedAdTailFallback({
  total,
  interval,
  className = DEFAULT_CONTAINER_CLASSNAME,
}: {
  total: number
  interval: number
  className?: string
}) {
  const isPremium = usePremium()
  if (isPremium) return null
  if (interval < 1) return null
  if (total <= 0) return null
  if (total > interval) return null

  return (
    <aside aria-label="広告" className={className}>
      <InFeedAdUnit />
    </aside>
  )
}
