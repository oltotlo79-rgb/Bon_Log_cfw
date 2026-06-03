import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getContactInquiries, getContactStats } from '@/lib/actions/contact'
import { ContactActionsDropdown } from './ContactActionsDropdown'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

/**
 * ステータスの日本語ラベル定義
 */
const STATUS_LABELS: Record<string, string> = {
  pending: '未対応',
  in_progress: '対応中',
  resolved: '解決済',
  closed: 'クローズ',
}

/**
 * ステータスの背景色・文字色定義
 */
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  in_progress: 'bg-blue-500/10 text-blue-600',
  resolved: 'bg-green-500/10 text-green-600',
  closed: 'bg-gray-500/10 text-gray-600',
}

/**
 * カテゴリーの日本語ラベル定義（短縮形）
 */
const CATEGORY_LABELS: Record<string, string> = {
  general: '一般',
  account: 'アカウント',
  bug: '不具合',
  feature: '機能要望',
  premium: 'プレミアム',
  other: 'その他',
}

export const metadata = {
  title: 'お問い合わせ管理 - BON-LOG 管理',
}

/**
 * お問い合わせ管理ページコンポーネント
 * お問い合わせの一覧表示、検索、フィルタリング、ステータス管理を提供する
 *
 * カーソルベースページネーションを採用しており、
 * `cursor` と `trail` の 2 パラメータで前後ナビゲーションを実現する
 * （CLAUDE.md ルール #4: offset 不使用）。
 */
export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; cursor?: string; trail?: string }>
}) {
  const params = await searchParams
  const status = params.status || ''
  const search = params.search || ''
  const { cursor, trail } = parseAdminCursor(params)

  const [statsResult, inquiriesResult] = await Promise.all([
    getContactStats(),
    getContactInquiries({
      status: status || undefined,
      search: search || undefined,
      cursor,
    }),
  ])

  if (!statsResult.success || !inquiriesResult.success) {
    return <div className="p-6 text-destructive">権限エラー</div>
  }

  // ActionResult<T> は `data?: T` を optional として持つため、
  // 実行時には成功時必ず data が入るが型上は `T | undefined`。
  // 他の admin ページと同じ流儀で non-null assertion で narrowing する。
  const stats = statsResult.data!
  const { inquiries, total, nextCursor } = inquiriesResult.data!

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">お問い合わせ管理</h1>
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> ダッシュボードに戻る
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">未対応</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">対応中</p>
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">解決済</p>
          <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">クローズ</p>
          <p className="text-2xl font-bold text-gray-600">{stats.closed}</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <form className="flex flex-wrap gap-4">
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border px-3 py-2 text-sm bg-background"
          >
            <option value="">すべてのステータス</option>
            <option value="pending">未対応</option>
            <option value="in_progress">対応中</option>
            <option value="resolved">解決済</option>
            <option value="closed">クローズ</option>
          </select>
          <input
            name="search"
            type="text"
            placeholder="名前・メール・件名で検索"
            defaultValue={search}
            className="rounded-md border px-3 py-2 text-sm bg-background flex-1 min-w-[200px]"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            検索
          </button>
        </form>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">名前</th>
                <th className="px-4 py-3 text-left font-medium">メール</th>
                <th className="px-4 py-3 text-left font-medium">カテゴリ</th>
                <th className="px-4 py-3 text-left font-medium">件名</th>
                <th className="px-4 py-3 text-left font-medium">ステータス</th>
                <th className="px-4 py-3 text-left font-medium">日時</th>
                <th className="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    お問い合わせはありません
                  </td>
                </tr>
              ) : (
                inquiries.map((inquiry) => (
                  <tr key={inquiry.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/admin/contact/${inquiry.id}`} className="hover:underline font-medium">
                        {inquiry.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{inquiry.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs">
                        {CATEGORY_LABELS[inquiry.category] || inquiry.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{inquiry.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[inquiry.status] || ''}`}>
                        {STATUS_LABELS[inquiry.status] || inquiry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(inquiry.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <ContactActionsDropdown
                        inquiryId={inquiry.id}
                        currentStatus={inquiry.status}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        total={total}
        baseUrl="/admin/contact"
        filters={{ status: status || undefined, search: search || undefined }}
      />
    </div>
  )
}
