/**
 * セキュリティ設定ページ
 *
 * 2段階認証（2FA）の設定を行うページです。
 *
 * @route /settings/security
 */

import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'

export const metadata: Metadata = {
  title: 'セキュリティ設定 - BON-LOG',
  description: '2段階認証などのセキュリティ設定を管理します',
  // 認証必須の個別設定のため検索エンジンには公開しない
  robots: { index: false, follow: false },
}

export default async function SecuritySettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="セキュリティ設定" />
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-card rounded-lg border">
        <h1 className="px-4 py-3 font-bold text-lg border-b">セキュリティ設定</h1>
        <div className="p-4">
          <TwoFactorSettings />
        </div>
      </div>
    </div>
  )
}
