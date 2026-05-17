/**
 * @file EventList.tsx
 * @description イベント一覧表示コンポーネント
 *
 * 目的:
 * - 複数のイベントをグリッドレイアウトで一覧表示する
 * - レスポンシブデザインに対応したイベント表示を提供する
 * - イベントがない場合のフォールバックメッセージを表示する
 *
 * 機能概要:
 * - イベント配列をEventCardコンポーネントで表示
 * - レスポンシブグリッドレイアウト（モバイル: 1列、タブレット: 2列、デスクトップ: 可変）
 * - 空の状態（イベントなし）の表示
 *
 * 使用例:
 * ```tsx
 * // 基本的な使用方法
 * <EventList events={events} />
 *
 * // カスタムメッセージを指定
 * <EventList
 *   events={[]}
 *   emptyMessage="該当するイベントが見つかりません"
 * />
 * ```
 */

// 個々のイベントを表示するカードコンポーネント
import { Fragment } from 'react'
import { EventCard } from './EventCard'
import { InFeedAdSlot } from '@/components/ads'
import { EVENTS_AD_INTERVAL } from '@/lib/constants/limits'

/**
 * イベントデータの型定義
 * EventCardに渡すイベント情報の構造を定義
 */
interface Event {
  /** イベントの一意識別子 */
  id: string
  /** イベントのタイトル */
  title: string
  /** イベント開始日時 */
  startDate: Date
  /** イベント終了日時（単日イベントの場合はnull） */
  endDate: Date | null
  /** 開催都道府県（未設定の場合はnull） */
  prefecture: string | null
  /** 開催市区町村（未設定の場合はnull） */
  city: string | null
  /** 会場名（未設定の場合はnull） */
  venue: string | null
  /** 入場料の表示テキスト（例: "500円"、"無料"） */
  admissionFee: string | null
  /** 即売会があるかどうか */
  hasSales: boolean
}

/**
 * EventListコンポーネントのプロパティ型定義
 */
interface EventListProps {
  /** 表示するイベントの配列 */
  events: Event[]
  /** イベントが0件の場合に表示するメッセージ（デフォルト: "イベントがありません"） */
  emptyMessage?: string
}

/**
 * イベント一覧コンポーネント
 * イベント配列を受け取り、グリッドレイアウトでカード形式に表示する
 *
 * @param props - コンポーネントのプロパティ
 * @param props.events - 表示するイベントの配列
 * @param props.emptyMessage - イベントがない場合のメッセージ
 * @returns イベント一覧のReact要素
 */
export function EventList({ events, emptyMessage = 'イベントがありません' }: EventListProps) {
  // イベントが0件の場合、空の状態を表示
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  // イベントをグリッドレイアウトで表示
  // - デフォルト: 1列
  // - sm (640px以上): 2列
  // - lg (1024px以上): 1列（サイドバーとの組み合わせを考慮）
  // - xl (1280px以上): 2列
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {events.map((event, index) => (
        <Fragment key={event.id}>
          <EventCard event={event} />
          <InFeedAdSlot
            index={index}
            total={events.length}
            interval={EVENTS_AD_INTERVAL}
            className="col-span-full my-4"
          />
        </Fragment>
      ))}
    </div>
  )
}
