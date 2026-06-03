import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { getEvents } from '@/lib/actions/event'
import { EventCalendarWrapper } from '@/components/event/EventCalendarWrapper'
import { EventList } from '@/components/event/EventList'
import { RegionFilter } from '@/components/event/RegionFilter'
import { ShowPastToggle } from '@/components/event/ShowPastToggle'
import { EventFilterPersistence } from '@/components/event/EventFilterPersistence'
import { Plus as PlusIcon, Calendar as CalendarIcon, List as ListIcon } from 'lucide-react'
import { ROUTE_EVENTS, ROUTE_EVENTS_NEW } from '@/lib/constants/routes'
import { pageCanonical, pageTitle } from '@/lib/utils/seo'

export const revalidate = 300 // REVALIDATE_LIST_PAGE 相当（Next.js は revalidate に静的リテラルを要求）

export const metadata = {
  title: pageTitle('イベント'),
  description: '全国の盆栽展・愛好会・体験教室などのイベント情報。カレンダーと地域フィルターで開催予定を確認できます。',
  alternates: { canonical: pageCanonical(ROUTE_EVENTS) },
}

interface EventsPageProps {
  searchParams: Promise<{
    region?: string
    prefecture?: string
    view?: string
    showPast?: string
    year?: string
    month?: string
  }>
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const params = await searchParams
  const view = params.view || 'calendar'
  const showPast = params.showPast === 'true'

  return (
    <>
      <div className="space-y-6">
        <div className="relative w-full h-24 md:h-32 rounded-lg overflow-hidden mb-4">
          <Image src="/images/generated/ui/event-header-mobile.webp" alt="" fill sizes="100vw" className="object-cover opacity-80 md:hidden dark:hidden" />
          <Image src="/images/generated/ui/event-header.webp" alt="" fill sizes="100vw" className="object-cover opacity-80 hidden md:block dark:hidden" />
          <Image src="/images/generated/ui/event-header-dark.webp" alt="" fill sizes="100vw" className="object-cover opacity-80 hidden dark:block" />
        </div>
        <Suspense fallback={null}>
          <EventFilterPersistence />
        </Suspense>

        <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">イベント</h1>
        <Link
          href={ROUTE_EVENTS_NEW}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <PlusIcon className="w-4 h-4" />
          <span>イベントを登録</span>
        </Link>
      </div>

      <Suspense fallback={<div className="h-40 bg-muted animate-pulse rounded-lg" />}>
        <RegionFilter
          currentRegion={params.region}
          currentPrefecture={params.prefecture}
        />
      </Suspense>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`${ROUTE_EVENTS}?${new URLSearchParams({ ...params, view: 'calendar' }).toString()}`}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              view === 'calendar'
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted'
            }`}
          >
            <CalendarIcon className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">カレンダー</span>
          </Link>
          <Link
            href={`${ROUTE_EVENTS}?${new URLSearchParams({ ...params, view: 'list' }).toString()}`}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              view === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted'
            }`}
          >
            <ListIcon className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">リスト</span>
          </Link>
        </div>

        <ShowPastToggle showPast={showPast} />
      </div>

      <Suspense fallback={<EventContentSkeleton />}>
        <EventContentSection
          region={params.region}
          prefecture={params.prefecture}
          showPast={showPast}
          view={view}
          year={params.year}
          month={params.month}
        />
      </Suspense>
      </div>
    </>
  )
}

function EventContentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  )
}

async function EventContentSection({
  region,
  prefecture,
  showPast,
  view,
  year,
  month,
}: {
  region?: string
  prefecture?: string
  showPast: boolean
  view: string
  year?: string
  month?: string
}) {
  const { events } = await getEvents({ region, prefecture, showPast })

  const now = new Date()
  const upcomingEvents = events
    .filter((event) => {
      const endDate = event.endDate ? new Date(event.endDate) : null
      const startDate = new Date(event.startDate)
      return endDate ? endDate >= now : startDate >= now
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

  if (view === 'calendar') {
    return (
      <>
        <EventCalendarWrapper
          events={events}
          initialYear={year ? parseInt(year, 10) : undefined}
          initialMonth={month ? parseInt(month, 10) : undefined}
        />
        <div>
          <h2 className="text-lg font-semibold mb-4">
            今後のイベント
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({upcomingEvents.length}件)
            </span>
          </h2>
          <EventList
            events={upcomingEvents}
            emptyMessage="今後のイベントはありません"
          />
        </div>
      </>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">
        イベント一覧
        <span className="text-sm font-normal text-muted-foreground ml-2">
          ({events.length}件)
        </span>
      </h2>
      <EventList
        events={events}
        emptyMessage="該当するイベントがありません"
      />
    </div>
  )
}
