import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Search } from 'lucide-react'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { buildPostPath, buildUserPath } from '@/lib/constants/path-builders'
import { getAdminPosts } from '@/lib/actions/admin/posts'
import { PostActionsDropdown } from './PostActionsDropdown'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

export const metadata = {
  title: '投稿管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    /** 投稿内容の検索キーワード */
    search?: string
    /** 通報されたもののみ表示フラグ */
    hasReports?: string
    /** ページネーション用カーソル */
    cursor?: string
    /** 経由した cursor のリスト（戻る操作用） */
    trail?: string
  }>
}

export default async function AdminPostsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ''
  const hasReports = params.hasReports === 'true'
  const { cursor, trail } = parseAdminCursor(params)

  const result = await getAdminPosts({
    search: search || undefined,
    hasReports,
    limit: DEFAULT_PAGE_LIMIT,
    cursor,
  })

  if ('error' in result) {
    redirect(ROUTE_LOGIN)
  }
  const { posts, total, nextCursor } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">投稿管理</h1>
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
                placeholder="投稿内容で検索"
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
              <th className="text-left px-4 py-3 text-sm font-medium">内容</th>
              <th className="text-left px-4 py-3 text-sm font-medium">いいね</th>
              <th className="text-left px-4 py-3 text-sm font-medium">通報数</th>
              <th className="text-left px-4 py-3 text-sm font-medium">投稿日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {posts.map((post: typeof posts[number]) => (
              <tr key={post.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={buildUserPath(post.user.id)}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {post.user.avatarUrl ? (
                      <Image
                        src={post.user.avatarUrl}
                        alt={post.user.nickname}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-muted rounded-full" />
                    )}
                    <span className="text-sm">{post.user.nickname}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={buildPostPath(post.id)}
                    className="text-sm line-clamp-2 hover:underline max-w-[300px]"
                  >
                    {post.content || '（メディアのみ）'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm">
                  {post._count.likes}
                </td>
                <td className="px-4 py-3">
                  {post.reportCount > 0 ? (
                    <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                      {post.reportCount}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(post.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3">
                  <PostActionsDropdown postId={post.id} />
                </td>
              </tr>
            ))}

            {posts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  投稿が見つかりません
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
        baseUrl="/admin/posts"
        filters={{ search, hasReports: hasReports ? 'true' : undefined }}
      />
    </div>
  )
}
