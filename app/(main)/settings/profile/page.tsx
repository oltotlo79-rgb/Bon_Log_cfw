/**
 * @fileoverview プロフィール編集ページ
 *
 * このファイルはログインユーザーのプロフィール情報を編集するためのページコンポーネントです。
 * ニックネーム、自己紹介、所在地、プロフィール画像、ヘッダー画像、盆栽歴などを変更できます。
 *
 * 主な機能:
 * - 現在のプロフィール情報の表示と編集フォーム
 * - アバター画像のアップロードと変更
 * - ヘッダー画像のアップロードと変更
 * - 盆栽開始時期の設定（盆栽歴の自動計算用）
 * - 認証チェックによるアクセス制御
 *
 * @route /settings/profile
 * @requires 認証必須 - 未ログインユーザーはログインページへリダイレクト
 */

// Next.jsのナビゲーションユーティリティ（リダイレクト用）
import { redirect } from 'next/navigation'

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'

// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'

// ゲスト判定・エラーメッセージ
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { ERR_GUEST_PROFILE_EDIT } from '@/lib/constants/errors'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'

// NextAuth.jsの認証ヘルパー（現在のセッション取得用）
import { auth } from '@/lib/auth'

// Prismaデータベースクライアント（ユーザー情報取得用）
import { prisma } from '@/lib/db'

// プロフィール編集フォームコンポーネント（入力UI・画像アップロード・保存機能）
import { ProfileEditForm } from '@/components/user/ProfileEditForm'

/**
 * 静的メタデータの定義
 * ページタイトルの設定
 */
export const metadata = {
  title: 'プロフィール編集 - BON-LOG',
}

/**
 * プロフィール編集ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. セッションの認証チェック
 * 2. データベースからユーザー情報を取得
 * 3. ProfileEditFormコンポーネントに現在の情報を渡す
 *
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function ProfileEditPage() {
  // 現在のセッションを取得（認証状態の確認）
  const session = await auth()

  // 未ログインの場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  // ゲストユーザーはプロフィール編集不可（URL直アクセス対策）
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="プロフィール編集" message={ERR_GUEST_PROFILE_EDIT} />
  }

  // データベースから現在のユーザー情報を取得（編集フォームの初期値用）
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,                  // ユーザーID（フォーム送信時の識別用）
      nickname: true,            // ニックネーム
      bio: true,                 // 自己紹介文
      location: true,            // 所在地
      avatarUrl: true,           // アバター画像URL
      headerUrl: true,           // ヘッダー画像URL
      bonsaiStartYear: true,     // 盆栽開始年
      bonsaiStartMonth: true,    // 盆栽開始月
      birthDate: true,           // 生年月日
    },
  })

  // ユーザーが見つからない場合（通常はあり得ないが、安全のため）
  if (!user) {
    redirect(ROUTE_LOGIN)
  }

  // ProfileEditFormコンポーネントが期待する形式にデータを変換
  // キャメルケース -> スネークケース への変換
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

  // プロフィール編集ページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダーセクション */}
        <div className="px-4 py-3 border-b">
          {/* 設定トップページへの戻りリンク */}
          <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
            &larr; 設定に戻る
          </Link>
          <h1 className="font-bold text-lg mt-1">プロフィール編集</h1>
        </div>

        {/* プロフィール編集フォーム */}
        <div className="p-4">
          <ProfileEditForm user={userData} />
        </div>
      </div>
    </div>
  )
}
