'use client'

import { useState, useTransition } from 'react'
import {
  scrapeExternalEvents,
  scrapeEventsByRegion,
  importSelectedEvents,
  type ImportableEvent,
} from '@/lib/actions/event-import'
import { BONSAI_EVENT_SOURCES } from '@/lib/scraping/bonsai-events'
import { PREFECTURES } from '@/lib/prefectures'
import { SIMILAR_EVENT_TITLE_LENGTH } from '@/lib/constants/limits'
import { ChevronRight } from 'lucide-react'
import { EventEditFormModal } from './EventEditFormModal'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * 表示モードの型定義
 * - card: カード形式の一覧表示
 * - table: テーブル形式での一括編集
 */
type ViewMode = 'card' | 'table'

/**
 * 外部イベントインポートのクライアントコンポーネント
 */
export function EventImportClient() {
  // スクレイピング結果
  const [events, setEvents] = useState<ImportableEvent[]>([])
  // 選択されたイベントID
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 処理中フラグ
  const [isPending, startTransition] = useTransition()
  // スクレイピング中フラグ
  const [isScraping, setIsScraping] = useState(false)
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null)
  // 成功メッセージ
  const [success, setSuccess] = useState<string | null>(null)
  // 除外された重複件数
  const [filteredCount, setFilteredCount] = useState<number>(0)
  // 選択された地方
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  // 編集中のイベント
  const [editingEvent, setEditingEvent] = useState<ImportableEvent | null>(null)
  // 表示モード（カード or テーブル）
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  /**
   * スクレイピング実行
   */
  const handleScrape = async () => {
    setIsScraping(true)
    setError(null)
    setSuccess(null)
    setEvents([])
    setSelectedIds(new Set())
    setFilteredCount(0)

    try {
      const result = selectedRegion === 'all'
        ? await scrapeExternalEvents()
        : await scrapeEventsByRegion(selectedRegion)

      if (!result.success) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
      } else {
        const { events: scraped, filteredCount: filtered } = result.data!
        setEvents(scraped)
        setFilteredCount(filtered)
        // 重複でないイベントを初期選択（類似イベントは選択しない）
        const nonDuplicateIds = new Set(
          scraped
            .filter((e) => !e.isDuplicate && e.startDate)
            .map((e) => e.id)
        )
        setSelectedIds(nonDuplicateIds)
      }
    } catch {
      setError('スクレイピング中にエラーが発生しました')
    } finally {
      setIsScraping(false)
    }
  }

  /**
   * イベント選択切り替え
   */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  /**
   * 全選択/全解除
   */
  const toggleSelectAll = () => {
    if (selectedIds.size === events.filter((e) => e.startDate).length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(events.filter((e) => e.startDate).map((e) => e.id)))
    }
  }

  /**
   * イベント更新
   */
  const handleUpdateEvent = (updatedEvent: ImportableEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
    )
    setEditingEvent(null)
  }

  /**
   * テーブルでの直接編集用ハンドラ
   */
  const handleInlineUpdate = <K extends keyof ImportableEvent>(
    eventId: string,
    field: K,
    value: ImportableEvent[K]
  ) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, [field]: value } : e))
    )
  }

  /**
   * イベント削除（一覧から除外）
   */
  const handleRemoveEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(eventId)
      return next
    })
  }

  /**
   * インポート実行
   */
  const handleImport = () => {
    if (selectedIds.size === 0) {
      setError('インポートするイベントを選択してください')
      return
    }

    startTransition(async () => {
      setError(null)
      setSuccess(null)

      const selectedEvents = events.filter((e) => selectedIds.has(e.id))
      const result = await importSelectedEvents(selectedEvents)

      if (!result.success) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
      } else {
        const importedCount = result.data?.importedCount ?? 0
        setSuccess(`${importedCount}件のイベントをインポートしました`)
        // インポート済みを除去
        setEvents((prev) => prev.filter((e) => !selectedIds.has(e.id)))
        setSelectedIds(new Set())
      }
    })
  }

  /**
   * 日付フォーマット
   */
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '日付なし'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* 操作パネル */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* 地方選択 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">取得する地方:</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              disabled={isScraping}
              className="px-3 py-2 border rounded-lg bg-background"
            >
              <option value="all">全地方</option>
              {BONSAI_EVENT_SOURCES.map((source) => (
                <option key={source.region} value={source.region}>
                  {source.region}
                </option>
              ))}
            </select>
          </div>

          {/* スクレイピングボタン */}
          <button
            onClick={handleScrape}
            disabled={isScraping}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isScraping ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                取得中...
              </span>
            ) : (
              'イベント情報を取得'
            )}
          </button>

          {/* インポートボタン（イベントがある場合のみ） */}
          {events.length > 0 && (
            <>
              <button
                onClick={handleImport}
                disabled={isPending || selectedIds.size === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    インポート中...
                  </span>
                ) : (
                  `選択した${selectedIds.size}件をインポート`
                )}
              </button>

              {/* 表示モード切り替え */}
              <div className="flex items-center gap-1 ml-auto border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-2 text-sm ${
                    viewMode === 'table'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                  title="テーブル表示（一括編集）"
                >
                  📋 テーブル
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={`px-3 py-2 text-sm ${
                    viewMode === 'card'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                  title="カード表示"
                >
                  🗂️ カード
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* メッセージ */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
          {success}
        </div>
      )}

      {/* イベント一覧 */}
      {events.length > 0 && (
        <div className="bg-card rounded-lg border">
          {/* ヘッダー */}
          <div className="px-4 py-3 border-b bg-muted/50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.size === events.filter((e) => e.startDate).length}
                onChange={toggleSelectAll}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">
                取得結果: {events.length}件
                {filteredCount > 0 && (
                  <span className="text-muted-foreground">
                    （完全重複 {filteredCount}件は除外済み）
                  </span>
                )}
                {selectedIds.size > 0 && ` (${selectedIds.size}件選択中)`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded">黄色</span>
              <span>= 類似イベントが登録済み（期間違い）</span>
            </div>
          </div>

          {/* テーブル表示モード */}
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left w-8">選択</th>
                    <th className="px-2 py-2 text-left min-w-[200px]">タイトル</th>
                    <th className="px-2 py-2 text-left w-32">開始日</th>
                    <th className="px-2 py-2 text-left w-32">終了日</th>
                    <th className="px-2 py-2 text-left w-28">都道府県</th>
                    <th className="px-2 py-2 text-left w-28">市区町村</th>
                    <th className="px-2 py-2 text-left min-w-[150px]">会場</th>
                    <th className="px-2 py-2 text-left w-28">入場料</th>
                    <th className="px-2 py-2 text-left w-16">即売</th>
                    <th className="px-2 py-2 text-left w-20">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      className={`hover:bg-muted/30 ${
                        event.isDuplicate ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                      } ${!event.startDate ? 'opacity-50' : ''}`}
                    >
                      {/* チェックボックス */}
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(event.id)}
                          onChange={() => toggleSelect(event.id)}
                          disabled={!event.startDate}
                          className="w-4 h-4"
                        />
                      </td>
                      {/* タイトル */}
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={event.title}
                          onChange={(e) => handleInlineUpdate(event.id, 'title', e.target.value)}
                          className="w-full px-2 py-1 border rounded bg-background text-sm"
                        />
                        {event.duplicateType === 'similar' && (
                          <div className="mt-1">
                            <span className="px-1 py-0.5 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded" title={event.similarEventTitle}>
                              類似: {event.similarEventTitle?.substring(0, SIMILAR_EVENT_TITLE_LENGTH)}...
                            </span>
                          </div>
                        )}
                      </td>
                      {/* 開始日 */}
                      <td className="px-2 py-1">
                        <input
                          type="date"
                          value={event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleInlineUpdate(event.id, 'startDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                          className="w-full px-2 py-1 border rounded bg-background text-sm"
                        />
                      </td>
                      {/* 終了日 */}
                      <td className="px-2 py-1">
                        <input
                          type="date"
                          value={event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleInlineUpdate(event.id, 'endDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                          className="w-full px-2 py-1 border rounded bg-background text-sm"
                        />
                      </td>
                      {/* 都道府県 */}
                      <td className="px-2 py-1">
                        <select
                          value={event.prefecture || ''}
                          onChange={(e) => handleInlineUpdate(event.id, 'prefecture', e.target.value || null)}
                          className="w-full px-2 py-1 border rounded bg-background text-sm"
                        >
                          <option value="">-</option>
                          {PREFECTURES.map((pref) => (
                            <option key={pref} value={pref}>
                              {pref}
                            </option>
                          ))}
                        </select>
                      </td>
                      {/* 市区町村 */}
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={event.city || ''}
                          onChange={(e) => handleInlineUpdate(event.id, 'city', e.target.value || null)}
                          className="w-full px-2 py-1 border rounded bg-background text-sm"
                          placeholder="市区町村"
                        />
                      </td>
                      {/* 会場 */}
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={event.venue || ''}
                          onChange={(e) => handleInlineUpdate(event.id, 'venue', e.target.value || null)}
                          className="w-full px-2 py-1 border rounded bg-background text-sm"
                          placeholder="会場名"
                        />
                      </td>
                      {/* 入場料 */}
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={event.admissionFee || ''}
                          onChange={(e) => handleInlineUpdate(event.id, 'admissionFee', e.target.value || null)}
                          className="w-full px-2 py-1 border rounded bg-background text-sm"
                          placeholder="無料/有料"
                        />
                      </td>
                      {/* 即売 */}
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={event.hasSales}
                          onChange={(e) => handleInlineUpdate(event.id, 'hasSales', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      {/* 操作 */}
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingEvent(event)}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200"
                            title="詳細編集"
                          >
                            詳細
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvent(event.id)}
                            className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200"
                            title="削除"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* カード表示モード */
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`p-4 hover:bg-muted/30 ${
                    event.isDuplicate ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                  } ${!event.startDate ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* チェックボックス */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(event.id)}
                      onChange={() => toggleSelect(event.id)}
                      disabled={!event.startDate}
                      className="w-4 h-4 mt-1"
                    />

                    {/* イベント情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm">{event.title}</h3>
                        {event.duplicateType === 'similar' && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded flex-shrink-0" title={event.similarEventTitle}>
                            類似あり
                          </span>
                        )}
                      </div>
                      {event.duplicateType === 'similar' && event.similarEventTitle && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                          ⚠️ 類似イベント: 「{event.similarEventTitle}」
                        </p>
                      )}

                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>
                          📅 {formatDate(event.startDate)}
                          {event.endDate && ` 〜 ${formatDate(event.endDate)}`}
                        </span>
                        {event.prefecture && (
                          <span>📍 {event.prefecture}{event.city && ` ${event.city}`}</span>
                        )}
                        {event.venue && <span>🏛️ {event.venue}</span>}
                      </div>

                      {event.organizer && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          主催: {event.organizer}
                        </p>
                      )}

                      {event.description && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 bg-muted rounded">
                          {event.sourceRegion}
                        </span>
                        {event.hasSales && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            即売あり
                          </span>
                        )}
                        {event.externalUrl && (
                          <a
                            href={event.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            詳細 <ChevronRight className="h-4 w-4 inline-block shrink-0" aria-hidden />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingEvent(event)}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveEvent(event.id)}
                          className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 空の状態 */}
      {!isScraping && events.length === 0 && (
        <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">
          <p>「イベント情報を取得」ボタンを押してイベントを取得してください</p>
        </div>
      )}

      {/* 編集モーダル */}
      <EventEditFormModal
        event={editingEvent}
        onSave={handleUpdateEvent}
        onClose={() => setEditingEvent(null)}
      />
    </div>
  )
}
