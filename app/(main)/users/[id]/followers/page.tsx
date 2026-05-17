/**
 * @fileoverview ユーザーのフォロワー一覧ページ
 *
 * このファイルは特定のユーザーをフォローしている全てのユーザーを一覧表示するページコンポーネントです。
 * プロフィールページの「フォロワー」カウントをクリックした際に表示されます。
 *
 * 主な機能:
 * - フォロワーユーザーを新しい順（フォロー開始日順）に表示
 * - 各フォロワーのアバター、ニックネーム、自己紹介を表示
 * - プロフィールページへの戻りリンク
 * - フォロワーがいない場合の空状態メッセージ表示
 * - SEO用のメタデータ生成
 *
 * @route /users/[id]/followers
 * @param {string} id - 表示対象ユーザーのID
 */

// Next.jsのナビゲーションユーティリティ（404ページへのリダイレクト用）
import { notFound } from 'next/navigation'
import { cache } from 'react'

// Prismaデータベースクライアント（フォロワーデータ取得用）
import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { buildUserFollowersPath } from '@/lib/constants/path-builders'
import { pageCanonical } from '@/lib/utils/seo'

// ユーザーリスト表示コンポーネント（アバター、名前、自己紹介を統一フォーマットで表示）
import { UserList } from '@/components/user/UserList'

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'

const getUser = cache(async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true },
  })
})

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
  const user = await getUser(id)

  if (!user) {
    return { title: 'ユーザーが見つかりません' }
  }

  return {
    title: `${user.nickname}のフォロワー - BON-LOG`,
    alternates: { canonical: pageCanonical(buildUserFollowersPath(id)) },
  }
}

/**
 * フォロワー一覧ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. ユーザーの存在確認
 * 2. フォロワー関係のデータを取得（followingId = 対象ユーザー）
 * 3. フォロワーをUserListコンポーネントで表示
 *
 * データベース構造:
 * - Follow テーブル: followerId（フォローする人）-> followingId（フォローされる人）
 * - このページでは followingId が対象ユーザーのレコードを取得
 *
 * @param {Props} props - ページのプロパティ
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function FollowersPage({ params }: Props) {
  // URLパラメータからユーザーIDを取得
  const { id } = await params

  // ユーザーの基本情報を取得（存在確認とニックネーム表示用）
  const user = await getUser(id)

  // ユーザーが存在しない場合は404ページを表示
  if (!user) {
    notFound()
  }

  // 対象ユーザーをフォローしているユーザー一覧を取得
  // followingId = id は「このユーザーをフォローしている」レコード
  const followers = await prisma.follow.findMany({
    where: { followingId: id },
    include: {
      // フォロワー（フォローしている人）の情報を取得
      follower: {
        select: USER_MINIMAL_WITH_BIO_SELECT,
      },
    },
    orderBy: { createdAt: 'desc' },  // フォロー開始日が新しい順
    take: DEFAULT_PAGE_LIMIT,
  })

  // UserListコンポーネントが期待する形式にデータを変換
  // avatarUrl -> avatar_url への変換（スネークケースへの対応）
  const users = followers.map((f: typeof followers[number]) => ({
    ...f.follower,
    avatar_url: f.follower.avatarUrl,
  }))

  // フォロワー一覧ページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダーセクション */}
        <div className="px-4 py-3 border-b">
          {/* プロフィールページへの戻りリンク */}
          <Link href={`/users/${id}`} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">フォロワー</h1>
        </div>

        {/* ユーザーリストコンポーネント（空状態メッセージ含む） */}
        <UserList
          users={users}
          emptyMessage="フォロワーはいません"
        />
      </div>
    </div>
  )
}
