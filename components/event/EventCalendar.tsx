/**
 * @file EventCalendar.tsx
 * @description イベントカレンダーコンポーネント
 *
 * 目的:
 * - イベントを月間カレンダー形式で視覚的に表示する
 * - 日付ごとのイベントを一目で確認できるようにする
 * - 月の切り替えによる時系列的なイベント閲覧を可能にする
 *
 * 機能概要:
 * - 月間カレンダービューの表示
 * - 前月/次月への移動機能
 * - 「今日」ボタンによる現在月への移動
 * - 日付セルにイベントタイトルを表示
 * - 複数日にまたがるイベントの表示対応
 * - イベントクリックで詳細ページへ遷移
 *
 * 使用例:
 * ```tsx
 * <EventCalendar
 *   events={events}
 *   onMonthChange={(year, month) => {
 *     console.log(`${year}年${month + 1}月に移動`);
 *   }}
 * />
 * ```
 */

// Client Componentとして宣言（useStateを使用するため）
'use client'

// React Hooks - カレンダーの現在月を管理するために使用
import { useState, useCallback } from 'react'

// Next.jsのLinkコンポーネント - イベント詳細ページへの遷移に使用
import Link from 'next/link'

// Next.jsのナビゲーションフック - URLクエリパラメータの更新に使用
import { useRouter, useSearchParams } from 'next/navigation'

// date-fns関数群 - 日付計算とフォーマットに使用
import {
  format,         // 日付を指定形式の文字列にフォーマット
  startOfMonth,   // 月の初日を取得
  endOfMonth,     // 月の末日を取得
  startOfWeek,    // 週の初日を取得
  endOfWeek,      // 週の末日を取得
  eachDayOfInterval, // 期間内の全日付を配列で取得
  isSameMonth,    // 2つの日付が同じ月かどうか判定
  addMonths,      // 月を加算
  subMonths,      // 月を減算
  isToday,        // 今日かどうか判定
} from 'date-fns'

// date-fnsの日本語ロケール - 月名等を日本語で表示するために使用
import { ja } from 'date-fns/locale'
import { CALENDAR_EVENTS_PER_DAY } from '@/lib/constants/limits'

/**
 * イベントデータの型定義
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
 * EventCalendarコンポーネントのプロパティ型定義
 */
interface EventCalendarProps {
  /** 表示するイベントの配列 */
  events: Event[]
  /** 月が変更されたときに呼ばれるコールバック関数 */
  onMonthChange?: (year: number, month: number) => void
  /** 初期表示年（URLから取得） */
  initialYear?: number
  /** 初期表示月（1-12、URLから取得） */
  initialMonth?: number
}

/**
 * 左矢印アイコンコンポーネント
 * 前月への移動ボタンに使用
 *
 * @param className - アイコンに適用するCSSクラス
 * @returns 左矢印アイコンのSVG要素
 */
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 18-6-6 6-6"/>
    </svg>
  )
}

/**
 * 右矢印アイコンコンポーネント
 * 次月への移動ボタンに使用
 *
 * @param className - アイコンに適用するCSSクラス
 * @returns 右矢印アイコンのSVG要素
 */
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}

/**
 * イベントカレンダーコンポーネント
 * 月間カレンダー形式でイベントを表示し、月の切り替えを可能にする
 *
 * @param props - コンポーネントのプロパティ
 * @returns イベントカレンダーのReact要素
 */
export function EventCalendar({ events, onMonthChange, initialYear, initialMonth }: EventCalendarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  /**
   * 初期表示月を計算
   * URLパラメータがある場合はそれを使用、なければ現在の日付
   */
  const getInitialDate = useCallback(() => {
    if (initialYear && initialMonth) {
      return new Date(initialYear, initialMonth - 1, 1)
    }
    return new Date()
  }, [initialYear, initialMonth])

  /**
   * 現在表示している月を管理する状態
   * 初期値はURLパラメータまたは現在の日付
   */
  const [currentMonth, setCurrentMonth] = useState(getInitialDate)

  /**
   * URLのクエリパラメータを更新する関数
   * 既存のパラメータを維持しながら年月を更新
   */
  const updateUrlParams = useCallback((year: number, month: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', year.toString())
    params.set('month', (month + 1).toString()) // monthは0-indexedなので+1
    router.replace(`/events?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  // ------------------------------------------------------------
  // カレンダー表示用の日付計算
  // ------------------------------------------------------------

  // 表示月の初日と末日を取得
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  // カレンダーグリッドの開始日と終了日を取得
  // （週の始まりの日曜日から週の終わりの土曜日まで）
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  // カレンダーに表示する全ての日付を配列で取得
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  /**
   * ISO日付文字列またはDateからYYYY-MM-DD形式の文字列を取得
   * UTCタイムゾーン変換による日付のずれを防ぐため、
   * 常にISO文字列から日付部分を直接抽出する
   *
   * @param date - Dateオブジェクトまたは日付文字列
   * @returns YYYY-MM-DD形式の文字列
   */
  const getDateString = (date: Date | string): string => {
    // 文字列でもDateオブジェクトでも、ISO文字列から日付部分を抽出
    // これによりタイムゾーン変換による日付のずれを防ぐ
    // 例: "2026-05-03T15:00:00.000Z" → "2026-05-03"
    const isoString = typeof date === 'string' ? date : date.toISOString()
    const match = isoString.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match?.[1]) {
      return match[1]
    }
    // フォールバック（通常は到達しない）
    return format(new Date(date), 'yyyy-MM-dd')
  }

  /**
   * 指定した日に開催されているイベントを取得する関数
   * 複数日にまたがるイベントも考慮
   * タイムゾーンの影響を排除するため、日付文字列で比較
   *
   * @param day - 対象の日付
   * @returns その日に開催されているイベントの配列
   */
  const getEventsForDay = (day: Date) => {
    // YYYY-MM-DD形式の文字列で比較（タイムゾーンによるずれを防ぐ）
    const dayStr = format(day, 'yyyy-MM-dd')

    return events.filter((event) => {
      // イベント日付を文字列として比較
      const startStr = getDateString(event.startDate)
      // 終了日がない場合は開始日を終了日として扱う
      const endStr = event.endDate ? getDateString(event.endDate) : startStr
      // 日付文字列が開始日〜終了日の範囲内にあるかチェック
      return dayStr >= startStr && dayStr <= endStr
    })
  }

  /**
   * 前月に移動するハンドラ
   * 表示月を1ヶ月前に変更し、URLを更新する
   */
  const handlePrevMonth = () => {
    const newMonth = subMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    // URLパラメータを更新
    updateUrlParams(newMonth.getFullYear(), newMonth.getMonth())
    // 親コンポーネントに月の変更を通知
    onMonthChange?.(newMonth.getFullYear(), newMonth.getMonth())
  }

  /**
   * 次月に移動するハンドラ
   * 表示月を1ヶ月後に変更し、URLを更新する
   */
  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    // URLパラメータを更新
    updateUrlParams(newMonth.getFullYear(), newMonth.getMonth())
    // 親コンポーネントに月の変更を通知
    onMonthChange?.(newMonth.getFullYear(), newMonth.getMonth())
  }

  /**
   * 今日の月に移動するハンドラ
   * 表示月を現在の月に戻し、URLを更新する
   */
  const handleToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    // URLパラメータを更新
    updateUrlParams(today.getFullYear(), today.getMonth())
    // 親コンポーネントに月の変更を通知
    onMonthChange?.(today.getFullYear(), today.getMonth())
  }

  return (
    <div className="bg-card rounded-lg border">
      {/* カレンダーヘッダー（月表示と移動ボタン） */}
      <div className="flex items-center justify-between p-4 border-b">
        {/* 前月移動ボタン */}
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="前月"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>

        {/* 年月表示と今日ボタン */}
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {format(currentMonth, 'yyyy年M月', { locale: ja })}
          </h2>
          <button
            onClick={handleToday}
            className="text-sm px-3 py-1 border rounded-lg hover:bg-muted transition-colors"
          >
            今日
          </button>
        </div>

        {/* 次月移動ボタン */}
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="次月"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* 曜日ヘッダー（日〜土） */}
      <div className="grid grid-cols-7 border-b">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
          <div
            key={day}
            className={`text-center text-sm font-medium py-2 ${
              // 日曜は赤、土曜は青で表示
              index === 0 ? 'text-muted-foreground' : index === 6 ? 'text-muted-foreground' : ''
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダー本体（日付グリッド） */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          // この日のイベント一覧を取得
          const dayEvents = getEventsForDay(day)
          // 現在の表示月に属する日かどうか
          const isCurrentMonth = isSameMonth(day, currentMonth)
          // 今日かどうか
          const isCurrentDay = isToday(day)
          // 曜日番号（0:日曜 〜 6:土曜）
          const dayOfWeek = day.getDay()

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[100px] p-1 border-b border-r ${
                // 当月以外の日付は背景を薄く表示
                !isCurrentMonth ? 'bg-muted/30' : ''
              } ${index % 7 === 0 ? 'border-l' : ''}`}
            >
              {/* 日付番号 */}
              <div
                className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                  // 今日はプライマリカラーで強調表示
                  isCurrentDay
                    ? 'bg-primary text-primary-foreground'
                    // 日曜は赤、土曜は青
                    : dayOfWeek === 0
                    ? 'text-muted-foreground'
                    : dayOfWeek === 6
                    ? 'text-muted-foreground'
                    : ''
                } ${!isCurrentMonth ? 'text-muted-foreground' : ''}`}
              >
                {format(day, 'd')}
              </div>
              {/* その日のイベント一覧（最大3件表示） */}
              <div className="space-y-1">
                {dayEvents.slice(0, CALENDAR_EVENTS_PER_DAY).map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block text-xs bg-primary/10 text-primary px-1 py-0.5 rounded truncate hover:bg-primary/20 transition-colors"
                  >
                    {event.title}
                  </Link>
                ))}
                {/* 4件以上ある場合は残り件数を表示 */}
                {dayEvents.length > CALENDAR_EVENTS_PER_DAY && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayEvents.length - CALENDAR_EVENTS_PER_DAY}件
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
