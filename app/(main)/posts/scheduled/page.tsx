/**
 * @file 予約投稿一覧ページ
 * @description ユーザーの予約投稿を一覧表示するページ（プレミアム会員限定）
 *
 * このファイルは予約投稿機能のメインページです。
 * プレミアム会員のみがアクセス可能で、未公開の予約投稿を管理できます。
 *
 * @features
 * - 予約投稿一覧の表示（投稿予定日時順）
 * - 新規予約投稿作成へのリンク
 * - 非プレミアム会員へのアップグレード案内
 * - 予約投稿の編集・削除機能（リスト内）
 *
 * @access プレミアム会員限定
 */

// Next.jsのリダイレクト関数
// 認証されていないユーザーのリダイレクトに使用
import { redirect } from 'next/navigation'

// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'

// NextAuth.jsの認証ヘルパー関数
// ユーザー認証状態の確認に使用
import { auth } from '@/lib/auth'

// Prismaクライアント
// 予約投稿データの取得に使用
import { prisma } from '@/lib/db'

// プレミアム会員判定関数
// 機能へのアクセス権限チェックに使用
import { isPremiumUser } from '@/lib/premium'

// 予約投稿一覧コンポーネント
// 予約投稿カードのリスト表示
import { ScheduledPostList } from '@/components/post/ScheduledPostList'

// shadcn/uiのボタンコンポーネント
import { Button } from '@/components/ui/button'

// Next.jsのリンクコンポーネント
import Link from 'next/link'

// lucide-reactのカレンダープラスアイコン
// 新規作成ボタンと非プレミアム向け表示に使用
import { CalendarPlus } from 'lucide-react'

/**
 * ページメタデータ
 * SEOおよびブラウザタブのタイトル設定
 */
export const metadata = {
  title: '予約投稿 | BONLOG',
}

/**
 * 予約投稿一覧取得関数
 *
 * 指定ユーザーの予約投稿を取得します。
 * メディアとジャンル情報も含めて取得し、予約日時の降順でソートします。
 *
 * @param userId - ユーザーID
 * @returns 予約投稿の配列（メディア、ジャンル情報付き）
 */
async function getScheduledPosts(userId: string) {
  return prisma.scheduledPost.findMany({
    where: { userId },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },  // メディアを並び順で取得
      genres: { include: { genre: true } },      // ジャンル情報も含める
    },
    orderBy: { scheduledAt: 'desc' },            // 予約日時の降順
  })
}

/**
 * 予約投稿一覧ページコンポーネント
 *
 * 予約投稿の管理ページを表示するServer Componentです。
 * プレミアム会員のみがアクセス可能で、非プレミアム会員には
 * アップグレード案内を表示します。
 *
 * @returns 予約投稿一覧ページのJSX要素
 */
export default async function ScheduledPostsPage() {
  // セッション情報を取得して認証状態を確認
  const session = await auth()
  if (!session?.user?.id) {
    // 未認証の場合はログインページへリダイレクト
    redirect(ROUTE_LOGIN)
  }

  // プレミアム会員かどうかを判定
  const isPremium = await isPremiumUser(session.user.id)

  // 非プレミアム会員の場合はアップグレード案内を表示
  if (!isPremium) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="text-center py-12 bg-card rounded-lg border">
          {/* カレンダーアイコン - 予約投稿機能を象徴 */}
          <CalendarPlus className="w-16 h-16 mx-auto text-muted-foreground mb-4" />

          <h1 className="text-2xl font-bold mb-2">予約投稿機能</h1>
          <p className="text-muted-foreground mb-6">
            予約投稿はプレミアム会員限定の機能です。
          </p>

          {/* プレミアム登録ページへのリンク */}
          <Button asChild variant="bonsai">
            <Link href="/settings/subscription">プレミアムに登録</Link>
          </Button>
        </div>
      </div>
    )
  }

  // プレミアム会員の場合は予約投稿一覧を取得して表示
  const scheduledPosts = await getScheduledPosts(session.user.id)

  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* ヘッダー部分 - タイトルと新規作成ボタン */}
      <div className="flex items-center justify-between mb-6 px-4">
        <h1 className="text-xl font-bold">予約投稿</h1>

        {/* 新規予約投稿作成ボタン */}
        <Button asChild size="sm" variant="bonsai">
          <Link href="/posts/scheduled/new">
            <CalendarPlus className="w-4 h-4 mr-2" />
            新規作成
          </Link>
        </Button>
      </div>

      {/* 予約投稿一覧コンポーネント */}
      <ScheduledPostList scheduledPosts={scheduledPosts} />
    </div>
  )
}
