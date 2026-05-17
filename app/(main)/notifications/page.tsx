/**
 * @module app/(main)/notifications/page
 * 通知一覧ページ。ページ全体のローディングは `loading.tsx` が担う。
 */

import { getNotifications } from '@/lib/actions/notification'
import { NotificationList } from '@/components/notification/NotificationList'
import { PostDetailAdUnit } from '@/components/ads'

export const metadata = {
  title: '通知 - BON-LOG',
}

export default async function NotificationsPage() {
  const { notifications } = await getNotifications()

  return (
    <>
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">通知</h1>
        </div>

        <NotificationList initialNotifications={notifications || []} />
      </div>

      <aside aria-label="広告" className="mt-6">
        <PostDetailAdUnit />
      </aside>
    </>
  )
}
