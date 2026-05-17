/**
 * @file EventCard.tsx
 * @description イベントカードコンポーネント
 *
 * 目的:
 * - イベント情報を視覚的に魅力的なカード形式で表示する
 * - イベントの基本情報（タイトル、日程、場所）を一覧で確認できるようにする
 * - イベントのステータス（開催中、終了）を視覚的に表示する
 *
 * 機能概要:
 * - イベント情報のカード形式表示
 * - 日程のフォーマット処理（単日/複数日対応）
 * - ステータスバッジの表示（開催中、終了、即売あり等）
 * - イベント詳細ページへのリンク
 *
 * 使用例:
 * ```tsx
 * <EventCard
 *   event={{
 *     id: 'event-1',
 *     title: '第30回 全国盆栽展',
 *     startDate: new Date('2024-05-01'),
 *     endDate: new Date('2024-05-05'),
 *     prefecture: '埼玉県',
 *     city: 'さいたま市',
 *     venue: '大宮盆栽美術館',
 *     admissionFee: '500円',
 *     hasSales: true
 *   }}
 * />
 * ```
 */

// Next.jsのLinkコンポーネント - クライアントサイドナビゲーションを実現
import Link from 'next/link'

// date-fnsの日付フォーマット関数 - 日付を指定形式の文字列に変換
import { format } from 'date-fns'

// date-fnsの日本語ロケール - 曜日等を日本語で表示するために使用
import { ja } from 'date-fns/locale'

/**
 * EventCardコンポーネントのプロパティ型定義
 */
interface EventCardProps {
  /** 表示するイベントの情報 */
  event: {
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
}

/**
 * カレンダーアイコンコンポーネント
 * SVGで描画されたカレンダーアイコンを表示する
 *
 * @param className - アイコンに適用するCSSクラス
 * @returns カレンダーアイコンのSVG要素
 */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* カレンダーの外枠 */}
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      {/* 右側の綴じ穴 */}
      <line x1="16" x2="16" y1="2" y2="6"/>
      {/* 左側の綴じ穴 */}
      <line x1="8" x2="8" y1="2" y2="6"/>
      {/* ヘッダーとボディの区切り線 */}
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}

/**
 * 地図ピンアイコンコンポーネント
 * SVGで描画された位置マーカーアイコンを表示する
 *
 * @param className - アイコンに適用するCSSクラス
 * @returns 地図ピンアイコンのSVG要素
 */
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* ピンの外形 */}
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      {/* ピンの中心円 */}
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

/**
 * イベント日程をフォーマットする関数
 * 開始日と終了日から、表示用の日程文字列を生成する
 *
 * @param startDate - イベント開始日
 * @param endDate - イベント終了日（単日の場合はnull）
 * @returns フォーマットされた日程文字列
 *
 * @example
 * // 単日イベント
 * formatEventDate(new Date('2024-05-01'), null)
 * // => "5月1日(水)"
 *
 * @example
 * // 複数日イベント
 * formatEventDate(new Date('2024-05-01'), new Date('2024-05-05'))
 * // => "5月1日(水) 〜 5月5日(日)"
 */
function formatEventDate(startDate: Date, endDate: Date | null): string {
  // Dateオブジェクトに変換（文字列で渡された場合の対応）
  const start = new Date(startDate)
  // 日本語形式でフォーマット（例: "5月1日(水)"）
  const startStr = format(start, 'M月d日(E)', { locale: ja })

  // 終了日がない場合は開始日のみを返す
  if (!endDate) {
    return startStr
  }

  const end = new Date(endDate)
  // 開始日と終了日が同じ場合は開始日のみを返す
  if (start.toDateString() === end.toDateString()) {
    return startStr
  }

  // 複数日の場合は範囲表示
  const endStr = format(end, 'M月d日(E)', { locale: ja })
  return `${startStr} 〜 ${endStr}`
}

/**
 * イベントカードコンポーネント
 * イベント情報をカード形式で表示し、クリックで詳細ページに遷移する
 *
 * @param props - コンポーネントのプロパティ
 * @returns イベントカードのReact要素
 */
export function EventCard({ event }: EventCardProps) {
  // 現在日時を取得（ステータス判定に使用）
  const now = new Date()
  // イベント開始日をDateオブジェクトに変換
  const startDate = new Date(event.startDate)
  // イベント終了日をDateオブジェクトに変換（nullの場合はnullのまま）
  const endDate = event.endDate ? new Date(event.endDate) : null

  // ------------------------------------------------------------
  // イベントステータスの判定
  // ------------------------------------------------------------
  // 終了判定: 終了日があれば終了日経過後、なければ開始日経過後
  const isEnded = endDate ? endDate < now : startDate < now
  // 開催中判定: 開始日経過後かつ終了日前（終了日がない単日イベントは開催中にならない）
  const isOngoing = !isEnded && startDate <= now && endDate && endDate >= now

  return (
    <Link
      href={`/events/${event.id}`}
      className={`block bg-card border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
        isEnded ? 'opacity-60' : ''
      }`}
    >
      {/* イベントタイトル（2行で省略） */}
      <h3 className="font-semibold mb-2 line-clamp-2">{event.title}</h3>

      {/* イベント情報（日程・場所） */}
      <div className="space-y-1.5 text-sm text-muted-foreground">
        {/* 日程表示 */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 flex-shrink-0" />
          <span>{formatEventDate(event.startDate, event.endDate)}</span>
        </div>

        {/* 場所表示（都道府県・市区町村・会場のいずれかがある場合のみ表示） */}
        {(event.prefecture || event.city || event.venue) && (
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            <span>
              {event.prefecture}
              {event.city && ` ${event.city}`}
              {event.venue && ` / ${event.venue}`}
            </span>
          </div>
        )}
      </div>

      {/* ステータスバッジエリア */}
      <div className="flex items-center gap-2 mt-3">
        {/* 入場料バッジ */}
        {event.admissionFee && (
          <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
            {event.admissionFee}
          </span>
        )}
        {/* 即売ありバッジ */}
        {event.hasSales && (
          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
            即売あり
          </span>
        )}
        {/* 終了バッジ */}
        {isEnded && (
          <span className="text-xs px-2 py-0.5 bg-muted-foreground/20 text-muted-foreground rounded-full">
            終了
          </span>
        )}
        {/* 開催中バッジ */}
        {isOngoing && (
          <span className="text-xs px-2 py-0.5 bg-muted/50 text-muted-foreground rounded-full">
            開催中
          </span>
        )}
      </div>
    </Link>
  )
}
