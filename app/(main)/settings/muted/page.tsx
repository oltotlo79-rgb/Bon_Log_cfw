/**
 * @module app/(main)/settings/muted/page
 * ミュート中ユーザーの一覧・解除ページ。
 *
 * ミュートとブロックの違い:
 * - ミュート: 相手の投稿がタイムラインに表示されなくなるが、相手には通知されない
 * - ブロック: 相互にプロフィールや投稿が見えなくなり、フォロー関係も解除される
 */

import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'
import { getMutedUsers } from '@/lib/actions/mute'
import { MutedUserList } from '@/components/user/MutedUserList'

export const metadata: Metadata = {
  title: 'ミュート中のユーザー | BON-LOG',
  description: 'ミュート中のユーザー一覧',
  // 認証必須のユーザー個別データのため検索エンジンには公開しない
  robots: { index: false, follow: false },
}

export default async function MutedUsersPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="ミュート中のユーザー" />
  }

  const { users } = await getMutedUsers()

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">ミュート中のユーザー</h1>

      {users.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>ミュート中のユーザーはいません</p>
        </div>
      ) : (
        <MutedUserList users={users} />
      )}
    </div>
  )
}
