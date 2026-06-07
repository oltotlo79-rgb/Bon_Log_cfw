/**
 * @module app/(main)/settings/profile/page
 * ログインユーザーのプロフィール編集ページ。
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { ERR_GUEST_PROFILE_EDIT } from '@/lib/constants/errors'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ProfileEditForm } from '@/components/user/ProfileEditForm'

export const metadata = {
  title: 'プロフィール編集',
  robots: { index: false, follow: false },
}

export default async function ProfileEditPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="プロフィール編集" message={ERR_GUEST_PROFILE_EDIT} />
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      nickname: true,
      bio: true,
      location: true,
      avatarUrl: true,
      headerUrl: true,
      bonsaiStartYear: true,
      bonsaiStartMonth: true,
      birthDate: true,
    },
  })

  if (!user) {
    redirect(ROUTE_LOGIN)
  }

  const userData = {
    id: user.id,
    nickname: user.nickname,
    bio: user.bio,
    location: user.location,
    avatar_url: user.avatarUrl,
    header_url: user.headerUrl,
    bonsai_start_year: user.bonsaiStartYear,
    bonsai_start_month: user.bonsaiStartMonth,
    birth_date: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
            &larr; 設定に戻る
          </Link>
          <h1 className="font-bold text-lg mt-1">プロフィール編集</h1>
        </div>

        <div className="p-4">
          <ProfileEditForm user={userData} />
        </div>
      </div>
    </div>
  )
}
