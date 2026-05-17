/**
 * @fileoverview ユーザーがいいねした投稿一覧ページ
 *
 * このファイルは特定のユーザーがいいねした全ての投稿を一覧表示するページコンポーネントです。
 * プロフィールページから「いいね」タブを選択した際に表示されます。
 *
 * 主な機能:
 * - ユーザーがいいねした投稿を新しい順に表示
 * - いいね元の投稿者情報の表示
 * - プロフィールページへの戻りリンク
 * - いいねした投稿がない場合の空状態メッセージ表示
 * - SEO用のメタデータ生成
 *
 * @route /users/[id]/likes
 * @param {string} id - 表示対象ユーザーのID
 */

// Next.jsのナビゲーションユーティリティ（404ページへのリダイレクト用）
import { notFound } from 'next/navigation'

// Prismaデータベースクライアント（いいねデータ取得用）
import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { buildUserLikesPath } from '@/lib/constants/path-builders'
import { pageCanonical } from '@/lib/utils/seo'

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
    title: `${user.nickname}のいいね - BON-LOG`,
    alternates: { canonical: pageCanonical(buildUserLikesPath(id)) },
  }
}

/**
 * ユーザーがいいねした投稿一覧ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. ユーザーの存在確認
 * 2. ユーザーがいいねした投稿をリレーション経由で取得
 * 3. いいねした投稿一覧または空状態メッセージを表示
 *
 * @param {Props} props - ページのプロパティ
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function UserLikesPage({ params }: Props) {
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

  // ユーザーのいいね一覧を取得（投稿へのいいねのみ、コメントへのいいねは除外）
  const likes = await prisma.like.findMany({
    where: {
      userId: id,
      postId: { not: null },  // 投稿へのいいねのみを取得
    },
    include: {
      // いいねした投稿の情報をリレーションで取得
      post: {
        include: {
          // 投稿者の基本情報
          user: {
            select: USER_MINIMAL_SELECT,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },  // いいねした順（新しい順）
    take: DEFAULT_PAGE_LIMIT,
  })

  // いいねデータから投稿を抽出（nullを除外）
  type PostType = typeof likes[number]['post']
  const posts = likes
    .map((l: typeof likes[number]) => l.post)
    .filter((p: PostType): p is NonNullable<PostType> => Boolean(p))

  // いいねした投稿一覧ページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダーセクション */}
        <div className="px-4 py-3 border-b">
          {/* プロフィールページへの戻りリンク */}
          <Link href={`/users/${id}`} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">いいねした投稿</h1>
        </div>

        {/* いいねした投稿一覧または空メッセージ */}
        {posts.length > 0 ? (
          <div className="divide-y">
            {/* 各投稿をシンプルなカード形式で表示 */}
            {posts.map((post: typeof posts[number]) => (
              <div key={post.id} className="p-4">
                {/* 投稿者のニックネーム */}
                <p className="text-sm text-muted-foreground mb-1">
                  {post.user.nickname}
                </p>
                {/* 投稿本文（改行を保持して表示） */}
                <p className="whitespace-pre-wrap">{post.content}</p>
                {/* 投稿日時（日本語形式） */}
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(post.createdAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          // いいねした投稿がない場合の空状態メッセージ
          <p className="p-8 text-center text-muted-foreground">
            いいねした投稿がありません
          </p>
        )}
      </div>
    </div>
  )
}
