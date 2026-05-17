/**
 * @file EventCalendarWrapper.tsx
 * @description イベントカレンダーラッパーコンポーネント
 *
 * 目的:
 * - EventCalendarコンポーネントをラップして統一的なインターフェースを提供する
 * - 初期表示年月のパラメータを受け取りEventCalendarに渡す
 *
 * 機能概要:
 * - EventCalendarの直接インポートによるシンプルなラッパー
 * - EventCalendarはdate-fnsとuseStateのみ使用しブラウザAPI非依存のため、SSR可能
 *
 * 使用例:
 * ```tsx
 * // Server Componentから使用可能
 * export default async function EventsPage() {
 *   const events = await getEvents();
 *   return <EventCalendarWrapper events={events} />;
 * }
 * ```
 */

'use client'

import { EventCalendar } from './EventCalendar'

/**
 * イベントデータの型定義
 * EventCalendarに渡すイベント情報の構造を定義
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
  /** 開催都道府県（カレンダー表示では使用しないがデータ型を統一） */
  prefecture: string | null
}

/**
 * EventCalendarWrapperコンポーネントのプロパティ型定義
 */
interface EventCalendarWrapperProps {
  /** 表示するイベントの配列 */
  events: Event[]
  /** 初期表示年（URLから取得） */
  initialYear?: number
  /** 初期表示月（1-12、URLから取得） */
  initialMonth?: number
}

/**
 * イベントカレンダーラッパーコンポーネント
 * EventCalendarコンポーネントをラップして統一的なインターフェースを提供する。
 * EventCalendarはdate-fnsとuseStateのみ使用しブラウザAPI非依存のため、SSR可能。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.events - 表示するイベントの配列
 * @param props.initialYear - 初期表示年
 * @param props.initialMonth - 初期表示月（1-12）
 * @returns EventCalendarコンポーネント
 */
export function EventCalendarWrapper({ events, initialYear, initialMonth }: EventCalendarWrapperProps) {
  return <EventCalendar events={events} initialYear={initialYear} initialMonth={initialMonth} />
}
