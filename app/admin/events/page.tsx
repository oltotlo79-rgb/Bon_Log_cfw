import Link from 'next/link'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/actions/admin'
import { redirect } from 'next/navigation'
import { EventActionsDropdown } from './EventActionsDropdown'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { ROUTE_FEED, ROUTE_ADMIN_EVENTS_IMPORT } from '@/lib/constants/routes'
import { buildEventPath, buildUserPath } from '@/lib/constants/path-builders'

export const metadata = {
  title: 'イベント管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    search?: string
    cursor?: string
  }>
}

export default async function AdminEventsPage({ searchParams }: PageProps) {
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
          { title: { contains: search } },
          { venue: { contains: search } },
        ],
      }
    : {}

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        creator: {
          select: { id: true, nickname: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...buildCursorPagination(cursor, limit),
    }),
    prisma.event.count({ where }),
  ])

  const nextCursor = events.length === limit ? events[events.length - 1]?.id : undefined
  const nextHref = nextCursor
    ? `/admin/events?${new URLSearchParams({ ...(search && { search }), cursor: nextCursor }).toString()}`
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">イベント管理</h1>
        <div className="flex items-center gap-4">
          <Link
            href={ROUTE_ADMIN_EVENTS_IMPORT}
            className="px-4 py-2 border rounded-lg hover:bg-muted text-sm"
          >
            外部イベントインポート
          </Link>
          <span className="text-sm text-muted-foreground">全 {total} 件</span>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <form className="flex gap-4">
          <input
            type="text"
            name="search"
            placeholder="タイトル・会場で検索"
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
              <th className="text-left px-4 py-3 text-sm font-medium">タイトル</th>
              <th className="text-left px-4 py-3 text-sm font-medium">登録者</th>
              <th className="text-left px-4 py-3 text-sm font-medium">開催日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">場所</th>
              <th className="text-left px-4 py-3 text-sm font-medium">登録日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((event: typeof events[number]) => (
              <tr key={event.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={buildEventPath(event.id)}
                    className="text-sm font-medium hover:underline line-clamp-1 max-w-[200px]"
                  >
                    {event.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {event.creator ? (
                  <Link
                    href={buildUserPath(event.creator.id)}
                    className="text-sm hover:underline"
                  >
                    {event.creator.nickname}
                  </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">削除済みユーザー</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {new Date(event.startDate).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {event.prefecture}
                  {event.city && ` ${event.city}`}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(event.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3">
                  <EventActionsDropdown eventId={event.id} />
                </td>
              </tr>
            ))}

            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  イベントが見つかりません
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
