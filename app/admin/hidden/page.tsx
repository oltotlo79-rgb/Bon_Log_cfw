import { getHiddenContent, getAdminNotifications } from '@/lib/actions/admin/hidden'
import { HiddenContentList } from './HiddenContentList'
import { AdminNotificationBanner } from './AdminNotificationBanner'

export const metadata = {
  title: '非表示コンテンツ管理 - BON-LOG 管理',
}

export default async function HiddenContentPage() {
  const [contentResult, notificationResult] = await Promise.all([
    getHiddenContent(),
    getAdminNotifications({ unreadOnly: true }),
  ])

  if ('error' in contentResult) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
        {contentResult.error}
      </div>
    )
  }

  const items = 'items' in contentResult ? contentResult.items : []
  const unreadNotifications = 'notifications' in notificationResult ? notificationResult.notifications : []
  const unreadCount = 'unreadCount' in notificationResult ? notificationResult.unreadCount : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">非表示コンテンツ管理</h1>
        <p className="text-muted-foreground">
          通報により自動非表示になったコンテンツを確認・管理できます
        </p>
      </div>

      {unreadCount > 0 && (
        <AdminNotificationBanner
          notifications={unreadNotifications}
          unreadCount={unreadCount}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(['post', 'comment', 'event', 'shop', 'review'] as const).map((type) => {
          const count = items.filter((item: typeof items[number]) => item.type === type).length
          const label = {
            post: '投稿',
            comment: 'コメント',
            event: 'イベント',
            shop: '盆栽園',
            review: 'レビュー',
          }[type]
          return (
            <div key={type} className="bg-card p-4 rounded-lg border">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          )
        })}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          非表示コンテンツはありません
        </div>
      ) : (
        <HiddenContentList items={items} />
      )}
    </div>
  )
}
