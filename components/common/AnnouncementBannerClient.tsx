'use client'

/**
 * お知らせバナーの Client 側。dismiss 状態を localStorage に保持し、
 * 一度閉じたお知らせは同じ ID では再表示しない。
 *
 * 設計メモ:
 *   localStorage の値変化は `useSyncExternalStore` で購読する。
 *   `useEffect` 内で setState すると `react-hooks/set-state-in-effect` lint と
 *   cascading render を発火させるため、external store として直接 subscribe する。
 *   getSnapshot は `raw` 文字列の同値性でキャッシュし、Set インスタンスの
 *   参照同値性を維持する（React 18+ の安定性要件）。
 *
 * @module components/common/AnnouncementBannerClient
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { X as CloseIcon, Megaphone as MegaphoneIcon } from 'lucide-react'
import { STORAGE_KEY_DISMISSED_ANNOUNCEMENTS } from '@/lib/constants/storage-keys'
import { clientLogger } from '@/lib/client-logger'

export type AnnouncementBannerItem = {
  id: string
  title: string
  content: string
  type: string
}

type Props = {
  items: AnnouncementBannerItem[]
}

/** 同タブ内 dismiss 変更を通知する CustomEvent 名。 */
const DISMISSED_CHANGE_EVENT = 'dismissed-announcements-change'

/** SSR / 未保存時に返す不変空集合（useSyncExternalStore の参照同値性のため）。 */
const EMPTY_DISMISSED: ReadonlySet<string> = new Set<string>()

/**
 * localStorage から dismiss 済み ID 集合を読む。
 * パース失敗時は空集合を返し、書き込み側で上書きする。
 */
function parseDismissedIds(raw: string | null): ReadonlySet<string> {
  if (!raw) return EMPTY_DISMISSED
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY_DISMISSED
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch (error) {
    clientLogger.warn('failed to read dismissed announcements from localStorage', error)
    return EMPTY_DISMISSED
  }
}

/**
 * getSnapshot の参照同値性を保つためのキャッシュ。
 * `raw` 文字列が同じなら同じ Set インスタンスを返し、React の無限再描画を防ぐ。
 */
let cachedClientSnapshot: { raw: string | null; ids: ReadonlySet<string> } = {
  raw: null,
  ids: EMPTY_DISMISSED,
}

function getDismissedClientSnapshot(): ReadonlySet<string> {
  const raw = window.localStorage.getItem(STORAGE_KEY_DISMISSED_ANNOUNCEMENTS)
  if (raw === cachedClientSnapshot.raw) return cachedClientSnapshot.ids
  const ids = parseDismissedIds(raw)
  cachedClientSnapshot = { raw, ids }
  return ids
}

function getDismissedServerSnapshot(): ReadonlySet<string> {
  return EMPTY_DISMISSED
}

function subscribeDismissedChanges(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_DISMISSED_ANNOUNCEMENTS) callback()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(DISMISSED_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(DISMISSED_CHANGE_EVENT, callback)
  }
}

/** dismiss を永続化し同タブ内 listener に通知する。 */
function persistAndNotifyDismissed(ids: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_DISMISSED_ANNOUNCEMENTS, JSON.stringify(Array.from(ids)))
    window.dispatchEvent(new CustomEvent(DISMISSED_CHANGE_EVENT))
  } catch (error) {
    clientLogger.warn('failed to persist dismissed announcements to localStorage', error)
  }
}

export function AnnouncementBannerClient({ items }: Props) {
  const dismissedIds = useSyncExternalStore(
    subscribeDismissedChanges,
    getDismissedClientSnapshot,
    getDismissedServerSnapshot,
  )

  const visibleItem = useMemo(
    () => items.find((item) => !dismissedIds.has(item.id)) ?? null,
    [items, dismissedIds],
  )

  const handleDismiss = useCallback(() => {
    if (!visibleItem) return
    // ReadonlySet を Set にコピーして mutate
    const next = new Set(dismissedIds)
    next.add(visibleItem.id)
    persistAndNotifyDismissed(next)
  }, [visibleItem, dismissedIds])

  if (!visibleItem) return null

  return (
    <div
      role="region"
      aria-label="お知らせ"
      className="border-b border-bonsai-bark/30 bg-bonsai-cream/70 dark:bg-bonsai-bark/30 backdrop-blur-sm"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 sm:py-3 flex items-start gap-3">
        <MegaphoneIcon
          className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 shrink-0 text-bonsai-leaf"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-semibold text-foreground truncate">{visibleItem.title}</p>
          <p className="text-muted-foreground line-clamp-2 whitespace-pre-wrap break-words">
            {visibleItem.content}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="このお知らせを閉じる"
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-bonsai-bark/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bonsai-leaf/40"
        >
          <CloseIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
