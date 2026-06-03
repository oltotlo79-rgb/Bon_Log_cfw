/**
 * このファイルは新しい予約投稿を作成するためのページです。
 * プレミアム会員のみがアクセス可能で、投稿内容と公開日時を設定できます。
 *
 * @features
 * - 予約投稿フォーム（テキスト、画像、ジャンル選択）
 * - 公開日時の設定
 * - 会員プランに応じた文字数・画像枚数制限
 * - 予約投稿一覧への戻りリンク
 *
 * @access プレミアム会員限定
 */

// Next.jsのリダイレクト関数
// 認証されていない/非プレミアムユーザーのリダイレクトに使用
import { redirect } from 'next/navigation'

// ルート定数
import { ROUTE_LOGIN, ROUTE_SCHEDULED_POSTS } from '@/lib/constants/routes'

// NextAuth.jsの認証ヘルパー関数
// ユーザー認証状態の確認に使用
import { auth } from '@/lib/auth'

// プレミアム会員判定関数と会員制限取得関数
// 機能へのアクセス権限と投稿制限値の取得に使用
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'

// ジャンル一覧取得のServer Action
// 投稿フォームでのジャンル選択に使用
import { getGenres } from '@/lib/actions/post'

// 予約投稿フォームコンポーネント
// 投稿内容と公開日時の入力フォーム
import { ScheduledPostForm } from '@/components/post/ScheduledPostForm'

// Next.jsのリンクコンポーネント
// 戻るリンクに使用
import Link from 'next/link'

// lucide-reactの左矢印アイコン
// 戻るボタンに使用
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '予約投稿を作成 | BONLOG',
  // 予約投稿作成は所有者専用 (プレミアム会員) のため検索エンジンに公開しない
  robots: { index: false, follow: false },
}

/**
 * 予約投稿作成ページコンポーネント
 *
 * 新規予約投稿を作成するフォームを表示するServer Componentです。
 * プレミアム会員のみがアクセス可能で、非プレミアム会員は
 * 予約投稿一覧ページへリダイレクトされます。
 *
 * @returns 予約投稿作成フォームのJSX要素
 */
export default async function NewScheduledPostPage() {
  // セッション情報を取得して認証状態を確認
  const session = await auth()
  if (!session?.user?.id) {
    // 未認証の場合はログインページへリダイレクト
    redirect(ROUTE_LOGIN)
  }

  // プレミアム会員かどうかを判定
  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    // 非プレミアム会員は予約投稿一覧ページへリダイレクト
    // （一覧ページでアップグレード案内を表示）
    redirect(ROUTE_SCHEDULED_POSTS)
  }

  // ジャンル一覧を取得（投稿フォームでの選択用）
  const genresResult = await getGenres()
  const genres = genresResult.genres || {}

  // 会員プランに応じた制限値を取得
  // （文字数上限、画像枚数上限など）
  const limits = await getMembershipLimits(session.user.id)

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/posts/scheduled" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">予約投稿を作成</h1>
      </div>

      {/* 注意書き */}
      <p className="text-sm text-muted-foreground mb-6">
        ※ 設定時間と実際の投稿時間は5分程度ずれることがあります。
      </p>

      {/* 予約投稿フォームコンポーネント
          genres: ジャンル選択オプション
          limits: 投稿の制限値（文字数、画像枚数等） */}
      <ScheduledPostForm genres={genres} limits={limits} />
    </div>
  )
}
