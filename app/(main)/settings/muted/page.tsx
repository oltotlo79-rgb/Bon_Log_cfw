/**
 * @fileoverview ミュート中のユーザー一覧ページ
 *
 * このファイルはログインユーザーがミュートしているユーザーの一覧を表示するページコンポーネントです。
 * ミュート解除機能を提供し、タイムラインに表示するユーザーを管理できます。
 *
 * ミュートとブロックの違い:
 * - ミュート: 相手の投稿がタイムラインに表示されなくなるが、相手には通知されない
 * - ブロック: 相互にプロフィールや投稿が見えなくなり、フォロー関係も解除される
 *
 * 主な機能:
 * - ミュート中のユーザー一覧表示
 * - 各ユーザーのミュート解除機能
 * - ミュートしているユーザーがいない場合の空状態表示
 * - 認証チェックによるアクセス制御
 *
 * @route /settings/muted
 * @requires 認証必須 - 未ログインユーザーはログインページへリダイレクト
 */

// Next.jsのメタデータ型定義（SEO設定用）
import { Metadata } from 'next'

// NextAuth.jsの認証ヘルパー（現在のセッション取得用）
import { auth } from '@/lib/auth'

// Next.jsのナビゲーションユーティリティ（リダイレクト用）
import { redirect } from 'next/navigation'

// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'

// ゲスト判定
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'

// ミュート中ユーザー取得用のServer Action
import { getMutedUsers } from '@/lib/actions/mute'

// ミュート中ユーザーリスト表示コンポーネント（ミュート解除機能付き）
import { MutedUserList } from '@/components/user/MutedUserList'

/**
 * 静的メタデータの定義
 * ページタイトルと説明の設定
 */
export const metadata: Metadata = {
  title: 'ミュート中のユーザー | BON-LOG',
  description: 'ミュート中のユーザー一覧',
  // 認証必須のユーザー個別データのため検索エンジンには公開しない
  robots: { index: false, follow: false },
}

/**
 * ミュート中ユーザー一覧ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. セッションの認証チェック
 * 2. Server Actionを使用してミュート中ユーザーを取得
 * 3. ユーザー一覧または空状態メッセージを表示
 *
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function MutedUsersPage() {
  // 現在のセッションを取得（認証状態の確認）
  const session = await auth()

  // 未ログインの場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="ミュート中のユーザー" />
  }

  // ミュート中のユーザー一覧をServer Action経由で取得
  const { users } = await getMutedUsers()

  // ミュート中ユーザー一覧ページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">ミュート中のユーザー</h1>

      {/* ミュート中のユーザーがいない場合の空状態メッセージ */}
      {users.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>ミュート中のユーザーはいません</p>
        </div>
      ) : (
        // ミュート中ユーザーリスト（各ユーザーにミュート解除ボタン付き）
        <MutedUserList users={users} />
      )}
    </div>
  )
}
