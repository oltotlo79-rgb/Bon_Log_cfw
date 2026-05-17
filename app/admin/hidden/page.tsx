/**
 * @file 管理者用非表示コンテンツ管理ページ
 * @description 通報により自動非表示になったコンテンツ一覧を表示し、
 *              再表示または完全削除の管理を行う管理者ページ。
 */

// 非表示コンテンツ一覧・管理者通知取得のServer Action
import { getHiddenContent, getAdminNotifications } from '@/lib/actions/admin/hidden'
// 非表示コンテンツ一覧コンポーネント
import { HiddenContentList } from './HiddenContentList'
// 管理者通知バナーコンポーネント
import { AdminNotificationBanner } from './AdminNotificationBanner'

/**
 * ページメタデータの定義
 * ブラウザのタイトルバーに表示される
 */
export const metadata = {
  title: '非表示コンテンツ管理 - BON-LOG 管理',
}

/**
 * 管理者用非表示コンテンツ管理ページコンポーネント
 * 自動非表示になったコンテンツの一覧と管理機能を提供する
 *
 * @returns 非表示コンテンツ管理ページのJSX要素
 *
 * 処理内容:
 * 1. 非表示コンテンツ一覧と未読通知を並列で取得
 * 2. 未読通知がある場合はバナーを表示
 * 3. タイプ別の統計カードを表示
 * 4. コンテンツ一覧（フィルタリング・再表示・削除機能付き）を表示
 */
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

      {/* 未読通知バナー */}
      {unreadCount > 0 && (
        <AdminNotificationBanner
          notifications={unreadNotifications}
          unreadCount={unreadCount}
        />
      )}

      {/* 統計 */}
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

      {/* コンテンツ一覧 */}
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
