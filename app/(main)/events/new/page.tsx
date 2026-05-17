import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { ROUTE_EVENTS, ROUTE_LOGIN } from '@/lib/constants/routes'
import { EventForm } from '@/components/event/EventForm'

export const metadata = {
  title: 'イベントを登録 - BON-LOG',
}

export default async function NewEventPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={ROUTE_EVENTS}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        <span>イベント一覧に戻る</span>
      </Link>

      <div className="bg-card rounded-lg border p-6">
        <h1 className="text-2xl font-bold mb-6">イベントを登録</h1>
        <EventForm mode="create" />
      </div>
    </div>
  )
}
