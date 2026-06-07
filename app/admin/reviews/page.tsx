import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Search, Star } from 'lucide-react'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getAdminReviews } from '@/lib/actions/admin/content'
import { ReviewActionsDropdown } from './ReviewActionsDropdown'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { buildShopPath, buildUserPath } from '@/lib/constants/path-builders'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

export const metadata = {
  title: 'レビュー管理 - BON-LOG 管理',
}

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

      <div className="bg-card rounded-lg border p-4">
        <form className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                    href={buildUserPath(review.user.id)}
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
                    href={buildShopPath(review.shop.id)}
                    className="text-sm hover:underline"
                  >
                    {review.shop.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${star <= review.rating ? 'text-foreground' : 'text-muted-foreground'}`}
                        fill={star <= review.rating ? 'currentColor' : 'none'}
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
