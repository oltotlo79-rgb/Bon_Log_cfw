import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

import { BASE_URL, ROUTE_FEED, ROUTE_ONBOARDING } from '@/lib/constants/routes'
import { Timeline } from '@/components/feed/Timeline'
import { TimelineSkeleton } from '@/components/feed/TimelineSkeleton'
import { ComposeButton } from '@/components/feed/ComposeButton'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { getGenres } from '@/lib/actions/post'
import { getTimeline } from '@/lib/actions/feed'
import { getDraftCount } from '@/lib/actions/draft'
import { getBonsais } from '@/lib/actions/bonsai'
import { getMembershipLimits, FREE_LIMITS } from '@/lib/premium'
import { SeasonalBanner } from '@/components/common/SeasonalBanner'
import { WeatherAdviceCard } from '@/components/weather/WeatherAdviceCard'

/**
 * ページメタデータ
 *
 * Why noindex: タイムラインは認証ユーザー固有のフィードで公開コンテンツではなく、
 * 検索エンジンに index させても何も意味のあるスニペットが取れない。
 * 認証で保護されているとはいえ、明示的に noindex/nofollow を出して
 * 検索結果汚染とクロール予算の浪費を防ぐ。
 *
 * `title` は文字列のみ渡しレイアウト側 template (`%s`) で接尾辞が付与される。
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

export default async function FeedPage() {
  const session = await auth()
  const isGuest =
    !!session?.user?.email && session.user.email === GUEST_EMAIL

  // 初回ログインのユーザー（onboardedAt 未設定・非ゲスト）は一度だけオンボーディングへ誘導する
  if (session?.user?.id && !isGuest) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardedAt: true },
    })
    if (user && user.onboardedAt === null) {
      redirect(ROUTE_ONBOARDING)
    }
  }

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
      <div>
        <div className="xl:hidden mb-4 -mt-4 lg:-mt-0">
          <SeasonalBanner />
        </div>

        <h1 className="sr-only" data-testid="feed-timeline-heading">タイムライン</h1>

        {!isGuest && <WeatherAdviceCard />}

        <Suspense fallback={<TimelineSkeleton />}>
          <TimelineSection currentUserId={session?.user?.id} isGuest={isGuest} />
        </Suspense>
      </div>

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
