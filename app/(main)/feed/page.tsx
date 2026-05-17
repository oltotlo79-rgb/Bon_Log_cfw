/** このファイルはBON-LOGのメインコンテンツであるタイムラインページを定義します。 */

import type { Metadata } from 'next'
import { Suspense } from 'react'

// NextAuth.jsの認証ヘルパー関数
import { auth } from '@/lib/auth'

import { BASE_URL, ROUTE_FEED } from '@/lib/constants/routes'

// タイムラインコンポーネント
import { Timeline } from '@/components/feed/Timeline'

// タイムラインスケルトン（Suspenseフォールバック用）
import { TimelineSkeleton } from '@/components/feed/TimelineSkeleton'

// 投稿作成ボタン（即座に表示）
import { ComposeButton } from '@/components/feed/ComposeButton'

// Server Actions
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { getGenres } from '@/lib/actions/post'
import { getTimeline } from '@/lib/actions/feed'
import { getDraftCount } from '@/lib/actions/draft'
import { getBonsais } from '@/lib/actions/bonsai'

// 会員プラン別の制限値取得関数 / 未認証フォールバック用の無料プラン制限値
import { getMembershipLimits, FREE_LIMITS } from '@/lib/premium'

// 季節バナー
import { SeasonalBanner } from '@/components/common/SeasonalBanner'

// 天気アドバイスカード
import { WeatherAdviceCard } from '@/components/weather/WeatherAdviceCard'

/**
 * ページメタデータ
 *
 * Why noindex: タイムラインは認証ユーザー固有のフィードで公開コンテンツではなく、
 * 検索エンジンに index させても何も意味のあるスニペットが取れない。
 * 認証で保護されているとはいえ、明示的に noindex/nofollow を出して
 * 検索結果汚染とクロール予算の浪費を防ぐ。
 *
 * `title` は文字列のみ渡しレイアウト側 template (`%s - BON-LOG`) で接尾辞が付与される。
 */
export const metadata: Metadata = {
  title: 'タイムライン',
  description: 'フォロー中のユーザーの最新投稿を時系列で確認できるタイムライン。',
  alternates: { canonical: `${BASE_URL}${ROUTE_FEED}` },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'タイムライン',
    description: 'フォロー中のユーザーの最新投稿を時系列で確認できるタイムライン。',
    url: `${BASE_URL}${ROUTE_FEED}`,
  },
}

/**
 * タイムラインセクション（Suspense内で使用）
 *
 * タイムラインデータを取得して表示するServer Component。
 * Suspense境界内で使用され、データ取得が完了するまで
 * フォールバックUI（スケルトン）が表示されます。
 */
async function TimelineSection({
  currentUserId,
  isGuest,
}: {
  currentUserId?: string
  isGuest?: boolean
}) {
  const timelineResult = await getTimeline()
  const posts = timelineResult.success ? timelineResult.data?.posts ?? [] : []
  const nextCursor = timelineResult.success ? timelineResult.data?.nextCursor : undefined

  return (
    <Timeline
      initialPosts={posts}
      currentUserId={currentUserId}
      isGuest={isGuest}
      nextCursor={nextCursor}
    />
  )
}

/**
 * タイムラインページコンポーネント
 *
 * メインタイムラインを表示するServer Componentです。
 * Suspenseを使用して、投稿ボタンを即座に表示しながら
 * タイムラインをストリーミングで読み込みます。
 *
 * ## データ取得の分離
 * - 即時取得: ジャンル、制限値、下書き数、盆栽一覧（投稿ボタン用）
 * - ストリーミング: タイムライン投稿（Suspense内）
 *
 * @returns タイムラインページのJSX要素
 */
export default async function FeedPage() {
  // 現在のセッション情報を取得
  const session = await auth()
  const isGuest =
    !!session?.user?.email && session.user.email === GUEST_EMAIL

  // 投稿ボタンに必要なデータを並列取得（比較的高速）
  // - ジャンルは1時間キャッシュされているため高速
  // - 制限値、下書き数、盆栽一覧は軽量クエリ
  const [genresResult, limits, draftCount, bonsaisResult] = await Promise.all([
    getGenres(),
    session?.user?.id
      ? getMembershipLimits(session.user.id)
      : Promise.resolve(FREE_LIMITS),
    getDraftCount(),
    session?.user?.id ? getBonsais() : Promise.resolve({ success: true as const, data: { bonsais: [] } }),
  ])

  const genres = genresResult.genres || {}
  const bonsais = bonsaisResult.success ? (bonsaisResult.data?.bonsais ?? []) : []

  return (
    <div className="relative min-h-screen">
      {/* タイムラインセクション */}
      <div>
        {/* 季節バナー（モバイルのみ表示、デスクトップは右サイドバーに表示） */}
        <div className="xl:hidden mb-4 -mt-4 lg:-mt-0">
          <SeasonalBanner />
        </div>

        <h1 className="sr-only" data-testid="feed-timeline-heading">タイムライン</h1>

        {/* 天気アドバイスカード（ログインユーザーのみ） */}
        {!isGuest && <WeatherAdviceCard />}

        {/* Suspense境界: タイムラインをストリーミングで読み込み */}
        <Suspense fallback={<TimelineSkeleton />}>
          <TimelineSection currentUserId={session?.user?.id} isGuest={isGuest} />
        </Suspense>
      </div>

      {/* 投稿作成ボタン（ゲストは表示しない） */}
      {!isGuest && (
        <ComposeButton
          genres={genres}
          limits={limits}
          draftCount={draftCount}
          bonsais={bonsais}
        />
      )}
    </div>
  )
}
