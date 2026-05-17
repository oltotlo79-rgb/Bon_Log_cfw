/**
 * @fileoverview ユーザーがフォロー中のユーザー一覧ページ
 *
 * このファイルは特定のユーザーがフォローしている全てのユーザーを一覧表示するページコンポーネントです。
 * プロフィールページの「フォロー中」カウントをクリックした際に表示されます。
 *
 * 主な機能:
 * - フォロー中のユーザーを新しい順（フォロー開始日順）に表示
 * - 各ユーザーのアバター、ニックネーム、自己紹介を表示
 * - プロフィールページへの戻りリンク
 * - フォロー中のユーザーがいない場合の空状態メッセージ表示
 * - SEO用のメタデータ生成
 *
 * @route /users/[id]/following
 * @param {string} id - 表示対象ユーザーのID
 */

// Next.jsのナビゲーションユーティリティ（404ページへのリダイレクト用）
import { notFound } from 'next/navigation'

// Prismaデータベースクライアント（フォローデータ取得用）
import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { buildUserFollowingPath } from '@/lib/constants/path-builders'
import { pageCanonical } from '@/lib/utils/seo'

// ユーザーリスト表示コンポーネント（アバター、名前、自己紹介を統一フォーマットで表示）
import { UserList } from '@/components/user/UserList'

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'

/**
 * ページコンポーネントのProps型定義
 * Next.js 15以降ではparamsがPromiseとして渡される
 */
type Props = {
  params: Promise<{ id: string }>
}

/**
 * ページのメタデータを動的に生成する関数
 *
 * ユーザー名を含むページタイトルを生成します。
 *
 * @param {Props} props - ページのプロパティ（ユーザーID含む）
 * @returns {Promise<Object>} メタデータオブジェクト
 */
export async function generateMetadata({ params }: Props) {
  // パラメータからユーザーIDを取得
  const { id } = await params

  // ユーザーのニックネームを取得（メタデータ用）
  const user = await prisma.user.findUnique({
    where: { id },
    select: { nickname: true },
  })

  if (!user) {
    return { title: 'ユーザーが見つかりません' }
  }

  return {
    title: `${user.nickname}がフォロー中 - BON-LOG`,
    alternates: { canonical: pageCanonical(buildUserFollowingPath(id)) },
  }
}

/**
 * フォロー中ユーザー一覧ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. ユーザーの存在確認
 * 2. フォロー関係のデータを取得（followerId = 対象ユーザー）
 * 3. フォロー中のユーザーをUserListコンポーネントで表示
 *
 * データベース構造:
 * - Follow テーブル: followerId（フォローする人）-> followingId（フォローされる人）
 * - このページでは followerId が対象ユーザーのレコードを取得
 *
 * @param {Props} props - ページのプロパティ
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function FollowingPage({ params }: Props) {
  // URLパラメータからユーザーIDを取得
  const { id } = await params

  // ユーザーの基本情報を取得（存在確認とニックネーム表示用）
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true },
  })

  // ユーザーが存在しない場合は404ページを表示
  if (!user) {
    notFound()
  }

  // 対象ユーザーがフォローしているユーザー一覧を取得
  // followerId = id は「このユーザーがフォローしている」レコード
  const following = await prisma.follow.findMany({
    where: { followerId: id },
    include: {
      // フォロー先（フォローされている人）の情報を取得
      following: {
        select: USER_MINIMAL_WITH_BIO_SELECT,
      },
    },
    orderBy: { createdAt: 'desc' },  // フォロー開始日が新しい順
    take: DEFAULT_PAGE_LIMIT,
  })

  // UserListコンポーネントが期待する形式にデータを変換
  // avatarUrl -> avatar_url への変換（スネークケースへの対応）
  const users = following.map((f: typeof following[number]) => ({
    ...f.following,
    avatar_url: f.following.avatarUrl,
  }))

  // フォロー中ユーザー一覧ページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダーセクション */}
        <div className="px-4 py-3 border-b">
          {/* プロフィールページへの戻りリンク */}
          <Link href={`/users/${id}`} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">フォロー中</h1>
        </div>

        {/* ユーザーリストコンポーネント（空状態メッセージ含む） */}
        <UserList
          users={users}
          emptyMessage="フォロー中のユーザーはいません"
        />
      </div>
    </div>
  )
}
