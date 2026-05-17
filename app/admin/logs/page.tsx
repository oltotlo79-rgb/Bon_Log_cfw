/**
 * @file 管理者用操作ログページ
 * @description 管理者による操作履歴を時系列で表示する管理者ページ。
 *              アクション種別でのフィルタリングが可能。
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminLogs } from '@/lib/actions/admin/logs'
import { ADMIN_LOGS_PAGE_LIMIT, ADMIN_ID_DISPLAY_LENGTH } from '@/lib/constants/limits'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { parseJsonObject } from '@/lib/utils/json'
import { CursorPagination } from '@/components/admin/CursorPagination'

export const metadata = {
  title: '操作ログ - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    action?: string
    cursor?: string
    trail?: string
  }>
}

const actionLabels: Record<string, string> = {
  suspend_user: 'ユーザー停止',
  activate_user: 'ユーザー復帰',
  delete_post: '投稿削除',
  delete_event: 'イベント削除',
  delete_shop: '盆栽園削除',
  update_report_status: '通報ステータス更新',
}

const targetTypeLabels: Record<string, string> = {
  user: 'ユーザー',
  post: '投稿',
  event: 'イベント',
  shop: '盆栽園',
  report: '通報',
}

export default async function AdminLogsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const action = params.action
  const { cursor, trail } = parseAdminCursor(params)

  const result = await getAdminLogs({
    action,
    limit: ADMIN_LOGS_PAGE_LIMIT,
    cursor,
  })

  if ('error' in result) {
    redirect(ROUTE_LOGIN)
  }
  const { logs, total, nextCursor } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">操作ログ</h1>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      {/* フィルター */}
      <div className="bg-card rounded-lg border p-4">
        <form className="flex gap-4">
          <select
            name="action"
            defaultValue={action || ''}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">全アクション</option>
            <option value="suspend_user">ユーザー停止</option>
            <option value="activate_user">ユーザー復帰</option>
            <option value="delete_post">投稿削除</option>
            <option value="delete_event">イベント削除</option>
            <option value="delete_shop">盆栽園削除</option>
            <option value="update_report_status">通報ステータス更新</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            フィルター
          </button>
        </form>
      </div>

      {/* ログテーブル */}
      <div className="bg-card rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">日時</th>
              <th className="text-left px-4 py-3 text-sm font-medium">管理者</th>
              <th className="text-left px-4 py-3 text-sm font-medium">アクション</th>
              <th className="text-left px-4 py-3 text-sm font-medium">対象タイプ</th>
              <th className="text-left px-4 py-3 text-sm font-medium">対象ID</th>
              <th className="text-left px-4 py-3 text-sm font-medium">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log: typeof logs[number]) => {
              const details = parseJsonObject(log.details)

              return (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/users/${log.admin.user.id}`}
                      className="text-sm hover:underline"
                    >
                      {log.admin.user.nickname}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.targetType ? (targetTypeLabels[log.targetType] || log.targetType) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {log.targetId ? (
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {log.targetId.slice(0, ADMIN_ID_DISPLAY_LENGTH)}...
                      </code>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {'reason' in details && typeof details.reason === 'string' ? (
                      <span className="line-clamp-1 max-w-[200px]" title={details.reason}>
                        {details.reason}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              )
            })}

            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  ログが見つかりません
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
        baseUrl="/admin/logs"
        filters={{ action }}
      />
    </div>
  )
}
