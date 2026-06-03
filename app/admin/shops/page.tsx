import Link from 'next/link'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/actions/admin'
import { redirect } from 'next/navigation'
import { ShopActionsDropdown } from './ShopActionsDropdown'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { ROUTE_FEED } from '@/lib/constants/routes'
import { buildShopPath, buildUserPath } from '@/lib/constants/path-builders'

export const metadata = {
  title: '盆栽園管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    search?: string
    cursor?: string
  }>
}

export default async function AdminShopsPage({ searchParams }: PageProps) {
  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    redirect(ROUTE_FEED)
  }

  const params = await searchParams
  const search = params.search || ''
  const cursor = params.cursor || undefined
  const limit = DEFAULT_PAGE_LIMIT

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { address: { contains: search } },
        ],
      }
    : {}

  const [shops, total] = await Promise.all([
    prisma.bonsaiShop.findMany({
      where,
      include: {
        creator: {
          select: { id: true, nickname: true },
        },
        _count: {
          select: { reviews: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...buildCursorPagination(cursor, limit),
    }),
    prisma.bonsaiShop.count({ where }),
  ])

  const nextCursor = shops.length === limit ? shops[shops.length - 1]?.id : undefined
  const nextHref = nextCursor
    ? `/admin/shops?${new URLSearchParams({ ...(search && { search }), cursor: nextCursor }).toString()}`
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">盆栽園管理</h1>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <form className="flex gap-4">
          <input
            type="text"
            name="search"
            placeholder="名前・住所で検索"
            defaultValue={search}
            className="flex-1 px-4 py-2 border rounded-lg bg-background"
          />
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
              <th className="text-left px-4 py-3 text-sm font-medium">名前</th>
              <th className="text-left px-4 py-3 text-sm font-medium">登録者</th>
              <th className="text-left px-4 py-3 text-sm font-medium">住所</th>
              <th className="text-left px-4 py-3 text-sm font-medium">レビュー数</th>
              <th className="text-left px-4 py-3 text-sm font-medium">登録日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shops.map((shop: typeof shops[number]) => (
              <tr key={shop.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={buildShopPath(shop.id)}
                    className="text-sm font-medium hover:underline line-clamp-1 max-w-[200px]"
                  >
                    {shop.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {shop.creator ? (
                  <Link
                    href={buildUserPath(shop.creator.id)}
                    className="text-sm hover:underline"
                  >
                    {shop.creator.nickname}
                  </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">削除済みユーザー</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
                  {shop.address || '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {shop._count.reviews}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(shop.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3">
                  <ShopActionsDropdown shopId={shop.id} />
                </td>
              </tr>
            ))}

            {shops.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  盆栽園が見つかりません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextHref && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={nextHref}
            className="px-4 py-2 border rounded hover:bg-muted text-sm"
          >
            次のページ
          </Link>
        </div>
      )}
    </div>
  )
}
