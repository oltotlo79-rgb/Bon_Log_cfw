/**
 * @fileoverview フォローリクエスト管理ページ
 *
 * 非公開アカウントへのフォローリクエストを管理するページです。
 *
 * 主な機能:
 * - 受信したフォローリクエスト一覧の表示
 * - フォローリクエストの承認/拒否
 * - 送信したフォローリクエスト一覧の表示
 * - 送信したリクエストのキャンセル
 *
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { FollowRequestsClient } from './FollowRequestsClient'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'
import {
  getReceivedFollowRequests,
  getSentFollowRequests,
} from '@/lib/actions/follow-request'

/**
 * ページのメタデータ
 */
export const metadata: Metadata = {
  title: 'フォローリクエスト',
  description: 'フォローリクエストの管理',
  // 認証必須のユーザー個別データのため検索エンジンには公開しない
  robots: { index: false, follow: false },
}

/**
 * フォローリクエスト管理ページ
 */
export default async function FollowRequestsPage() {
  // 認証チェック
  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="フォローリクエスト" />
  }

  // 受信・送信したフォローリクエストを取得
  const [receivedResult, sentResult] = await Promise.all([
    getReceivedFollowRequests(),
    getSentFollowRequests(),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h1 className="text-xl font-bold">フォローリクエスト</h1>
          <p className="text-sm text-muted-foreground mt-1">
            受信したリクエストを承認または拒否できます
          </p>
        </div>

        <FollowRequestsClient
          initialReceivedRequests={receivedResult.requests}
          initialSentRequests={sentResult.requests}
        />
      </div>
    </div>
  )
}
