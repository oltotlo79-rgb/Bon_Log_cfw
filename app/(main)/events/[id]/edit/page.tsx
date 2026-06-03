import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { buildEventPath } from '@/lib/constants/path-builders'
import { getEvent } from '@/lib/actions/event'
import { EventForm } from '@/components/event/EventForm'

interface EditEventPageProps {
  params: Promise<{ id: string }>
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

export async function generateMetadata({ params }: EditEventPageProps) {
  const { id } = await params
  const result = await getEvent(id)

  // 編集ページは所有者専用のため検索エンジンには公開しない
  const robots = { index: false, follow: false } as const

  if (!result.success || !result.data) {
    return { title: 'イベントが見つかりません', robots }
  }

  return {
    title: `${result.data.event.title}を編集`,
    robots,
  }
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  const result = await getEvent(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const event = result.data.event

  if (!event.isOwner) {
    redirect(buildEventPath(id))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={buildEventPath(id)}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>詳細に戻る</span>
      </Link>

      <div className="bg-card rounded-lg border p-6">
        <h1 className="text-2xl font-bold mb-6">イベントを編集</h1>
        <EventForm
          mode="edit"
          initialData={{
            id: event.id,
            title: event.title,
            startDate: event.startDate,
            endDate: event.endDate,
            prefecture: event.prefecture,
            city: event.city,
            venue: event.venue,
            organizer: event.organizer,
            fee: event.admissionFee,
            hasSales: event.hasSales,
            description: event.description,
            externalUrl: event.externalUrl,
          }}
        />
      </div>
    </div>
  )
}
