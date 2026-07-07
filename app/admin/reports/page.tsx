import Link from 'next/link'
import Image from 'next/image'
import { getReports } from '@/lib/actions/report'
import { REPORT_REASONS, TARGET_TYPE_LABELS, type ReportStatus } from '@/lib/constants/report'
import { ReportActionsDropdown } from './ReportActionsDropdown'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { buildUserPath } from '@/lib/constants/path-builders'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

export const metadata = {
  title: '通報管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    /** 通報ステータスフィルター */
    status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
    /** 通報対象タイプフィルター */
    targetType?: 'post' | 'comment' | 'event' | 'shop' | 'user'
    /** ページネーション用カーソル */
    cursor?: string
    /** 経由した cursor のリスト（戻る操作用） */
    trail?: string
  }>
}

/**
 * ステータスの日本語ラベル定義
 */
const statusLabels: Record<ReportStatus, string> = {
  pending: '未対応',
  reviewed: '確認中',
  resolved: '対応完了',
  dismissed: '却下',
  auto_hidden: '自動非表示',
}

/**
 * ステータスに応じた色クラス定義
 */
const statusColors: Record<ReportStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  reviewed: 'bg-muted text-muted-foreground',
  resolved: 'bg-muted text-muted-foreground',
  dismissed: 'bg-muted text-muted-foreground',
  auto_hidden: 'bg-muted text-muted-foreground',
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = params.status
  const targetType = params.targetType
  const { cursor, trail } = parseAdminCursor(params)

  const result = await getReports({
    status,
    targetType,
    limit: DEFAULT_PAGE_LIMIT,
    cursor,
  })

  if ('error' in result) {
    return <div className="text-destructive">{result.error}</div>
  }

  const { reports, total, nextCursor } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">通報管理</h1>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <form className="flex flex-wrap gap-4">
          <select
            name="status"
            defaultValue={status || ''}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">全ステータス</option>
            <option value="pending">未対応</option>
            <option value="reviewed">確認中</option>
            <option value="resolved">対応完了</option>
            <option value="dismissed">却下</option>
          </select>

          <select
            name="targetType"
            defaultValue={targetType || ''}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">全タイプ</option>
            <option value="post">投稿</option>
            <option value="comment">コメント</option>
            <option value="event">イベント</option>
            <option value="shop">盆栽園</option>
            <option value="user">ユーザー</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            フィルター
          </button>
        </form>
      </div>

      <div className="bg-card rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">通報者</th>
              <th className="text-left px-4 py-3 text-sm font-medium">対象タイプ</th>
              <th className="text-left px-4 py-3 text-sm font-medium">理由</th>
              <th className="text-left px-4 py-3 text-sm font-medium">詳細</th>
              <th className="text-left px-4 py-3 text-sm font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-sm font-medium">通報日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reports.map((report: typeof reports[number]) => {
              const reasonLabel = REPORT_REASONS.find(r => r.value === report.reason)?.label || report.reason

              return (
                <tr key={report.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={buildUserPath(report.reporter.id)}
                      className="flex items-center gap-2 hover:underline"
                    >
                      {report.reporter.avatarUrl ? (
                        <Image
                          src={report.reporter.avatarUrl}
                          alt={report.reporter.nickname}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-muted rounded-full" />
                      )}
                      <span className="text-sm">{report.reporter.nickname}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs bg-muted rounded-full">
                      {TARGET_TYPE_LABELS[report.targetType as keyof typeof TARGET_TYPE_LABELS] ?? report.targetType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {reasonLabel}
                  </td>
                  <td className="px-4 py-3">
                    {report.description ? (
                      <span className="text-sm line-clamp-1 max-w-[200px]">
                        {report.description}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[report.status as keyof typeof statusColors] ?? 'bg-muted text-muted-foreground'}`}>
                      {statusLabels[report.status as keyof typeof statusLabels] ?? report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(report.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    <ReportActionsDropdown
                      reportId={report.id}
                      currentStatus={report.status}
                      targetType={report.targetType}
                      targetId={report.targetId}
                    />
                  </td>
                </tr>
              )
            })}

            {reports.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  通報が見つかりません
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
        baseUrl="/admin/reports"
        filters={{ status, targetType }}
      />
    </div>
  )
}
