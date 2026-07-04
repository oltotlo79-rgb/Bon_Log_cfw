/**
 * @module app/(main)/settings/account/page
 * アカウント設定ページ（公開/非公開の切り替え・アカウント削除）。
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PrivacyToggle } from '@/components/user/PrivacyToggle'
import { DeleteAccountButton } from '@/components/user/DeleteAccountButton'
import { EmailChangeForm } from '@/components/settings/EmailChangeForm'

export const metadata = {
  title: 'アカウント設定',
  robots: { index: false, follow: false },
}

export default async function AccountSettingsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="アカウント設定" />
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isPublic: true },
  })

  if (!user) {
    redirect(ROUTE_LOGIN)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
            &larr; 設定に戻る
          </Link>
          <h1 className="font-bold text-lg mt-1">アカウント設定</h1>
        </div>

        <div className="divide-y">
          <div className="p-4">
            <h2 className="font-medium mb-2">プライバシー設定</h2>
            <PrivacyToggle initialIsPublic={user.isPublic} />
          </div>

          <div className="p-4">
            <h2 className="font-medium mb-2">メールアドレス変更</h2>
            <EmailChangeForm currentEmail={email ?? ''} />
          </div>

          <div className="p-4">
            <h2 className="font-medium mb-2 text-destructive">危険な操作</h2>
            <DeleteAccountButton />
          </div>
        </div>
      </div>
    </div>
  )
}
