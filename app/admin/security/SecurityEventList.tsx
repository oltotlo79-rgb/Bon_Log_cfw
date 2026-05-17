'use client'

/**
 * @file セキュリティイベントリストコンポーネント
 * @description セキュリティイベントのフィルタリング・ページネーション付きログテーブルを表示するClient Component。
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Filter,
  Loader2,
  ShieldAlert,
  KeyRound,
  Smartphone,
  Mail,
} from 'lucide-react'
import { ADMIN_ID_DISPLAY_LONG_LENGTH } from '@/lib/constants/limits'
import { ROUTE_ADMIN_SECURITY } from '@/lib/constants/routes'

/** セキュリティイベントの型定義 */
interface SecurityEvent {
  id: string
  eventType: string
  userId: string | null
  ipAddress: string | null
  userAgent: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

/** コンポーネントのProps型定義 */
interface SecurityEventListProps {
  /** イベント一覧 */
  events: SecurityEvent[]
  /** 現在のイベント種別フィルター */
  eventType: string
  /** 現在のIPアドレスフィルター */
  ipAddress: string
  /** 開始日 */
  dateFrom: string
  /** 終了日 */
  dateTo: string
}

/** イベント種別の日本語ラベル */
const EVENT_TYPE_LABELS: Record<string, string> = {
  failed_login: 'ログイン失敗',
  password_change: 'パスワード変更',
  '2fa_toggle': '2FA切替',
  email_change: 'メール変更',
}

/** イベント種別に対応するアイコンと色 */
const EVENT_TYPE_CONFIG: Record<string, { icon: typeof ShieldAlert; color: string }> = {
  failed_login: { icon: ShieldAlert, color: 'text-red-600 dark:text-red-400' },
  password_change: { icon: KeyRound, color: 'text-blue-600 dark:text-blue-400' },
  '2fa_toggle': { icon: Smartphone, color: 'text-purple-600 dark:text-purple-400' },
  email_change: { icon: Mail, color: 'text-amber-600 dark:text-amber-400' },
}

/**
 * セキュリティイベントリストコンポーネント
 * フィルタリング・ページネーション付きのイベントログテーブルを表示する
 */
export function SecurityEventList({
  events,
  eventType,
  ipAddress,
  dateFrom,
  dateTo,
}: SecurityEventListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [filterEventType, setFilterEventType] = useState(eventType)
  const [filterIp, setFilterIp] = useState(ipAddress)
  const [filterDateFrom, setFilterDateFrom] = useState(dateFrom)
  const [filterDateTo, setFilterDateTo] = useState(dateTo)

  /** URLパラメータを更新してページ遷移（フィルター変更時は先頭ページへ） */
  function applyFilters() {
    const params = new URLSearchParams()
    if (filterEventType) params.set('eventType', filterEventType)
    if (filterIp) params.set('ipAddress', filterIp)
    if (filterDateFrom) params.set('dateFrom', filterDateFrom)
    if (filterDateTo) params.set('dateTo', filterDateTo)
    const qs = params.toString()
    startTransition(() => {
      router.push(`${ROUTE_ADMIN_SECURITY}${qs ? `?${qs}` : ''}`)
    })
  }

  /** フィルターをリセット */
  function resetFilters() {
    setFilterEventType('')
    setFilterIp('')
    setFilterDateFrom('')
    setFilterDateTo('')
    startTransition(() => {
      router.push(ROUTE_ADMIN_SECURITY)
    })
  }

  /** 日付をフォーマット */
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <h2 className="text-lg font-semibold mb-4">セキュリティイベントログ</h2>

      {/* フィルター */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* イベント種別フィルター */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="text-sm border rounded-md px-3 py-1.5 bg-background"
          >
            <option value="">全てのイベント</option>
            <option value="failed_login">ログイン失敗</option>
            <option value="password_change">パスワード変更</option>
            <option value="2fa_toggle">2FA切替</option>
            <option value="email_change">メール変更</option>
          </select>
        </div>

        {/* IPアドレス検索 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="IPアドレスで検索"
            value={filterIp}
            onChange={(e) => setFilterIp(e.target.value)}
            className="text-sm border rounded-md pl-8 pr-3 py-1.5 bg-background w-48"
          />
        </div>

        {/* 日付範囲 */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="text-sm border rounded-md px-3 py-1.5 bg-background"
          />
          <span className="text-sm text-muted-foreground">~</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="text-sm border rounded-md px-3 py-1.5 bg-background"
          />
        </div>

        {/* フィルターボタン */}
        <button
          onClick={() => applyFilters()}
          disabled={isPending}
          className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '検索'}
        </button>

        <button
          onClick={resetFilters}
          disabled={isPending}
          className="text-sm border px-4 py-1.5 rounded-md hover:bg-muted disabled:opacity-50"
        >
          リセット
        </button>
      </div>

      {/* イベントテーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">種別</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">ユーザーID</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">IPアドレス</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">日時</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  該当するイベントはありません
                </td>
              </tr>
            ) : (
              events.map((event) => {
                const config = EVENT_TYPE_CONFIG[event.eventType]
                const IconComponent = config?.icon || ShieldAlert
                const iconColor = config?.color || 'text-muted-foreground'

                return (
                  <tr key={event.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <IconComponent className={`w-4 h-4 ${iconColor}`} />
                        <span>{EVENT_TYPE_LABELS[event.eventType] || event.eventType}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">
                      {event.userId ? event.userId.slice(0, ADMIN_ID_DISPLAY_LONG_LENGTH) + '...' : '-'}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">
                      {event.ipAddress || '-'}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
