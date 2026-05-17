/**
 * @file 予約投稿編集ページ
 * @description 既存の予約投稿を編集するためのフォームページ（プレミアム会員限定）
 *
 * このファイルは[id]動的ルートパラメータを使用して、
 * 特定の予約投稿を編集するためのページです。
 * プレミアム会員のみがアクセス可能で、ステータスが「pending」の投稿のみ編集できます。
 *
 * @features
 * - 既存予約投稿の編集フォーム
 * - 投稿内容・公開日時の変更
 * - メディア・ジャンルの編集
 * - 所有権チェック（自分の投稿のみ編集可能）
 * - 公開済み投稿の編集防止
 *
 * @access プレミアム会員限定、投稿所有者のみ
 */

// Next.jsのリダイレクト関数と404関数
// 認証/権限チェックと投稿不存在時の処理に使用
import { redirect, notFound } from 'next/navigation'

// ルート定数
import { ROUTE_LOGIN, ROUTE_SCHEDULED_POSTS } from '@/lib/constants/routes'

// NextAuth.jsの認証ヘルパー関数
// ユーザー認証状態の確認に使用
import { auth } from '@/lib/auth'

// Prismaクライアント
// 予約投稿データの取得に使用
import { prisma } from '@/lib/db'

// プレミアム会員判定関数と会員制限取得関数
// 機能へのアクセス権限と投稿制限値の取得に使用
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'

// ジャンル一覧取得のServer Action
// 投稿フォームでのジャンル選択に使用
import { getGenres } from '@/lib/actions/post'

// 予約投稿フォームコンポーネント
// 編集モードで使用
import { ScheduledPostForm } from '@/components/post/ScheduledPostForm'

// Next.jsのリンクコンポーネント
// 戻るリンクに使用
import Link from 'next/link'

// lucide-reactの左矢印アイコン
// 戻るボタンに使用
import { ArrowLeft } from 'lucide-react'

/**
 * ページメタデータ
 * SEOおよびブラウザタブのタイトル設定
 */
export const metadata = {
  title: '予約投稿を編集 | BONLOG',
}

/**
 * 予約投稿取得関数
 *
 * 指定されたIDとユーザーIDに一致する予約投稿を取得します。
 * ステータスが「pending」（未公開）の投稿のみを対象とします。
 * これにより、公開済みまたは失敗した予約投稿は編集できません。
 *
 * @param id - 予約投稿ID
 * @param userId - ユーザーID（所有権チェック用）
 * @returns 予約投稿データ（メディア、ジャンル情報付き）またはnull
 */
async function getScheduledPost(id: string, userId: string) {
  return prisma.scheduledPost.findFirst({
    where: {
      id,
      userId,                // 所有者チェック
      status: 'pending',     // 未公開の予約投稿のみ
    },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },  // メディアを並び順で取得
      genres: true,                               // ジャンル情報も含める
    },
  })
}

/**
 * 予約投稿編集ページコンポーネント
 *
 * 既存の予約投稿を編集するフォームを表示するServer Componentです。
 * プレミアム会員で、かつ投稿の所有者のみがアクセス可能です。
 *
 * @param params - 動的ルートパラメータ（予約投稿ID）
 * @returns 予約投稿編集フォームのJSX要素
 */
export default async function EditScheduledPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // URLパラメータから予約投稿IDを取得
  const { id } = await params

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
    redirect(ROUTE_SCHEDULED_POSTS)
  }

  // 予約投稿を取得（所有権とステータスのチェック込み）
  const scheduledPost = await getScheduledPost(id, session.user.id)
  if (!scheduledPost) {
    // 投稿が見つからない場合は404ページを表示
    // （存在しない、他人の投稿、または公開済みの場合）
    notFound()
  }

  // ジャンル一覧を取得（投稿フォームでの選択用）
  const genresResult = await getGenres()
  const genres = genresResult.genres || {}

  // 会員プランに応じた制限値を取得
  const limits = await getMembershipLimits(session.user.id)

  // 編集フォームに渡すデータを整形
  // フォームコンポーネントが期待する形式に変換
  const editData = {
    id: scheduledPost.id,
    content: scheduledPost.content,
    scheduledAt: scheduledPost.scheduledAt,
    // ジャンルIDの配列を抽出
    genreIds: scheduledPost.genres.map((g: { genreId: string }) => g.genreId),
    // メディア情報をURLと種類のみに簡略化
    media: scheduledPost.media.map((m: { url: string; type: string }) => ({ url: m.url, type: m.type })),
  }

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      {/* ヘッダー部分 - 戻るリンクとタイトル */}
      <div className="flex items-center gap-4 mb-4">
        {/* 予約投稿一覧に戻るリンク */}
        <Link href="/posts/scheduled" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">予約投稿を編集</h1>
      </div>

      {/* 注意書き */}
      <p className="text-sm text-muted-foreground mb-6">
        ※ 設定時間と実際の投稿時間は5分程度ずれることがあります。
      </p>

      {/* 予約投稿フォームコンポーネント（編集モード）
          genres: ジャンル選択オプション
          limits: 投稿の制限値（文字数、画像枚数等）
          editData: 編集対象の既存データ */}
      <ScheduledPostForm genres={genres} limits={limits} editData={editData} />
    </div>
  )
}
