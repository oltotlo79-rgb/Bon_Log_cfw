/**
 * @file イベント詳細ページ
 * @description 個別のイベントの詳細情報を表示するページ。
 * イベントの基本情報、開催日時、場所、入場料、主催者情報などを表示する。
 * SEO対策として構造化データ（JSON-LD）も出力する。
 */

// Next.jsのnotFound関数: 404ページを表示
import { notFound } from 'next/navigation'
// Next.jsのMetadata型: 動的メタデータ生成用
import { Metadata } from 'next'
// Next.jsのLinkコンポーネント: クライアントサイドナビゲーション
import Link from 'next/link'
// Next.jsのImageコンポーネント: 最適化された画像表示
import Image from 'next/image'
// date-fnsの日付フォーマット関数
import { format } from 'date-fns'
// date-fnsの日本語ロケール
import { ja } from 'date-fns/locale'
// イベントデータ取得用のServer Action
import { getEvent } from '@/lib/actions/event'
// イベント削除ボタンコンポーネント
import { DeleteEventButton } from './DeleteEventButton'
// SEO用のJSON-LD構造化データコンポーネント
import { EventJsonLd } from '@/components/seo/JsonLd'
// パンくずリストUIコンポーネント
import { Breadcrumb } from '@/components/common/Breadcrumb'
// 制限値定数
import { EVENT_DESCRIPTION_PREVIEW_LENGTH } from '@/lib/constants/limits'
// ルート定数
import { BASE_URL } from '@/lib/constants/routes'

/**
 * ページコンポーネントのProps型定義
 * 動的ルートパラメータ（イベントID）を受け取る
 */
interface EventDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * 左矢印アイコンコンポーネント
 * 「戻る」ボタンに使用するSVGアイコン
 */
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

/**
 * カレンダーアイコンコンポーネント
 * 日時表示に使用するSVGアイコン
 */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}

/**
 * 地図ピンアイコンコンポーネント
 * 場所表示に使用するSVGアイコン
 */
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

/**
 * ユーザーアイコンコンポーネント
 * 主催者表示に使用するSVGアイコン
 */
function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

/**
 * チケットアイコンコンポーネント
 * 入場料表示に使用するSVGアイコン
 */
function TicketIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
      <path d="M13 5v2"/>
      <path d="M13 17v2"/>
      <path d="M13 11v2"/>
    </svg>
  )
}

/**
 * 外部リンクアイコンコンポーネント
 * 外部URLリンク表示に使用するSVGアイコン
 */
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" x2="21" y1="14" y2="3"/>
    </svg>
  )
}

/**
 * 編集アイコンコンポーネント
 * 編集ボタンに使用するSVGアイコン
 */
function EditIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

/**
 * 動的メタデータ生成関数
 * イベント情報に基づいてSEO用のメタデータを生成する
 *
 * @param params - 動的ルートパラメータ（イベントID）
 * @returns メタデータオブジェクト（タイトル、説明、OGP情報）
 */
export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const result = await getEvent(id)

  // イベントが見つからない場合のフォールバック
  if (!result.success || !result.data) {
    return { title: 'イベントが見つかりません' }
  }

  const event = result.data.event
  const title = event.title
  // 開催日を日本語フォーマットに変換
  const startDateStr = format(new Date(event.startDate), 'yyyy年M月d日', { locale: ja })
  // 開催場所を文字列化
  const locationStr = [event.prefecture, event.city, event.venue].filter(Boolean).join(' ')
  // 説明文を動的に生成
  const description = `${startDateStr}開催${locationStr ? `（${locationStr}）` : ''}${event.description ? ` - ${event.description.slice(0, EVENT_DESCRIPTION_PREVIEW_LENGTH)}` : ''}`

  return {
    title,
    description,
    // Open Graph（SNSシェア用）メタデータ
    openGraph: {
      type: 'website',
      title: `${title} - 盆栽イベント`,
      description,
      url: `${BASE_URL}/events/${id}`,
      images: [
        {
          url: '/api/og',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    // Twitterカード用メタデータ
    twitter: {
      card: 'summary_large_image',
      title: `${title} - 盆栽イベント`,
      description,
      images: ['/api/og'],
    },
    // 正規URLを指定（重複コンテンツ対策）
    alternates: {
      canonical: `${BASE_URL}/events/${id}`,
    },
  }
}

/**
 * イベント詳細ページコンポーネント
 *
 * このServer Componentは以下の情報を表示する:
 * 1. イベントのタイトルとステータス（終了/開催中/即売あり）
 * 2. 開催日時（開始・終了）
 * 3. 開催場所（都道府県、市区町村、会場名）
 * 4. 主催者、入場料、外部リンク
 * 5. イベントの詳細説明
 * 6. 登録者情報
 * 7. SEO用のJSON-LD構造化データ
 *
 * @param params - 動的ルートパラメータ（イベントID）
 */
export default async function EventDetailPage({ params }: EventDetailPageProps) {
  // 動的パラメータからイベントIDを取得
  const { id } = await params
  // イベントの詳細データを取得
  const result = await getEvent(id)

  // イベントが見つからない場合は404ページを表示
  if (!result.success || !result.data) {
    notFound()
  }

  const event = result.data.event
  const now = new Date()
  const startDate = new Date(event.startDate)
  const endDate = event.endDate ? new Date(event.endDate) : null

  // イベントステータスの判定
  // 終了: endDateがあればendDate経過後、なければstartDate経過後
  const isEnded = endDate ? endDate < now : startDate < now
  // 開催中: startDate経過後かつendDate前（endDateがない場合は開催中にならない）
  const isOngoing = !isEnded && startDate <= now && endDate && endDate >= now

  /**
   * 日時フォーマット関数
   * 日本語形式で曜日と時刻を含む形式にフォーマット
   */
  const formatEventDateTime = (date: Date) => {
    return format(new Date(date), 'yyyy年M月d日(E) HH:mm', { locale: ja })
  }

  // 開催場所を文字列化（JSON-LD用）
  const locationStr = [event.prefecture, event.city, event.venue].filter(Boolean).join(' ')

  return (
    <>
      {/* パンくずリスト（UI + JSON-LD） */}
      <Breadcrumb
        items={[
          { name: 'ホーム', href: '/feed' },
          { name: 'イベント', href: '/events' },
          { name: event.title },
        ]}
      />
      {/* SEO用のJSON-LD構造化データ（Event） */}
      <EventJsonLd
        name={event.title}
        startDate={new Date(event.startDate).toISOString()}
        endDate={event.endDate ? new Date(event.endDate).toISOString() : undefined}
        location={locationStr ? { name: event.venue || undefined, address: locationStr } : undefined}
        description={event.description || undefined}
        url={`${BASE_URL}/events/${event.id}`}
        organizer={event.organizer || undefined}
        offers={event.admissionFee ? { price: event.admissionFee } : undefined}
      />
    <div className="space-y-6">
      {/* 戻るボタン: イベント一覧ページへのナビゲーション */}
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>イベント一覧に戻る</span>
      </Link>

      {/* メインコンテンツカード */}
      <div className="bg-card rounded-lg border">
        <div className="p-6">
          {/* ヘッダー: タイトル、ステータスバッジ、アクションボタン */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              {/* ステータスバッジ */}
              <div className="flex items-center gap-2 mb-2">
                {/* 終了バッジ */}
                {isEnded && (
                  <span className="text-xs px-2 py-0.5 bg-muted-foreground/20 text-muted-foreground rounded-full">
                    終了
                  </span>
                )}
                {/* 開催中バッジ */}
                {isOngoing && (
                  <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 rounded-full">
                    開催中
                  </span>
                )}
                {/* 即売ありバッジ */}
                {event.hasSales && (
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                    即売あり
                  </span>
                )}
              </div>
              {/* イベントタイトル */}
              <h1 className="text-2xl font-bold">{event.title}</h1>
            </div>

            {/* 所有者用アクションボタン（編集・削除） */}
            {event.isOwner && (
              <div className="flex items-center gap-2">
                <Link
                  href={`/events/${event.id}/edit`}
                  className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted"
                >
                  <EditIcon className="w-4 h-4" />
                  <span>編集</span>
                </Link>
                <DeleteEventButton eventId={event.id} />
              </div>
            )}
          </div>

          {/* 詳細情報リスト */}
          <div className="space-y-4">
            {/* 開催日時 */}
            <div className="flex items-start gap-3">
              <CalendarIcon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p>{formatEventDateTime(event.startDate)}</p>
                {/* 終了日がある場合は表示 */}
                {event.endDate && (
                  <p className="text-muted-foreground">
                    〜 {formatEventDateTime(event.endDate)}
                  </p>
                )}
              </div>
            </div>

            {/* 開催場所 */}
            <div className="flex items-start gap-3">
              <MapPinIcon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p>
                  {event.prefecture}
                  {event.city && ` ${event.city}`}
                </p>
                {/* 会場名がある場合は表示 */}
                {event.venue && (
                  <p className="text-muted-foreground">{event.venue}</p>
                )}
              </div>
            </div>

            {/* 主催者（存在する場合のみ表示） */}
            {event.organizer && (
              <div className="flex items-center gap-3">
                <UserIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span>主催: {event.organizer}</span>
              </div>
            )}

            {/* 入場料（存在する場合のみ表示） */}
            {event.admissionFee && (
              <div className="flex items-center gap-3">
                <TicketIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span>入場料: {event.admissionFee}</span>
              </div>
            )}

            {/* 外部リンク（存在する場合のみ表示） */}
            {event.externalUrl && (
              <div className="flex items-center gap-3">
                <ExternalLinkIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <a
                  href={event.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {event.externalUrl}
                </a>
              </div>
            )}
          </div>

          {/* 詳細説明（存在する場合のみ表示） */}
          {event.description && (
            <div className="mt-6 pt-6 border-t">
              <h2 className="font-semibold mb-3">詳細</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {event.description}
              </p>
            </div>
          )}

          {/* 登録者情報 */}
          {event.creator && (
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              登録者:
              <Link
                href={`/users/${event.creator.id}`}
                className="ml-2 inline-flex items-center gap-2 hover:text-foreground"
              >
                {/* アバター画像または代替表示 */}
                {event.creator.avatarUrl ? (
                  <Image
                    src={event.creator.avatarUrl}
                    alt={event.creator.nickname}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <span className="inline-block w-5 h-5 bg-muted rounded-full" />
                )}
                <span>{event.creator.nickname}</span>
              </Link>
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
