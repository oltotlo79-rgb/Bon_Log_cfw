/**
 * @fileoverview ブロック中のユーザー一覧ページ
 *
 * このファイルはログインユーザーがブロックしているユーザーの一覧を表示するページコンポーネントです。
 * ブロック解除機能を提供し、ユーザー間の関係性を管理できます。
 *
 * 主な機能:
 * - ブロック中のユーザー一覧表示
 * - 各ユーザーのブロック解除機能
 * - ブロックしているユーザーがいない場合の空状態表示
 * - 認証チェックによるアクセス制御
 *
 * @route /settings/blocked
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

// ブロック中ユーザー取得用のServer Action
import { getBlockedUsers } from '@/lib/actions/block'

// ブロック中ユーザーリスト表示コンポーネント（ブロック解除機能付き）
import { BlockedUserList } from '@/components/user/BlockedUserList'

/**
 * 静的メタデータの定義
 * ページタイトルと説明の設定
 */
export const metadata: Metadata = {
  title: 'ブロック中のユーザー | BON-LOG',
  description: 'ブロック中のユーザー一覧',
  // 認証必須のユーザー個別データのため検索エンジンには公開しない
  robots: { index: false, follow: false },
}

/**
 * ブロック中ユーザー一覧ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. セッションの認証チェック
 * 2. Server Actionを使用してブロック中ユーザーを取得
 * 3. ユーザー一覧または空状態メッセージを表示
 *
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function BlockedUsersPage() {
  // 現在のセッションを取得（認証状態の確認）
  const session = await auth()

  // 未ログインの場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="ブロック中のユーザー" />
  }

  // ブロック中のユーザー一覧をServer Action経由で取得
  const { users } = await getBlockedUsers()

  // ブロック中ユーザー一覧ページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">ブロック中のユーザー</h1>

      {/* ブロック中のユーザーがいない場合の空状態メッセージ */}
      {users.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>ブロック中のユーザーはいません</p>
        </div>
      ) : (
        // ブロック中ユーザーリスト（各ユーザーにブロック解除ボタン付き）
        <BlockedUserList users={users} />
      )}
    </div>
  )
}
