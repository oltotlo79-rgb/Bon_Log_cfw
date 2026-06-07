import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Search } from 'lucide-react'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getAdminUsers } from '@/lib/actions/admin/users'
import { UserActionsDropdown } from './UserActionsDropdown'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

export const metadata = {
  title: 'ユーザー管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    /** ニックネーム・メールアドレスの検索キーワード */
    search?: string
    /** ユーザーステータスフィルター */
    status?: 'all' | 'active' | 'suspended'
    /** ページネーション用カーソル */
    cursor?: string
    /** 経由した cursor のリスト（戻る操作用） */
    trail?: string
  }>
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ''
  const status = params.status || 'all'
  const { cursor, trail } = parseAdminCursor(params)

  const result = await getAdminUsers({
    search: search || undefined,
    status,
    limit: DEFAULT_PAGE_LIMIT,
    cursor,
  })

  if ('error' in result) {
    redirect(ROUTE_LOGIN)
  }
  const { users, total, nextCursor } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
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
                placeholder="ニックネーム・メールアドレスで検索"
                defaultValue={search}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
              />
            </div>
          </div>

          <select
            name="status"
            defaultValue={status}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            <option value="all">全ユーザー</option>
            <option value="active">アクティブ</option>
            <option value="suspended">停止中</option>
          </select>

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
              <th className="text-left px-4 py-3 text-sm font-medium">ユーザー</th>
              <th className="text-left px-4 py-3 text-sm font-medium">メール</th>
              <th className="text-left px-4 py-3 text-sm font-medium">投稿数</th>
              <th className="text-left px-4 py-3 text-sm font-medium">登録日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user: typeof users[number]) => (
              <tr key={user.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt={user.nickname}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-muted rounded-full" />
                    )}
                    <span className="font-medium">{user.nickname}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {user.email}
                </td>
                <td className="px-4 py-3 text-sm">
                  {user._count.posts}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3">
                  {user.isSuspended ? (
                    <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                      停止中
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                      アクティブ
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <UserActionsDropdown
                    userId={user.id}
                    isSuspended={user.isSuspended || false}
                  />
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  ユーザーが見つかりません
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
        baseUrl="/admin/users"
        filters={{ search, status: status !== 'all' ? status : undefined }}
      />
    </div>
  )
}
