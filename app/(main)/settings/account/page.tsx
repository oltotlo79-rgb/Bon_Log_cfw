/**
 * @fileoverview アカウント設定ページ
 *
 * このファイルはログインユーザーのアカウント設定を管理するためのページコンポーネントです。
 * プライバシー設定（公開/非公開）とアカウント削除機能を提供します。
 *
 * 主な機能:
 * - アカウント公開/非公開の切り替え
 * - アカウント削除（危険な操作として明示）
 * - 認証チェックによるアクセス制御
 *
 * @requires 認証必須 - 未ログインユーザーはログインページへリダイレクト
 */

// Next.jsのナビゲーションユーティリティ（リダイレクト用）
import { redirect } from 'next/navigation'

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'

// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'

// ゲスト判定
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'

// NextAuth.jsの認証ヘルパー（現在のセッション取得用）
import { auth } from '@/lib/auth'

// Prismaデータベースクライアント（ユーザー情報取得用）
import { prisma } from '@/lib/db'

// 公開/非公開切り替えコンポーネント
import { PrivacyToggle } from '@/components/user/PrivacyToggle'

// アカウント削除ボタンコンポーネント
import { DeleteAccountButton } from '@/components/user/DeleteAccountButton'

/**
 * ページタイトルの設定
 */
export const metadata = {
  title: 'アカウント設定',
  robots: { index: false, follow: false },
}

/**
 * アカウント設定ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. セッションの認証チェック
 * 2. データベースからユーザーの公開設定を取得
 * 3. プライバシー設定とアカウント削除のUIを表示
 *
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function AccountSettingsPage() {
  // 現在のセッションを取得（認証状態の確認）
  const session = await auth()

  // 未ログインの場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  // ゲストユーザーはアカウント設定不可（URL直アクセス対策）
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="アカウント設定" />
  }

  // データベースから現在のユーザー情報を取得（公開設定のみ）
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isPublic: true },  // 公開設定フラグ
  })

  // ユーザーが見つからない場合（通常はあり得ないが、安全のため）
  if (!user) {
    redirect(ROUTE_LOGIN)
  }

  // アカウント設定ページのUIをレンダリング
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
            <h2 className="font-medium mb-2 text-destructive">危険な操作</h2>
            <DeleteAccountButton />
          </div>
        </div>
      </div>
    </div>
  )
}
