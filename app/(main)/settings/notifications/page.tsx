import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { getNotificationPreferences } from '@/lib/actions/notification-preferences'
import { NotificationPreferences } from '@/components/settings/NotificationPreferences'
import { PushNotificationToggle } from '@/components/notification/PushNotificationToggle'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'

export const metadata: Metadata = {
  title: '通知設定 - BON-LOG',
  // 認証必須の個別設定のため検索エンジンには公開しない
  robots: { index: false, follow: false },
}

export default async function NotificationSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="通知設定" />
  }

  const { preferences } = await getNotificationPreferences()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="font-bold text-lg">通知設定</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            受け取る通知の種類を選択できます。OFFにした種類の通知は届きません。
          </p>
        </div>
        <div className="p-4">
          <NotificationPreferences initialPreferences={preferences} />
        </div>
      </div>

      {/* プッシュ通知設定 */}
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h2 className="font-bold text-base">端末通知</h2>
          <p className="text-sm text-muted-foreground mt-1">
            ONにすると、アプリを開いていなくても端末に通知が届きます。
          </p>
        </div>
        <div className="px-4">
          <PushNotificationToggle />
        </div>
      </div>
    </div>
  )
}
