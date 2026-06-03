import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getAnnouncements } from '@/lib/actions/admin/announcements'
import { AnnouncementList } from './AnnouncementList'
import { ADMIN_ANNOUNCEMENTS_PAGE_LIMIT } from '@/lib/constants/limits'
import { Megaphone } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'お知らせ管理 - BON-LOG 管理',
}

export default async function AnnouncementsPage() {
  const result = await getAnnouncements({ limit: ADMIN_ANNOUNCEMENTS_PAGE_LIMIT })

  if ('error' in result) {
    redirect(ROUTE_LOGIN)
  }

  const { announcements, total } = result
  const activeCount = announcements.filter(a => a.isActive).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="w-6 h-6" />
        <h1 className="text-2xl font-bold">お知らせ管理</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">有効なお知らせ</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">全お知らせ</p>
          <p className="text-2xl font-bold">{total}</p>
        </div>
      </div>

      <AnnouncementList announcements={JSON.parse(JSON.stringify(announcements))} />
    </div>
  )
}
