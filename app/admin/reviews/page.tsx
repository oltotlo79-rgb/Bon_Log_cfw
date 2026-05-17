/**
 * @file 管理者用レビュー管理ページ
 * @description 盆栽園レビュー一覧の表示、検索、フィルタリング機能を提供する管理者ページ。
 *              レビューの削除や通報状況の確認が可能。
 */

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'
// Next.jsの画像最適化コンポーネント
import Image from 'next/image'
// Next.jsのリダイレクト関数
import { redirect } from 'next/navigation'
// 認証失敗時のリダイレクト先
import { ROUTE_LOGIN } from '@/lib/constants/routes'
// 管理者用レビュー一覧取得のServer Action
import { getAdminReviews } from '@/lib/actions/admin/content'
// レビュー操作用ドロップダウンメニューコンポーネント
import { ReviewActionsDropdown } from './ReviewActionsDropdown'
// ページネーション定数
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

/**
 * 検索アイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  )
}

function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

/**
 * ページメタデータの定義
 * ブラウザのタイトルバーに表示される
 */
export const metadata = {
  title: 'レビュー管理 - BON-LOG 管理',
}

/**
 * ページコンポーネントのProps型定義
 * URLのクエリパラメータを受け取る
 */
interface PageProps {
  searchParams: Promise<{
    /** レビュー内容の検索キーワード */
    search?: string
    /** 通報されたもののみ表示フラグ */
    hasReports?: string
    /** ページネーション用カーソル */
    cursor?: string
    /** 経由した cursor のリスト（戻る操作用） */
    trail?: string
  }>
}

/**
 * 管理者用レビュー管理ページコンポーネント
 * レビュー一覧をテーブル形式で表示し、検索・フィルタリング機能を提供する
 *
 * @param searchParams - URLのクエリパラメータ
 * @returns レビュー管理ページのJSX要素
 *
 * 処理内容:
 * 1. クエリパラメータから検索条件を取得
 * 2. ページネーション設定（1ページ20件）
 * 3. getAdminReviewsでレビュー一覧を取得
 * 4. 検索フォーム、レビューテーブル、ページネーションを表示
 */
export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ''
  const hasReports = params.hasReports === 'true'
  const { cursor, trail } = parseAdminCursor(params)

  const result = await getAdminReviews({
    search: search || undefined,
    hasReports,
    limit: DEFAULT_PAGE_LIMIT,
    cursor,
  })

  if (!result.success) {
    redirect(ROUTE_LOGIN)
  }
  const { reviews, total, nextCursor } = result.data!

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">レビュー管理</h1>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      {/* フィルター */}
      <div className="bg-card rounded-lg border p-4">
        <form className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                placeholder="レビュー内容で検索"
                defaultValue={search}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="hasReports"
              value="true"
              defaultChecked={hasReports}
              className="rounded"
            />
            <span className="text-sm">通報されたもののみ</span>
          </label>

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            検索
          </button>
        </form>
      </div>

      {/* レビューテーブル */}
      <div className="bg-card rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">投稿者</th>
              <th className="text-left px-4 py-3 text-sm font-medium">盆栽園</th>
              <th className="text-left px-4 py-3 text-sm font-medium">評価</th>
              <th className="text-left px-4 py-3 text-sm font-medium">内容</th>
              <th className="text-left px-4 py-3 text-sm font-medium">通報数</th>
              <th className="text-left px-4 py-3 text-sm font-medium">投稿日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reviews.map((review: typeof reviews[number]) => (
              <tr key={review.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/users/${review.user.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {review.user.avatarUrl ? (
                      <Image
                        src={review.user.avatarUrl}
                        alt={review.user.nickname}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-muted rounded-full" />
                    )}
                    <span className="text-sm">{review.user.nickname}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/shops/${review.shop.id}`}
                    className="text-sm hover:underline"
                  >
                    {review.shop.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <StarIcon
                        key={star}
                        className={`w-4 h-4 ${star <= review.rating ? 'text-foreground' : 'text-muted-foreground'}`}
                        filled={star <= review.rating}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm line-clamp-2 max-w-[200px]">
                    {review.content || '（コメントなし）'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {review.reportCount > 0 ? (
                    <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                      {review.reportCount}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3">
                  <ReviewActionsDropdown reviewId={review.id} shopId={review.shop.id} />
                </td>
              </tr>
            ))}

            {reviews.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  レビューが見つかりません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        baseUrl="/admin/reviews"
        filters={{ search, hasReports: hasReports ? 'true' : undefined }}
      />
    </div>
  )
}
