/**
 * ユーザーのセキュリティ活動（ログイン履歴等）を表示するセクション。
 * settings/security に組み込み、IP / 端末を本人が確認できるようにする。
 *
 * @module components/settings/SecurityActivity
 */

import { getMySecurityEvents } from '@/lib/actions/security-activity'

const EVENT_LABELS: Record<string, string> = {
  failed_login: 'ログイン失敗',
  login: 'ログイン',
  password_change: 'パスワード変更',
  '2fa_toggle': '2段階認証の変更',
  email_change: 'メールアドレス変更',
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export async function SecurityActivity() {
  const { events } = await getMySecurityEvents()

  return (
    <div className="bg-card rounded-lg border">
      <h2 className="px-4 py-3 font-bold border-b">最近のアカウント活動</h2>
      <div className="p-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">記録された活動はありません。</p>
        ) : (
          <ul className="divide-y" data-testid="security-activity-list">
            {events.map((event) => (
              <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {EVENT_LABELS[event.eventType] ?? event.eventType}
                  </span>
                  <time
                    dateTime={new Date(event.createdAt).toISOString()}
                    className="text-xs text-muted-foreground flex-shrink-0"
                  >
                    {formatDateTime(event.createdAt)}
                  </time>
                </div>
                {(event.ipAddress || event.userAgent) && (
                  <p className="text-xs text-muted-foreground mt-1 break-all">
                    {event.ipAddress && <span>IP: {event.ipAddress}</span>}
                    {event.ipAddress && event.userAgent && <span> · </span>}
                    {event.userAgent && <span className="line-clamp-1 inline">{event.userAgent}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
